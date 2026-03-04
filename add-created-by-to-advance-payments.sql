-- Add created_by field to advance_payments table
-- Run this in Supabase SQL Editor

ALTER TABLE advance_payments
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_advance_payments_created_by ON advance_payments(created_by);

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'advance_payments'
AND column_name IN ('created_by', 'created_by_role')
ORDER BY column_name;
