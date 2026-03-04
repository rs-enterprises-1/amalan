-- Create lease_payment_transactions table to support multiple payments per lease collection
-- Each transaction can be either a cheque or personal loan payment

CREATE TABLE IF NOT EXISTS lease_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_collection_id UUID NOT NULL REFERENCES lease_collections(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cheque', 'personal_loan')),
  amount NUMERIC(12, 2) NOT NULL,
  -- Cheque fields (only used when payment_type = 'cheque')
  cheque_no TEXT NULL,
  cheque_deposit_bank_name TEXT NULL,
  cheque_deposit_bank_acc_no TEXT NULL,
  cheque_deposit_date DATE NULL,
  -- Personal loan fields (only used when payment_type = 'personal_loan')
  personal_loan_deposit_bank_name TEXT NULL,
  personal_loan_deposit_bank_acc_no TEXT NULL,
  personal_loan_deposit_date DATE NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_lease_payment_transactions_collection_id 
ON lease_payment_transactions(lease_collection_id);

-- Enable Row Level Security
ALTER TABLE lease_payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy: Authenticated users can view all transactions
DROP POLICY IF EXISTS "Authenticated users can view lease payment transactions" ON lease_payment_transactions;
CREATE POLICY "Authenticated users can view lease payment transactions" ON lease_payment_transactions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert transactions
DROP POLICY IF EXISTS "Authenticated users can insert lease payment transactions" ON lease_payment_transactions;
CREATE POLICY "Authenticated users can insert lease payment transactions" ON lease_payment_transactions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Authenticated users can update transactions
DROP POLICY IF EXISTS "Authenticated users can update lease payment transactions" ON lease_payment_transactions;
CREATE POLICY "Authenticated users can update lease payment transactions" ON lease_payment_transactions
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can delete transactions
DROP POLICY IF EXISTS "Authenticated users can delete lease payment transactions" ON lease_payment_transactions;
CREATE POLICY "Authenticated users can delete lease payment transactions" ON lease_payment_transactions
  FOR DELETE
  USING (auth.role() = 'authenticated');
