-- Create transaction_details table to save all entered details
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS transaction_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'transaction')),
  
  -- Customer details
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  
  -- Transaction summary specific
  lease_company TEXT,
  lease_amount NUMERIC,
  payment_method TEXT CHECK (payment_method IN ('cash', 'cheque', 'both')),
  
  -- Cheque details
  cheque1_no TEXT,
  cheque1_amount NUMERIC,
  cheque2_no TEXT,
  cheque2_amount NUMERIC,
  
  -- Cash denominations
  cash_5000 INTEGER DEFAULT 0,
  cash_2000 INTEGER DEFAULT 0,
  cash_1000 INTEGER DEFAULT 0,
  cash_500 INTEGER DEFAULT 0,
  cash_100 INTEGER DEFAULT 0,
  
  -- Other charges
  registration NUMERIC DEFAULT 0,
  valuation NUMERIC DEFAULT 0,
  r_licence NUMERIC DEFAULT 0,
  
  -- Signatures
  customer_signature TEXT,
  authorized_signature TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE transaction_details ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Allow authenticated users" ON transaction_details;
CREATE POLICY "Allow authenticated users" ON transaction_details
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transaction_details_customer_name ON transaction_details(customer_name);
CREATE INDEX IF NOT EXISTS idx_transaction_details_customer_phone ON transaction_details(customer_phone);

-- Verify the table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'transaction_details'
ORDER BY ordinal_position;

