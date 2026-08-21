-- Migration 017: Add role column to users for admin access.
-- Applied manually against the running DB (initdb.d only runs on a fresh volume).

-- Add role column with default 'user'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Create an index for fast admin lookups.
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Promote the first user (alice) to admin for testing.
-- You can change this to any user you want to be admin.
UPDATE users SET role = 'admin' WHERE username = 'alice';
