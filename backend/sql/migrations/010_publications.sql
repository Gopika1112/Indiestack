-- Migration 010: Publications (multi-author magazines).
-- Applied manually against the running DB (initdb.d only runs on a fresh volume).

CREATE TABLE IF NOT EXISTS publications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    logo_url    TEXT DEFAULT '',
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publications_slug ON publications(slug);

-- publication_members: editors/writers of a publication.
CREATE TABLE IF NOT EXISTS publication_members (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role           TEXT NOT NULL DEFAULT 'writer', -- 'owner' | 'editor' | 'writer'
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (publication_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_publication_members_pub ON publication_members(publication_id);
CREATE INDEX IF NOT EXISTS idx_publication_members_user ON publication_members(user_id);

-- publication_follows: users following a publication.
CREATE TABLE IF NOT EXISTS publication_follows (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (publication_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_publication_follows_pub ON publication_follows(publication_id);
CREATE INDEX IF NOT EXISTS idx_publication_follows_user ON publication_follows(user_id);

-- publication_posts: stories published under a publication.
CREATE TABLE IF NOT EXISTS publication_posts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
    post_id        UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (publication_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_publication_posts_pub ON publication_posts(publication_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publication_posts_post ON publication_posts(post_id);
