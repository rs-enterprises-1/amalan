-- Fix invoice_counter table if it exists with wrong structure
-- Run this in Supabase SQL Editor if you get column errors

-- Check if table exists and has correct structure
DO $$
BEGIN
  -- If table doesn't exist, create it
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_counter') THEN
    CREATE TABLE invoice_counter (
      id INTEGER PRIMARY KEY DEFAULT 1,
      last_invoice_number INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    INSERT INTO invoice_counter (id, last_invoice_number, updated_at)
    VALUES (1, 0, NOW());
  ELSE
    -- Table exists, check if column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'invoice_counter' AND column_name = 'last_invoice_number'
    ) THEN
      -- Add missing column
      ALTER TABLE invoice_counter ADD COLUMN last_invoice_number INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    -- Ensure we have a row
    IF NOT EXISTS (SELECT 1 FROM invoice_counter WHERE id = 1) THEN
      INSERT INTO invoice_counter (id, last_invoice_number, updated_at)
      VALUES (1, 0, NOW());
    END IF;
  END IF;
END $$;

-- Verify the table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'invoice_counter'
ORDER BY ordinal_position;


