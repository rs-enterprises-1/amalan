-- Database Setup Script for Vehicle Management System (NEW SITE)
-- Run this once in your new Supabase project's SQL editor.
-- It creates all tables with the latest structure, including:
-- - Multi-transaction leases
-- - Expenses
-- - Transaction details
-- - User tracking (created_by / created_by_role)
-- - Settings with EMPTY company details (you fill them later)

-- ============================================
-- STEP 1: (OPTIONAL) Drop existing tables
-- Uncomment ONLY if you want to wipe and recreate everything.
-- ============================================

-- DROP TABLE IF EXISTS lease_payment_transactions CASCADE;
-- DROP TABLE IF EXISTS lease_collections CASCADE;
-- DROP TABLE IF EXISTS sales CASCADE;
-- DROP TABLE IF EXISTS advance_payments CASCADE;
-- DROP TABLE IF EXISTS advances CASCADE;
-- DROP TABLE IF EXISTS expenses CASCADE;
-- DROP TABLE IF EXISTS transaction_details CASCADE;
-- DROP TABLE IF EXISTS vehicles CASCADE;
-- DROP TABLE IF EXISTS settings CASCADE;

-- ============================================
-- STEP 2: Core tables
-- ============================================

-- Vehicles Table (latest schema)
CREATE TABLE IF NOT EXISTS vehicles (
  chassis_no TEXT PRIMARY KEY,
  maker TEXT NOT NULL,
  model TEXT NOT NULL,
  manufacturer_year INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'sold', 'not_available')),
  
  -- Japan costs (JPY)
  bid_jpy NUMERIC,
  commission_jpy NUMERIC,
  insurance_jpy NUMERIC,
  inland_transport_jpy NUMERIC,
  other_jpy NUMERIC,
  other_label TEXT,
  
  -- CIF split
  invoice_amount_jpy NUMERIC,
  invoice_jpy_to_lkr_rate NUMERIC,
  undial_amount_jpy NUMERIC,
  undial_jpy_to_lkr_rate NUMERIC,

  -- Undial transfer (optional)
  undial_transfer_has_bank BOOLEAN,
  undial_transfer_bank_name TEXT,
  undial_transfer_acc_no TEXT,
  undial_transfer_date DATE,
  
  -- Local costs (LKR)
  tax_lkr NUMERIC,
  clearance_lkr NUMERIC,
  transport_lkr NUMERIC,
  local_extra1_label TEXT,
  local_extra1_lkr NUMERIC,
  local_extra2_label TEXT,
  local_extra2_lkr NUMERIC,
  local_extra3_label TEXT,
  local_extra3_lkr NUMERIC,
  lc_charges_lkr NUMERIC,
  local_extra4_label TEXT,
  local_extra4_lkr NUMERIC,
  local_extra5_label TEXT,
  local_extra5_lkr NUMERIC,
  
  -- Computed totals
  japan_total_lkr NUMERIC,
  final_total_lkr NUMERIC,

  -- User tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff')),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_role TEXT CHECK (updated_by_role IN ('admin', 'staff')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON vehicles(created_by);
CREATE INDEX IF NOT EXISTS idx_vehicles_updated_by ON vehicles(updated_by);

-- Advances Table
CREATE TABLE IF NOT EXISTS advances (
  chassis_no TEXT PRIMARY KEY REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  expected_sell_price_lkr NUMERIC NOT NULL,

  -- User tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advances_created_by ON advances(created_by);

-- Advance Payments Table
CREATE TABLE IF NOT EXISTS advance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  paid_date DATE NOT NULL,
  amount_lkr NUMERIC NOT NULL,

  -- Bank info (optional, used in reports)
  bank_transferred BOOLEAN,
  bank_name TEXT,

  -- User tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advance_payments_created_by ON advance_payments(created_by);

-- Sales Table (with tracking)
CREATE TABLE IF NOT EXISTS sales (
  chassis_no TEXT PRIMARY KEY REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  sold_price NUMERIC NOT NULL,
  sold_currency TEXT NOT NULL CHECK (sold_currency IN ('JPY', 'LKR')),
  rate_jpy_to_lkr NUMERIC,
  profit NUMERIC,         -- legacy
  profit_lkr NUMERIC,     -- preferred
  sold_date DATE NOT NULL,

  -- Customer / buyer details
  customer_name TEXT,
  customer_address TEXT,
  customer_phone TEXT,
  buyer_name TEXT,
  buyer_address TEXT,
  buyer_phone TEXT,
  customer_id TEXT,

  -- User tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by);

-- Lease Collections Table
CREATE TABLE IF NOT EXISTS lease_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  due_amount_lkr NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  collected BOOLEAN DEFAULT FALSE,
  collected_date DATE,

  -- Legacy single-transaction fields (for old data)
  cheque_amount NUMERIC,
  cheque_no TEXT,
  cheque_deposit_bank_name TEXT,
  cheque_deposit_bank_acc_no TEXT,
  cheque_deposit_date DATE,
  personal_loan_amount NUMERIC,
  personal_loan_deposit_bank_name TEXT,
  personal_loan_deposit_bank_acc_no TEXT,
  personal_loan_deposit_date DATE,

  -- User tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lease_collections_created_by ON lease_collections(created_by);

-- Lease Payment Transactions (multi-transaction support)
CREATE TABLE IF NOT EXISTS lease_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_collection_id UUID NOT NULL REFERENCES lease_collections(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cheque', 'personal_loan')),
  amount NUMERIC(12, 2) NOT NULL,

  -- Cheque fields
  cheque_no TEXT NULL,
  cheque_deposit_bank_name TEXT NULL,
  cheque_deposit_bank_acc_no TEXT NULL,
  cheque_deposit_date DATE NULL,

  -- Personal loan fields
  personal_loan_deposit_bank_name TEXT NULL,
  personal_loan_deposit_bank_acc_no TEXT NULL,
  personal_loan_deposit_date DATE NULL,

  -- User tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lease_payment_transactions_collection_id 
  ON lease_payment_transactions(lease_collection_id);
CREATE INDEX IF NOT EXISTS idx_lease_payment_transactions_created_by 
  ON lease_payment_transactions(created_by);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,

  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('admin', 'staff')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by_role ON expenses(created_by_role);

-- Transaction Details Table
CREATE TABLE IF NOT EXISTS transaction_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'transaction')),
  
  -- Customer details
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  customer_id TEXT,
  
  -- Transaction summary specific
  lease_company TEXT,
  lease_amount NUMERIC,
  payment_method TEXT CHECK (payment_method IN ('cash', 'cheque', 'both', 'bank_transfer')),
  
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
  
  -- Bank transfer (for transaction summary)
  bank_transfer_deposit_date DATE,
  bank_transfer_bank_name TEXT,
  bank_transfer_acc_no TEXT,
  bank_transfer_amount NUMERIC,

  -- User tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_role TEXT CHECK (created_by_role IN ('admin', 'staff')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_details_customer_name ON transaction_details(customer_name);
CREATE INDEX IF NOT EXISTS idx_transaction_details_customer_phone ON transaction_details(customer_phone);
CREATE INDEX IF NOT EXISTS idx_transaction_details_created_by ON transaction_details(created_by);

-- Settings Table (company details LEFT BLANK by default)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT NOT NULL DEFAULT '',      -- blank, you fill later
  company_address TEXT,                       -- blank / NULL
  company_email TEXT,                         -- blank / NULL
  company_telephone TEXT,                     -- blank / NULL
  company_logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert an empty default row if it doesn't exist
INSERT INTO settings (id, company_name, company_address, company_email, company_telephone)
VALUES (1, '', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 3: Enable Row Level Security
-- ============================================

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: RLS Policies
-- (Drop existing policies first to avoid conflicts)
-- ============================================

-- Vehicles
DROP POLICY IF EXISTS "Allow authenticated users" ON vehicles;
CREATE POLICY "Allow authenticated users" ON vehicles
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Advances
DROP POLICY IF EXISTS "Allow authenticated users" ON advances;
CREATE POLICY "Allow authenticated users" ON advances
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Advance Payments
DROP POLICY IF EXISTS "Allow authenticated users" ON advance_payments;
CREATE POLICY "Allow authenticated users" ON advance_payments
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Sales
DROP POLICY IF EXISTS "Allow authenticated users" ON sales;
CREATE POLICY "Allow authenticated users" ON sales
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Lease Collections
DROP POLICY IF EXISTS "Allow authenticated users" ON lease_collections;
CREATE POLICY "Allow authenticated users" ON lease_collections
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Lease Payment Transactions
DROP POLICY IF EXISTS "Authenticated users can view lease payment transactions" ON lease_payment_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert lease payment transactions" ON lease_payment_transactions;
DROP POLICY IF EXISTS "Authenticated users can update lease payment transactions" ON lease_payment_transactions;
DROP POLICY IF EXISTS "Authenticated users can delete lease payment transactions" ON lease_payment_transactions;

CREATE POLICY "Authenticated users can view lease payment transactions" ON lease_payment_transactions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert lease payment transactions" ON lease_payment_transactions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update lease payment transactions" ON lease_payment_transactions
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete lease payment transactions" ON lease_payment_transactions
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Expenses
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON expenses;

CREATE POLICY "Authenticated users can view expenses" ON expenses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert expenses" ON expenses
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own expenses" ON expenses
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated users can delete expenses" ON expenses
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Transaction Details
DROP POLICY IF EXISTS "Allow authenticated users" ON transaction_details;
CREATE POLICY "Allow authenticated users" ON transaction_details
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Settings
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON settings;
DROP POLICY IF EXISTS "Allow admin to update settings" ON settings;
DROP POLICY IF EXISTS "Allow admin to insert settings" ON settings;

CREATE POLICY "Allow authenticated users to read settings" ON settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow admin to update settings" ON settings
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow admin to insert settings" ON settings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

