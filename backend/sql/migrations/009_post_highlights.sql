-- Reader highlights: a signed-in reader can save a text selection from a post.

CREATE TABLE IF NOT EXISTS post_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'yellow',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, post_id, text)
);

CREATE INDEX IF NOT EXISTS idx_post_highlights_user ON post_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_post_highlights_post ON post_highlights(post_id);
