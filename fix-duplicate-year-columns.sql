-- Fix Duplicate Year Columns
-- Both 'year' and 'manufacturer_year' exist - we need to merge them

-- Step 1: Copy data from 'year' to 'manufacturer_year' if manufacturer_year is NULL
UPDATE vehicles 
SET manufacturer_year = year 
WHERE manufacturer_year IS NULL AND year IS NOT NULL;

-- Step 2: Make sure manufacturer_year has NOT NULL constraint
ALTER TABLE vehicles 
ALTER COLUMN manufacturer_year SET NOT NULL;

-- Step 3: Drop the old 'year' column
ALTER TABLE vehicles DROP COLUMN IF EXISTS year;

-- Step 4: Also drop 'manufacture_year' if it exists (wrong spelling)
ALTER TABLE vehicles DROP COLUMN IF EXISTS manufacture_year;

-- Verify: Should only see manufacturer_year now
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND (column_name LIKE '%year%' OR column_name = 'year')
ORDER BY column_name;


