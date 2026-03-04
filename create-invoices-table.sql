-- Create invoices table to store all invoice details
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  sale_id TEXT REFERENCES sales(chassis_no) ON DELETE CASCADE,
  
  -- Invoice details
  invoice_date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  
  -- Vehicle details
  vehicle_maker TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year INTEGER,
  vehicle_mileage INTEGER,
  engine_no TEXT,
  engine_capacity TEXT,
  colour TEXT,
  fuel_type TEXT,
  seating_capacity INTEGER,
  
  -- Pricing
  vehicle_price NUMERIC NOT NULL,
  vehicle_price_currency TEXT NOT NULL CHECK (vehicle_price_currency IN ('JPY', 'LKR')),
  total_advance NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  
  -- Invoice data (JSON to store all details)
  invoice_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_chassis_no ON invoices(chassis_no);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DROP POLICY IF EXISTS "Allow authenticated users" ON invoices;
CREATE POLICY "Allow authenticated users" ON invoices
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


