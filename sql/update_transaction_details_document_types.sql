-- Update transaction_details table to support cost-calculation and tax-sheet document types
-- Run this in Supabase SQL Editor

-- Drop the existing CHECK constraint
ALTER TABLE transaction_details 
DROP CONSTRAINT IF EXISTS transaction_details_document_type_check;

-- Add new CHECK constraint with all document types
ALTER TABLE transaction_details 
ADD CONSTRAINT transaction_details_document_type_check 
CHECK (document_type IN ('invoice', 'transaction', 'cost-calculation', 'tax-sheet'));

-- Add unique constraint on chassis_no and document_type to prevent duplicates
-- This allows multiple document types per vehicle but only one of each type
CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_details_chassis_doc_type 
ON transaction_details(chassis_no, document_type);
