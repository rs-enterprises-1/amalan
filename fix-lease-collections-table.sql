-- Add lease_company column to lease_collections table
-- Run this in Supabase SQL Editor

ALTER TABLE lease_collections 
ADD COLUMN IF NOT EXISTS lease_company TEXT;

-- Verify the column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'lease_collections'
ORDER BY ordinal_position;


