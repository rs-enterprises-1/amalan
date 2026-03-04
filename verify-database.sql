-- Verify Database Schema
-- Run this to check if all required columns exist

-- Check Vehicles Table
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
ORDER BY ordinal_position;

-- Check if specific columns exist
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'final_total_lkr'
    ) THEN 'EXISTS' ELSE 'MISSING' END as final_total_lkr_status,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'japan_total_lkr'
    ) THEN 'EXISTS' ELSE 'MISSING' END as japan_total_lkr_status;


