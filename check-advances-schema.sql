-- Check the actual schema of the advances table
-- Run this in Supabase SQL Editor

-- Check all columns in advances table
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'advances'
ORDER BY ordinal_position;

-- Check constraints
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'advances'::regclass;


