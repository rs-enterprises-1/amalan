-- Add user tracking to all tables that staff can modify
-- Run this in Supabase SQL Editor

-- 1. Advance Payments (already created, but adding if not exists)
ALTER TABLE advance_payments
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_advance_payments_created_by ON advance_payments(created_by);

-- 2. Sales (mark sold)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by);

-- 3. Lease Collections
ALTER TABLE lease_collections
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_lease_collections_created_by ON lease_collections(created_by);

-- 4. Lease Payment Transactions
ALTER TABLE lease_payment_transactions
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_lease_payment_transactions_created_by ON lease_payment_transactions(created_by);

-- 5. Vehicles (track who added/updated)
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff')),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by_role TEXT CHECK (updated_by_role IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON vehicles(created_by);
CREATE INDEX IF NOT EXISTS idx_vehicles_updated_by ON vehicles(updated_by);

-- 6. Advances (track who created)
ALTER TABLE advances
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_advances_created_by ON advances(created_by);

-- 7. Invoices (if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff'));
    
    CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
  END IF;
END $$;

-- 8. Transaction Details (if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transaction_details') THEN
    ALTER TABLE transaction_details
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff'));
    
    CREATE INDEX IF NOT EXISTS idx_transaction_details_created_by ON transaction_details(created_by);
  END IF;
END $$;

-- Verify the changes
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN (
  'advance_payments',
  'sales',
  'lease_collections',
  'lease_payment_transactions',
  'vehicles',
  'advances',
  'invoices',
  'transaction_details'
)
AND column_name IN ('created_by', 'created_by_role', 'updated_by', 'updated_by_role')
ORDER BY table_name, column_name;
