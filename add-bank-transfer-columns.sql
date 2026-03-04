-- Add bank transfer columns to transaction_details table
-- Run this in Supabase SQL Editor

-- First, update the payment_method CHECK constraint to include 'bank_transfer'
ALTER TABLE transaction_details 
DROP CONSTRAINT IF EXISTS transaction_details_payment_method_check;

ALTER TABLE transaction_details 
ADD CONSTRAINT transaction_details_payment_method_check 
CHECK (payment_method IN ('cash', 'cheque', 'both', 'bank_transfer'));

-- Add bank transfer columns
ALTER TABLE transaction_details
ADD COLUMN IF NOT EXISTS bank_transfer_deposit_date DATE,
ADD COLUMN IF NOT EXISTS bank_transfer_bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_transfer_acc_no TEXT,
ADD COLUMN IF NOT EXISTS bank_transfer_amount NUMERIC;

-- Add customer_id column if it doesn't exist (needed for Transaction Summary)
ALTER TABLE transaction_details
ADD COLUMN IF NOT EXISTS customer_id TEXT;

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transaction_details'
AND column_name IN (
  'bank_transfer_deposit_date',
  'bank_transfer_bank_name',
  'bank_transfer_acc_no',
  'bank_transfer_amount',
  'customer_id',
  'payment_method'
)
ORDER BY column_name;
