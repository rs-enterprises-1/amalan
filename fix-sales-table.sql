-- Fix Sales Table - Add Missing Columns
-- Run this in Supabase SQL Editor

-- Add missing buyer columns if they don't exist
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS buyer_name TEXT,
ADD COLUMN IF NOT EXISTS buyer_address TEXT,
ADD COLUMN IF NOT EXISTS buyer_phone TEXT;

-- Verify all columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales' 
ORDER BY ordinal_position;


