INSERT INTO posts (id, author_id, slug, title, content, excerpt, reading_time_minutes, word_count, status, published_at, view_count, like_count, is_premium, created_at, updated_at)
VALUES 
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'getting-started', 'Getting Started with IndieStack', '{"type":"doc"}'::jsonb, 'Learn how to get started with IndieStack.', 5, 1200, 'published', NOW(), 150, 42, false, NOW(), NOW()),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'content-strategy', 'Building a Content Strategy', '{"type":"doc"}'::jsonb, 'Essential tips for building a content strategy.', 8, 1800, 'published', NOW(), 89, 23, false, NOW(), NOW()),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'seo-techniques', 'Advanced SEO Techniques', '{"type":"doc"}'::jsonb, 'Master advanced SEO techniques.', 10, 2400, 'published', NOW(), 234, 67, true, NOW(), NOW());
