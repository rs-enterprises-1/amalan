-- Add enable_profit_intelligence column to settings table
-- Run this in Supabase SQL Editor

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS enable_profit_intelligence BOOLEAN DEFAULT false;

-- Update existing row to set default value
UPDATE settings
SET enable_profit_intelligence = COALESCE(enable_profit_intelligence, false)
WHERE id = 1;

