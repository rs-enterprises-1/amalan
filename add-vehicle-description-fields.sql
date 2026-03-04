-- Add vehicle description fields to vehicles table
-- Run this in Supabase SQL Editor

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS engine_no TEXT,
ADD COLUMN IF NOT EXISTS engine_capacity TEXT,
ADD COLUMN IF NOT EXISTS colour TEXT,
ADD COLUMN IF NOT EXISTS fuel_type TEXT,
ADD COLUMN IF NOT EXISTS seating_capacity INTEGER;


