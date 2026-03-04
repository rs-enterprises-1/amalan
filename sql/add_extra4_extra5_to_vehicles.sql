-- Add local_extra4 and local_extra5 columns to vehicles table
-- Run this in Supabase SQL Editor

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS local_extra4_label TEXT,
ADD COLUMN IF NOT EXISTS local_extra4_lkr NUMERIC,
ADD COLUMN IF NOT EXISTS local_extra5_label TEXT,
ADD COLUMN IF NOT EXISTS local_extra5_lkr NUMERIC;
