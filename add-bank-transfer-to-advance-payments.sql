-- Add bank transfer fields to advance_payments table
-- Run this in Supabase SQL Editor

ALTER TABLE advance_payments
ADD COLUMN IF NOT EXISTS bank_transferred BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bank_acc_no TEXT,
ADD COLUMN IF NOT EXISTS bank_transfer_date DATE,
ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'advance_payments'
AND column_name IN (
  'bank_transferred',
  'bank_acc_no',
  'bank_transfer_date',
  'bank_name'
)
ORDER BY column_name;
