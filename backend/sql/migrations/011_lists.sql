-- Migration 011: Lists (curated reading lists).
-- Applied manually against the running DB (initdb.d only runs on a fresh volume).

-- lists: a user-created collection of posts.
CREATE TABLE IF NOT EXISTS lists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_public   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lists_user ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_public ON lists(is_public) WHERE is_public = true;

-- list_items: posts saved into a list.
CREATE TABLE IF NOT EXISTS list_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id    UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (list_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_list_items_post ON list_items(post_id);
