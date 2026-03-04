-- Fix Missing Columns in Vehicles Table
-- Run this in Supabase SQL Editor

-- Check if final_total_lkr column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'final_total_lkr'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN final_total_lkr NUMERIC;
    END IF;
END $$;

-- Check if japan_total_lkr column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'japan_total_lkr'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN japan_total_lkr NUMERIC;
    END IF;
END $$;

-- Verify all required columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
ORDER BY ordinal_position;


