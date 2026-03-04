-- Fix Advances Table
-- Run this in Supabase SQL Editor

-- Check if advances table exists, if not create it
CREATE TABLE IF NOT EXISTS advances (
  chassis_no TEXT PRIMARY KEY REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  expected_sell_price_lkr NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure RLS is enabled
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on advances (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view advances" ON advances;
DROP POLICY IF EXISTS "Users can insert advances" ON advances;
DROP POLICY IF EXISTS "Users can update advances" ON advances;
DROP POLICY IF EXISTS "Users can delete advances" ON advances;
DROP POLICY IF EXISTS "Allow authenticated users" ON advances;

-- Create comprehensive RLS policies for advances
-- These policies allow all authenticated users to access advances
CREATE POLICY "Allow authenticated users" ON advances
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Alternative: If the above doesn't work, use this more permissive policy
-- (Uncomment if needed, but the above should work)
-- CREATE POLICY "Allow all authenticated" ON advances
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- Verify the table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'advances'
ORDER BY ordinal_position;

-- Check existing policies
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

