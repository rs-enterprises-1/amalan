-- Add new fields to lease_collections table for cheque and personal loan tracking
ALTER TABLE lease_collections
ADD COLUMN IF NOT EXISTS cheque_amount NUMERIC(12, 2) NULL,
ADD COLUMN IF NOT EXISTS personal_loan_amount NUMERIC(12, 2) NULL,
ADD COLUMN IF NOT EXISTS cheque_no TEXT NULL,
ADD COLUMN IF NOT EXISTS cheque_deposit_bank_name TEXT NULL,
ADD COLUMN IF NOT EXISTS cheque_deposit_bank_acc_no TEXT NULL,
ADD COLUMN IF NOT EXISTS cheque_deposit_date DATE NULL,
ADD COLUMN IF NOT EXISTS personal_loan_deposit_bank_name TEXT NULL,
ADD COLUMN IF NOT EXISTS personal_loan_deposit_bank_acc_no TEXT NULL,
ADD COLUMN IF NOT EXISTS personal_loan_deposit_date DATE NULL;

