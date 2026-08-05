-- Migration 006: full-text search vector on posts + related-posts support.
-- Applied manually against the running DB (initdb.d only runs on a fresh volume).

-- 1) Add a tsvector column that aggregates title (highest weight), tags,
--    excerpt, and the full TipTap body text (lowest weight).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2) Function to (re)build the vector for a row.
--    content is JSONB TipTap; casting to text captures the words in text nodes.
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(coalesce(NEW.tags, '[]'::jsonb))), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.content::text, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Trigger to keep the vector fresh on insert/update.
DROP TRIGGER IF EXISTS trg_posts_search_vector ON posts;
CREATE TRIGGER trg_posts_search_vector
  BEFORE INSERT OR UPDATE OF title, excerpt, tags, content ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();

-- 4) GIN index for fast full-text lookup.
CREATE INDEX IF NOT EXISTS idx_posts_search_vector ON posts USING GIN (search_vector);

-- 5) Backfill existing rows (forces the trigger to run for each row).
UPDATE posts SET title = title;
