-- Add customer_id column to sales table (if not exists)
-- Run this in Supabase SQL Editor if customer_id is not already in the sales table

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS customer_id TEXT;

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales'
AND column_name = 'customer_id';
