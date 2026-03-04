-- SQL script to change user role from admin to staff by email
-- Run this in Supabase SQL Editor

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

