-- Create tax_details table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS tax_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  total_cost_lkr NUMERIC NOT NULL,
  undial_amount_lkr NUMERIC NOT NULL,
  total_cost_without_undial NUMERIC NOT NULL,
  expected_profit NUMERIC NOT NULL,
  cost_with_profit NUMERIC NOT NULL,
  sscl NUMERIC NOT NULL,
  cost_with_profit_sscl NUMERIC NOT NULL,
  vat_to_be_paid NUMERIC NOT NULL,
  paid_vat NUMERIC NOT NULL,
  vat_difference NUMERIC NOT NULL,
  sold_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chassis_no)
);

-- Enable RLS
ALTER TABLE tax_details ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can access (admin only in app logic)
DROP POLICY IF EXISTS "Authenticated users can access tax details" ON tax_details;
CREATE POLICY "Authenticated users can access tax details" ON tax_details
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Create index
CREATE INDEX IF NOT EXISTS idx_tax_details_chassis ON tax_details(chassis_no);
