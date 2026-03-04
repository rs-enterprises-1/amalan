-- Add registration_no column to vehicles table
-- Run this in Supabase SQL Editor

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS registration_no TEXT;

-- Add comment for documentation
COMMENT ON COLUMN vehicles.registration_no IS 'Vehicle registration number (used for Sri Lanka purchases when enable_sri_lanka_purchase is enabled and buy_currency is LKR)';
