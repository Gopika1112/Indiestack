-- Migration 016: Content moderation (reports).
-- Applied manually against the running DB (initdb.d only runs on a fresh volume).

-- reports: user-submitted reports of spam/abuse/inappropriate content.
CREATE TABLE IF NOT EXISTS reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL, -- 'spam', 'abuse', 'inappropriate', 'other'
    details     TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A report must target either a post or a comment, not both.
    CHECK ((post_id IS NOT NULL) OR (comment_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_post ON reports(post_id);
CREATE INDEX IF NOT EXISTS idx_reports_comment ON reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

-- Prevent duplicate reports from the same user on the same content.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique ON reports(reporter_id, COALESCE(post_id, comment_id));
