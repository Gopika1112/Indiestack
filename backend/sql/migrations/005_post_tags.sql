-- Migration 005: add tags to posts for topic filtering/discovery.
-- Applied manually against the running DB (initdb.d only runs on a fresh volume).

ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Index to speed up tag containment queries (tags @> '["X"]').
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING GIN (tags);
