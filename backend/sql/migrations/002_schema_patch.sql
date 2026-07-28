-- Migration 002: Schema patch
-- Adds tables/columns/indexes missing from 001_init.sql but referenced by the backend.

-- Companies table (referenced by jobs.company_id FK)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    logo_url TEXT,
    website TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time-series / analytics tables (planned, kept as regular tables for now)
CREATE TABLE IF NOT EXISTS post_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(254) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Add missing columns to existing tables
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS payer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE newsletter_subscriptions ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE newsletter_subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Ensure jobs.company_name is NOT NULL (backend always provides it)
ALTER TABLE jobs ALTER COLUMN company_name SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN company_name SET DEFAULT '';

-- Ensure jobs.job_type and work_mode have sensible defaults
ALTER TABLE jobs ALTER COLUMN job_type SET DEFAULT 'full-time';
ALTER TABLE jobs ALTER COLUMN work_mode SET DEFAULT 'remote';
ALTER TABLE jobs ALTER COLUMN description SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN description SET DEFAULT '';

-- Ensure notifications columns have defaults where backend may omit them
ALTER TABLE notifications ALTER COLUMN type SET DEFAULT 'info';
ALTER TABLE notifications ALTER COLUMN title SET DEFAULT '';
ALTER TABLE notifications ALTER COLUMN body SET DEFAULT '';

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_posts_author_status ON posts(author_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_status_published ON posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_user_id ON reading_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_tips_recipient ON tips(recipient_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_event_time ON post_analytics(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_email ON email_events(email);
CREATE INDEX IF NOT EXISTS idx_email_events_event_time ON email_events(event_time DESC);
