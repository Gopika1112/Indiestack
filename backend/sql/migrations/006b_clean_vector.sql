-- Migration 006b: extract real text from the TipTap JSONB for a cleaner vector.
-- Applied manually against the running DB.

-- Recursively pull only the text content out of TipTap text nodes.
CREATE OR REPLACE FUNCTION tiptap_extract_text(node jsonb) RETURNS text AS $$
DECLARE
  result text := '';
  child  jsonb;
BEGIN
  IF node IS NULL THEN
    RETURN '';
  END IF;

  -- Text node: append its text.
  IF node->>'type' = 'text' THEN
    result := result || ' ' || coalesce(node->>'text', '');
  END IF;

  -- Recurse into children.
  IF jsonb_typeof(node->'content') = 'array' THEN
    FOR child IN SELECT * FROM jsonb_array_elements(node->'content') LOOP
      result := result || tiptap_extract_text(child);
    END LOOP;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Rebuild the vector using clean extracted body text instead of raw JSON.
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce((SELECT string_agg(value, ' ') FROM jsonb_array_elements_text(coalesce(NEW.tags, '[]'::jsonb))), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(tiptap_extract_text(NEW.content), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill again with the cleaner extraction.
UPDATE posts SET title = title;
