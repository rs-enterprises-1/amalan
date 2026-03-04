-- SQL script to assign user role in Supabase
-- Run this in Supabase SQL Editor

-- ============================================
-- CHANGE USER ROLE TO STAFF BY EMAIL
-- ============================================
-- Replace 'user@example.com' with the actual email address
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"staff"'::jsonb
)
WHERE email = 'user@example.com';

-- Verify the change
SELECT 
  email,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'user@example.com';

-- ============================================
-- CHANGE USER ROLE TO ADMIN BY EMAIL
-- ============================================
-- UPDATE auth.users
-- SET raw_user_meta_data = jsonb_set(
--   COALESCE(raw_user_meta_data, '{}'::jsonb),
--   '{role}',
--   '"admin"'::jsonb
-- )
-- WHERE email = 'user@example.com';

-- ============================================
-- CHANGE USER ROLE BY USER ID (UUID)
-- ============================================
-- UPDATE auth.users
-- SET raw_user_meta_data = jsonb_set(
--   COALESCE(raw_user_meta_data, '{}'::jsonb),
--   '{role}',
--   '"staff"'::jsonb  -- or '"admin"'::jsonb
-- )
-- WHERE id = 'USER_ID_HERE'::uuid;

