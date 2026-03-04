-- Add bank details columns to sales table for invoice reprinting
-- Run this SQL in your Supabase SQL editor

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN sales.bank_name IS 'Bank name for invoice (stored when invoice is generated)';
COMMENT ON COLUMN sales.bank_address IS 'Bank address for invoice, comma-separated (stored when invoice is generated)';

