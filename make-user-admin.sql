-- ============================================
-- SQL Script to Make User Admin
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- METHOD 1: Make User Admin by Email
-- ============================================
-- Replace 'your-email@example.com' with the actual email address

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'::jsonb
)
WHERE email = 'your-email@example.com';

-- Verify the change
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
WHERE email = 'your-email@example.com';

-- ============================================
-- METHOD 2: Make User Admin by User ID (UUID)
-- ============================================
-- Replace 'USER_ID_HERE' with the actual user UUID
-- You can find the UUID from the SELECT query above

-- UPDATE auth.users
-- SET raw_user_meta_data = jsonb_set(
--   COALESCE(raw_user_meta_data, '{}'::jsonb),
--   '{role}',
--   '"admin"'::jsonb
-- )
-- WHERE id = 'USER_ID_HERE'::uuid;

-- Verify the change
-- SELECT 
--   id,
--   email,
--   raw_user_meta_data->>'role' as role,
--   created_at
-- FROM auth.users
-- WHERE id = 'USER_ID_HERE'::uuid;

-- ============================================
-- METHOD 3: List All Users and Their Roles
-- ============================================
-- Uncomment to see all users and their current roles

-- SELECT 
--   id,
--   email,
--   raw_user_meta_data->>'role' as role,
--   created_at
-- FROM auth.users
-- ORDER BY created_at DESC;

-- ============================================
-- METHOD 4: Make Multiple Users Admin
-- ============================================
-- Update multiple users at once by listing their emails

-- UPDATE auth.users
-- SET raw_user_meta_data = jsonb_set(
--   COALESCE(raw_user_meta_data, '{}'::jsonb),
--   '{role}',
--   '"admin"'::jsonb
-- )
-- WHERE email IN (
--   'user1@example.com',
--   'user2@example.com',
--   'user3@example.com'
-- );

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. After running this SQL, the user needs to:
--    - Logout from the application
--    - Login again for the role change to take effect
--
-- 2. The role is stored in raw_user_meta_data JSONB field
--
-- 3. Default role is 'staff' if not set
--
-- 4. Valid roles are: 'admin' or 'staff'
--
-- 5. Admin users have access to:
--    - All reports and profit data
--    - "Sell Now" functionality
--    - User management
--    - Branding settings
--    - All vehicle operations
--
-- ============================================
