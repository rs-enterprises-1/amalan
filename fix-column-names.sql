-- Fix Column Name Mismatches
-- This script fixes common column name issues

-- Check if manufacture_year exists (wrong name) and rename it
DO $$ 
BEGIN
    -- Check if wrong name exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'manufacture_year'
    ) THEN
        -- Rename to correct name
        ALTER TABLE vehicles RENAME COLUMN manufacture_year TO manufacturer_year;
    END IF;
END $$;

-- Ensure manufacturer_year exists with correct name
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS manufacturer_year INTEGER;

-- If the old wrong column still exists after rename attempt, drop it
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'manufacture_year'
    ) THEN
        ALTER TABLE vehicles DROP COLUMN manufacture_year;
    END IF;
END $$;

-- Verify the correct column exists
SELECT 
    column_name, 
    data_type,
    CASE WHEN column_name = 'manufacturer_year' THEN '✓ CORRECT' ELSE 'CHECK' END as status
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND (column_name LIKE '%manufactur%' OR column_name LIKE '%year%')
ORDER BY column_name;


