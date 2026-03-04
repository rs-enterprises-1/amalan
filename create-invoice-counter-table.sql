-- Create invoice counter table for sequential numbering
-- Run this in Supabase SQL Editor

-- Drop existing table if it has wrong structure (optional - comment out if you want to keep data)
-- DROP TABLE IF EXISTS invoice_counter CASCADE;

-- Create the table
CREATE TABLE IF NOT EXISTS invoice_counter (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_invoice_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial counter if it doesn't exist
-- Use a DO block to handle the insert safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM invoice_counter WHERE id = 1) THEN
    INSERT INTO invoice_counter (id, last_invoice_number, updated_at)
    VALUES (1, 0, NOW());
  END IF;
END $$;

-- Function to get next invoice number
CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE invoice_counter
  SET last_invoice_number = last_invoice_number + 1,
      updated_at = NOW()
  WHERE id = 1
  RETURNING last_invoice_number INTO next_num;
  
  RETURN LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

