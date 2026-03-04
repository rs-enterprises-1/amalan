-- Add enable_sri_lanka_purchase column to settings table
-- Run this in Supabase SQL Editor

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS enable_sri_lanka_purchase BOOLEAN DEFAULT false;

-- Update existing row to set default value
UPDATE settings
SET enable_sri_lanka_purchase = false
WHERE enable_sri_lanka_purchase IS NULL;
