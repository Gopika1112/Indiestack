-- Migration 007: trending-posts event log + topic follows.
-- Applied manually against the running DB (initdb.d only runs on a fresh volume).

-- post_views: one row per post view (event log powering time-windowed trending).
CREATE TABLE IF NOT EXISTS post_views (
    id          BIGSERIAL PRIMARY KEY,
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE, -- nullable for anonymous readers
    viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes to keep the trending query fast as the table grows.
CREATE INDEX IF NOT EXISTS idx_post_views_time ON post_views (viewed_at);
CREATE INDEX IF NOT EXISTS idx_post_views_post_time ON post_views (post_id, viewed_at);

-- topic_follows: a user follows a topic (tag). Drives the "followed topics" feed.
CREATE TABLE IF NOT EXISTS topic_follows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag         TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_topic_follows_user ON topic_follows (user_id);
CREATE INDEX IF NOT EXISTS idx_topic_follows_tag ON topic_follows (tag);
