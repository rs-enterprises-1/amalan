-- Fix All Vehicle Table Columns
-- Run this in Supabase SQL Editor to ensure all columns exist with correct names

-- Add all Japan cost columns (JPY) if they don't exist
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS bid_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS commission_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS insurance_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS inland_transport_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS other_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS other_label TEXT;

-- Add CIF split columns if they don't exist
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS invoice_amount_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS invoice_jpy_to_lkr_rate NUMERIC,
ADD COLUMN IF NOT EXISTS undial_amount_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS undial_jpy_to_lkr_rate NUMERIC;

-- Add local cost columns (LKR) if they don't exist
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS tax_lkr NUMERIC,
ADD COLUMN IF NOT EXISTS clearance_lkr NUMERIC,
ADD COLUMN IF NOT EXISTS transport_lkr NUMERIC,
ADD COLUMN IF NOT EXISTS local_extra1_label TEXT,
ADD COLUMN IF NOT EXISTS local_extra1_lkr NUMERIC,
ADD COLUMN IF NOT EXISTS local_extra2_label TEXT,
ADD COLUMN IF NOT EXISTS local_extra2_lkr NUMERIC,
ADD COLUMN IF NOT EXISTS local_extra3_label TEXT,
ADD COLUMN IF NOT EXISTS local_extra3_lkr NUMERIC;

-- Add computed total columns if they don't exist
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS japan_total_lkr NUMERIC,
ADD COLUMN IF NOT EXISTS final_total_lkr NUMERIC;

-- Verify all columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name LIKE '%jpy%' OR column_name LIKE '%lkr%'
ORDER BY column_name;


