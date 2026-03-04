-- COMPLETE FIX: All Basic Vehicle Columns
-- Run this to ensure ALL required columns exist with correct names

-- Fix manufacturer_year name if wrong
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'manufacture_year'
    ) THEN
        ALTER TABLE vehicles RENAME COLUMN manufacture_year TO manufacturer_year;
    END IF;
END $$;

-- Ensure all basic columns exist
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS chassis_no TEXT,
ADD COLUMN IF NOT EXISTS maker TEXT,
ADD COLUMN IF NOT EXISTS model TEXT,
ADD COLUMN IF NOT EXISTS manufacturer_year INTEGER,
ADD COLUMN IF NOT EXISTS mileage INTEGER,
ADD COLUMN IF NOT EXISTS status TEXT;

-- Add all Japan cost columns (JPY)
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS bid_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS commission_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS insurance_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS inland_transport_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS other_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS other_label TEXT;

-- Add CIF split columns
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS invoice_amount_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS invoice_jpy_to_lkr_rate NUMERIC,
ADD COLUMN IF NOT EXISTS undial_amount_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS undial_jpy_to_lkr_rate NUMERIC;

-- Add local cost columns (LKR)
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

-- Add computed total columns
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS japan_total_lkr NUMERIC,
ADD COLUMN IF NOT EXISTS final_total_lkr NUMERIC;

-- Add timestamp columns
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Show all columns to verify
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
ORDER BY ordinal_position;


