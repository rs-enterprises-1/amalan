-- Diagnostic Script for Advance Insert Error
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if the vehicle exists
SELECT 
  chassis_no,
  maker,
  model,
  status,
  created_at
FROM vehicles
WHERE chassis_no = '64656454';  -- Replace with your chassis number

-- 2. Check if advance already exists for this vehicle
SELECT *
FROM advances
WHERE chassis_no = '64656454';

-- 3. Check RLS policies on advances table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'advances';

-- 4. Check table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'advances'
ORDER BY ordinal_position;

-- 5. Test insert (replace values as needed)
-- This will show the exact error if there is one
INSERT INTO advances (
  chassis_no,
  customer_name,
  customer_phone,
  customer_address,
  expected_sell_price_lkr
) VALUES (
  '64656454',  -- Replace with your chassis number
  'Test Customer',
  '1234567890',
  'Test Address',
  1000000.00
);

-- 6. If the vehicle doesn't exist, check vehicles table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'vehicles'
ORDER BY ordinal_position;


