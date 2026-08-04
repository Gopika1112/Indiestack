-- Migration 004: Settings, security, sessions, preferences, and danger-zone support.
-- Applied manually against the running DB (initdb.d only runs on a fresh volume).

-- Extra columns on users for account/security/profile fields.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_email TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Public profile extras (cover image + featured/social links).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_image_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS short_bio TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitter_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS youtube_url TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public';

-- Sessions: enables active-session list, connected devices, recent activity,
-- and logout-from-all-devices / logout-everywhere.
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_id TEXT NOT NULL UNIQUE,
    user_agent TEXT DEFAULT '',
    ip TEXT DEFAULT '',
    device TEXT DEFAULT '',
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id, last_used_at DESC);

-- Notification preferences (email + push toggles).
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_new_follower BOOLEAN DEFAULT true,
    email_new_comment BOOLEAN DEFAULT true,
    email_story_featured BOOLEAN DEFAULT true,
    email_weekly_digest BOOLEAN DEFAULT false,
    email_product_updates BOOLEAN DEFAULT true,
    push_comments BOOLEAN DEFAULT true,
    push_mentions BOOLEAN DEFAULT true,
    push_new_followers BOOLEAN DEFAULT true,
    push_replies BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Privacy settings.
CREATE TABLE IF NOT EXISTS privacy_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    private_account BOOLEAN DEFAULT false,
    show_reading_history BOOLEAN DEFAULT true,
    allow_search_indexing BOOLEAN DEFAULT true,
    show_followers_count BOOLEAN DEFAULT true,
    show_following_count BOOLEAN DEFAULT true,
    allow_direct_messages BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Writing preferences (server-persisted so they sync across devices).
CREATE TABLE IF NOT EXISTS writing_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    editor_font TEXT DEFAULT 'sans',
    font_size TEXT DEFAULT 'medium',
    editor_width TEXT DEFAULT 'medium',
    line_height TEXT DEFAULT 'normal',
    dark_mode_editor BOOLEAN DEFAULT false,
    spell_check BOOLEAN DEFAULT true,
    auto_save BOOLEAN DEFAULT true,
    default_visibility TEXT DEFAULT 'public',
    enable_comments BOOLEAN DEFAULT true,
    show_reading_time BOOLEAN DEFAULT true,
    show_table_of_contents BOOLEAN DEFAULT false,
    canonical_url TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reading preferences (server-persisted).
CREATE TABLE IF NOT EXISTS reading_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    reading_font TEXT DEFAULT 'sans',
    font_size TEXT DEFAULT 'medium',
    line_spacing TEXT DEFAULT 'normal',
    theme TEXT DEFAULT 'system',
    highlight_color TEXT DEFAULT 'yellow',
    auto_dark_mode BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email frequency + subscriptions.
CREATE TABLE IF NOT EXISTS email_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL DEFAULT 'weekly',
    newsletters BOOLEAN DEFAULT true,
    product_updates BOOLEAN DEFAULT true,
    writer_recommendations BOOLEAN DEFAULT true,
    trending_stories BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Connected OAuth/social accounts.
CREATE TABLE IF NOT EXISTS connected_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_account_id TEXT DEFAULT '',
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider)
);
