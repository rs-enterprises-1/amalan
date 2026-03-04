-- Complete Fix for Sales Table
-- Run this in Supabase SQL Editor

-- Add all missing columns to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS buyer_name TEXT,
ADD COLUMN IF NOT EXISTS buyer_address TEXT,
ADD COLUMN IF NOT EXISTS buyer_phone TEXT,
ADD COLUMN IF NOT EXISTS profit_lkr NUMERIC;

-- Make sure all required columns exist
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS sold_price NUMERIC,
ADD COLUMN IF NOT EXISTS sold_currency TEXT CHECK (sold_currency IN ('JPY', 'LKR')),
ADD COLUMN IF NOT EXISTS rate_jpy_to_lkr NUMERIC,
ADD COLUMN IF NOT EXISTS sold_date DATE;

-- Verify all columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales' 
ORDER BY ordinal_position;


