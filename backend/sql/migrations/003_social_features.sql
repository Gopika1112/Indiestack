-- Social features: reposts and muted authors

-- Reposts: a user re-shares a post to their followers' feeds.
CREATE TABLE IF NOT EXISTS reposts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_reposts_user ON reposts(user_id);
CREATE INDEX IF NOT EXISTS idx_reposts_post ON reposts(post_id);

-- Mutes: a user mutes an author so that author's posts are hidden from their feeds.
CREATE TABLE IF NOT EXISTS mutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muted_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, muted_user_id)
);

CREATE INDEX IF NOT EXISTS idx_mutes_user ON mutes(user_id);

-- Track how many times a post has been reposted.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_count INT NOT NULL DEFAULT 0;
