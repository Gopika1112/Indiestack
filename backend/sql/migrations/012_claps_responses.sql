-- Migration 012: Claps and Responses.
-- Applied manually against the running DB (initdb.d only runs on a fresh volume).

-- Claps: Medium-style applause (0-50 per user per post).
CREATE TABLE IF NOT EXISTS claps (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    count      INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1 AND count <= 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_claps_post ON claps(post_id);
CREATE INDEX IF NOT EXISTS idx_claps_user ON claps(user_id);

-- Add clap_count to posts for fast reads.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS clap_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_posts_clap_count ON posts(clap_count DESC);

-- Responses: a post that is a response to another post.
-- A response is itself a post (with parent_post_id pointing to the original).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS parent_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_post_id) WHERE parent_post_id IS NOT NULL;
