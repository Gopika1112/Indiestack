-- Migration 002: Seed demo data
-- Seed users first so that seeded posts satisfy foreign keys.

INSERT INTO users (id, email, username, password_hash, display_name, bio, avatar_url, website, location, is_verified, is_premium, follower_count, following_count, created_at, updated_at)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'alice@example.com', 'alice_writes', '$2b$12$tHdsC62npgIAnP4htzhDLustWqz8S6d18q3mvnvvW5AGr2gW92Cla', 'Alice Writer', 'Loves writing about tech and indie hacking.', 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice', 'https://alice.blog', 'San Francisco', true, false, 128, 42, NOW(), NOW()),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'bob@example.com', 'bob_codes', '$2b$12$tHdsC62npgIAnP4htzhDLustWqz8S6d18q3mvnvvW5AGr2gW92Cla', 'Bob Developer', 'Building in public, one commit at a time.', 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob', 'https://bob.dev', 'New York', false, true, 89, 15, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, name, bio, location, website, created_at, updated_at)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Alice Writer', 'Loves writing about tech and indie hacking.', 'San Francisco', 'https://alice.blog', NOW(), NOW()),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Bob Developer', 'Building in public, one commit at a time.', 'New York', 'https://bob.dev', NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO posts (id, author_id, slug, title, content, excerpt, reading_time_minutes, word_count, status, published_at, view_count, like_count, comment_count, is_premium, created_at, updated_at)
VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'getting-started', 'Getting Started with IndieStack', '{"type":"doc"}'::jsonb, 'Learn how to get started with IndieStack.', 5, 1200, 'published', NOW(), 150, 42, 0, false, NOW(), NOW()),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'content-strategy', 'Building a Content Strategy', '{"type":"doc"}'::jsonb, 'Essential tips for building a content strategy.', 8, 1800, 'published', NOW(), 89, 23, 0, false, NOW(), NOW()),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'seo-techniques', 'Advanced SEO Techniques', '{"type":"doc"}'::jsonb, 'Master advanced SEO techniques.', 10, 2400, 'published', NOW(), 234, 67, 0, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
