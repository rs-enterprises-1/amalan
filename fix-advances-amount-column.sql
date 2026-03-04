-- Fix Advances Table - Add amount_lkr column if missing
-- OR make it nullable if it exists but is NOT NULL
-- Run this in Supabase SQL Editor

-- Option 1: If amount_lkr column doesn't exist, add it as nullable
-- (This is the correct approach - amount_lkr should be in advance_payments, not advances)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'advances' AND column_name = 'amount_lkr'
  ) THEN
    -- Add the column as nullable (since it shouldn't be required in advances table)
    ALTER TABLE advances ADD COLUMN amount_lkr NUMERIC;
    RAISE NOTICE 'Added amount_lkr column to advances table';
  ELSE
    -- Column exists, make it nullable if it's currently NOT NULL
    ALTER TABLE advances ALTER COLUMN amount_lkr DROP NOT NULL;
    RAISE NOTICE 'Made amount_lkr nullable in advances table';
  END IF;
END $$;

-- Verify the change
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'advances'
ORDER BY ordinal_position;

-- Note: The correct design is:
-- - advances table: stores customer info and expected selling price
-- - advance_payments table: stores individual payment amounts with dates
-- 
-- If amount_lkr is required in advances, it might be a design issue.
-- Consider removing the NOT NULL constraint or removing the column entirely.


