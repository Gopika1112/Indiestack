-- Migration 019: Seed clean publications and lists with real content.
-- Owners: alice_writes (a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12),
--         bob_codes   (a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13)

-- ============================================================
-- PUBLICATIONS
-- ============================================================

INSERT INTO publications (id, name, slug, description, logo_url, owner_id, created_at, updated_at)
VALUES (
'a1000001-0000-0000-0000-000000000001',
'The AI Frontier',
'the-ai-frontier',
'Exploring artificial intelligence, machine learning, and the technologies shaping our future. In-depth analysis, practical guides, and thoughtful perspectives on AI.',
'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=200&q=80',
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
NOW(), NOW());

INSERT INTO publications (id, name, slug, description, logo_url, owner_id, created_at, updated_at)
VALUES (
'a1000002-0000-0000-0000-000000000002',
'Cloud Native',
'cloud-native',
'Everything about cloud infrastructure, DevOps, Kubernetes, and modern deployment practices. From containers to serverless, we cover the tools that power the modern web.',
'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200&q=80',
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
NOW(), NOW());

INSERT INTO publications (id, name, slug, description, logo_url, owner_id, created_at, updated_at)
VALUES (
'a1000003-0000-0000-0000-000000000003',
'Better Programming',
'better-programming',
'Practical advice for developers who want to write cleaner code, master new languages, and level up their craft. Tutorials, best practices, and deep dives.',
'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=200&q=80',
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
NOW(), NOW());

INSERT INTO publications (id, name, slug, description, logo_url, owner_id, created_at, updated_at)
VALUES (
'a1000004-0000-0000-0000-000000000004',
'Modern Web',
'modern-web',
'The latest in web development: frameworks, performance, APIs, and the technologies building tomorrow''s internet. For frontend and full-stack developers.',
'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=200&q=80',
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
NOW(), NOW());

-- ============================================================
-- PUBLICATION POSTS
-- ============================================================

-- The AI Frontier posts
INSERT INTO publication_posts (publication_id, post_id) VALUES
('a1000001-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'), -- The Future of Generative AI
('a1000001-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'), -- AI Ethics and Responsible AI
('a1000001-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003'), -- Machine Learning for Beginners
('a1000001-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004'), -- Deep Learning and Neural Networks
('a1000001-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'), -- How AI Is Transforming Cybersecurity
('a1000001-0000-0000-0000-000000000001', '2ec9b4cd-c5ad-4bfc-bbee-e4ad64ed3223'), -- Quantum Computing Explained
('a1000001-0000-0000-0000-000000000001', 'c03894ce-174e-4401-9174-835ffaf478b3'); -- Getting Started with Qiskit

-- Cloud Native posts
INSERT INTO publication_posts (publication_id, post_id) VALUES
('a1000002-0000-0000-0000-000000000002', 'ce8c469a-49a0-4430-9a35-34dced093392'), -- Kubernetes for Beginners
('a1000002-0000-0000-0000-000000000002', '8d9c1493-865f-4f5c-87fc-beae575ec28e'), -- Kubernetes vs Docker Swarm
('a1000002-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000024'), -- DevOps Fundamentals
('a1000002-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000025'), -- CI/CD Pipelines
('a1000002-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000026'), -- Infrastructure as Code
('a1000002-0000-0000-0000-000000000002', '0625c7a1-b5e4-4586-84fc-227ac1b38274'), -- Serverless Architecture
('a1000002-0000-0000-0000-000000000002', 'ef18ea62-8c18-4e6a-b894-780524a213db'), -- AWS vs Azure vs GCP
('a1000002-0000-0000-0000-000000000002', '448f5031-232a-4c76-8501-7ff7bb0db8bf'); -- Edge Computing

-- Modern Web posts
INSERT INTO publication_posts (publication_id, post_id) VALUES
('a1000004-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000006'), -- The Future of Web Development
('a1000004-0000-0000-0000-000000000004', '823a8384-b4c7-4f70-b8f4-0c7cce6b3a1d'), -- 10 TypeScript Tips
('a1000004-0000-0000-0000-000000000004', 'ea4121ff-9158-4d66-a9d6-e165719ab0d6'), -- Advanced TypeScript
('a1000004-0000-0000-0000-000000000004', '5273f0fd-fcb1-4aad-a670-3c874f5edb68'), -- Caching Strategies
('a1000004-0000-0000-0000-000000000004', 'b251a120-81a6-4fde-be20-9b0a2fd230bc'), -- GraphQL vs REST
('a1000004-0000-0000-0000-000000000004', '816a9f26-7e43-4f18-99cc-43e8b192e8da'); -- WebAssembly

-- ============================================================
-- LISTS
-- ============================================================

INSERT INTO lists (id, user_id, name, description, is_public, created_at, updated_at)
VALUES (
'a2000001-0000-0000-0000-000000000001',
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
'AI Must-Reads',
'Essential reading for anyone who wants to understand artificial intelligence, from beginner intros to ethics and the cutting edge.',
true, NOW(), NOW());

INSERT INTO lists (id, user_id, name, description, is_public, created_at, updated_at)
VALUES (
'a2000002-0000-0000-0000-000000000002',
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'DevOps Starter Pack',
'Everything you need to get started with DevOps: containers, orchestration, CI/CD, and cloud fundamentals.',
true, NOW(), NOW());

INSERT INTO lists (id, user_id, name, description, is_public, created_at, updated_at)
VALUES (
'a2000003-0000-0000-0000-000000000003',
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
'Level Up Your Code',
'Clean code, design patterns, testing, and the habits that separate good developers from great ones.',
true, NOW(), NOW());

INSERT INTO lists (id, user_id, name, description, is_public, created_at, updated_at)
VALUES (
'a2000004-0000-0000-0000-000000000004',
'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
'Web Dev Essentials',
'The core knowledge every web developer needs: TypeScript, APIs, caching, and the future of the browser.',
true, NOW(), NOW());

-- ============================================================
-- LIST ITEMS
-- ============================================================

-- AI Must-Reads items
INSERT INTO list_items (list_id, post_id) VALUES
('a2000001-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
('a2000001-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
('a2000001-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003'),
('a2000001-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004'),
('a2000001-0000-0000-0000-000000000001', '2ec9b4cd-c5ad-4bfc-bbee-e4ad64ed3223');

-- DevOps Starter Pack items
INSERT INTO list_items (list_id, post_id) VALUES
('a2000002-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000024'),
('a2000002-0000-0000-0000-000000000002', 'ce8c469a-49a0-4430-9a35-34dced093392'),
('a2000002-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000025'),
('a2000002-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000026'),
('a2000002-0000-0000-0000-000000000002', 'ef18ea62-8c18-4e6a-b894-780524a213db');

-- Level Up Your Code items
INSERT INTO list_items (list_id, post_id) VALUES
('a2000003-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000011'), -- Clean Code Principles
('a2000003-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000012'), -- Design Patterns Explained
('a2000003-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000013'); -- Test-Driven Development

-- Web Dev Essentials items
INSERT INTO list_items (list_id, post_id) VALUES
('a2000004-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000006'), -- Future of Web Development
('a2000004-0000-0000-0000-000000000004', '823a8384-b4c7-4f70-b8f4-0c7cce6b3a1d'), -- 10 TypeScript Tips
('a2000004-0000-0000-0000-000000000004', 'b251a120-81a6-4fde-be20-9b0a2fd230bc'), -- GraphQL vs REST
('a2000004-0000-0000-0000-000000000004', '5273f0fd-fcb1-4aad-a670-3c874f5edb68'), -- Caching Strategies
('a2000004-0000-0000-0000-000000000004', '816a9f26-7e43-4f18-99cc-43e8b192e8da'); -- WebAssembly
