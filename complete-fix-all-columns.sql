-- COMPLETE FIX: Add ALL Missing Columns to Vehicles Table
-- Run this ENTIRE script in Supabase SQL Editor

-- Step 1: Add all Japan cost columns (JPY)
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS bid_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS commission_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS insurance_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS inland_transport_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS other_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS other_label TEXT;

-- Step 2: Add CIF split columns
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS invoice_amount_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS invoice_jpy_to_lkr_rate NUMERIC,
ADD COLUMN IF NOT EXISTS undial_amount_jpy NUMERIC,
ADD COLUMN IF NOT EXISTS undial_jpy_to_lkr_rate NUMERIC;

-- Step 3: Add local cost columns (LKR)
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

-- Step 4: Add computed total columns
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS japan_total_lkr NUMERIC,
ADD COLUMN IF NOT EXISTS final_total_lkr NUMERIC;

-- Step 5: Verify all columns were added
SELECT 
    column_name, 
    data_type,
    CASE 
        WHEN column_name IN (
            'bid_jpy', 'commission_jpy', 'insurance_jpy', 'inland_transport_jpy', 
            'other_jpy', 'other_label', 'invoice_amount_jpy', 'invoice_jpy_to_lkr_rate',
            'undial_amount_jpy', 'undial_jpy_to_lkr_rate', 'tax_lkr', 'clearance_lkr',
            'transport_lkr', 'local_extra1_label', 'local_extra1_lkr', 'local_extra2_label',
            'local_extra2_lkr', 'local_extra3_label', 'local_extra3_lkr', 'japan_total_lkr',
            'final_total_lkr'
        ) THEN '✓ REQUIRED'
        ELSE 'OTHER'
    END as status
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
ORDER BY 
    CASE WHEN column_name IN (
        'bid_jpy', 'commission_jpy', 'insurance_jpy', 'inland_transport_jpy', 
        'other_jpy', 'other_label', 'invoice_amount_jpy', 'invoice_jpy_to_lkr_rate',
        'undial_amount_jpy', 'undial_jpy_to_lkr_rate', 'tax_lkr', 'clearance_lkr',
        'transport_lkr', 'local_extra1_label', 'local_extra1_lkr', 'local_extra2_label',
        'local_extra2_lkr', 'local_extra3_label', 'local_extra3_lkr', 'japan_total_lkr',
        'final_total_lkr'
    ) THEN 0 ELSE 1 END,
    column_name;


