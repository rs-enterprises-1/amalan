-- Add Invoice/Vehicle Description Fields to Vehicles Table
-- Run this in Supabase SQL Editor

-- Add vehicle description fields for invoices
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS engine_no TEXT,
ADD COLUMN IF NOT EXISTS engine_capacity TEXT,
ADD COLUMN IF NOT EXISTS colour TEXT,
ADD COLUMN IF NOT EXISTS fuel_type TEXT,
ADD COLUMN IF NOT EXISTS seating_capacity TEXT;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name IN ('engine_no', 'engine_capacity', 'colour', 'fuel_type', 'seating_capacity')
ORDER BY column_name;

