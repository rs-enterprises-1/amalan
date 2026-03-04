-- Fix Year Column Issue
-- The database might have 'year' but code expects 'manufacturer_year'

-- Option 1: If 'year' exists, rename it to 'manufacturer_year'
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'year'
    ) THEN
        -- Rename year to manufacturer_year
        ALTER TABLE vehicles RENAME COLUMN year TO manufacturer_year;
    END IF;
END $$;

-- Option 2: If 'manufacture_year' exists (wrong spelling), rename it
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

-- Option 3: Ensure manufacturer_year exists with correct name
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS manufacturer_year INTEGER;

-- If old 'year' column still exists and we created manufacturer_year, drop the old one
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'year'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'manufacturer_year'
    ) THEN
        -- Remove NOT NULL constraint first if it exists
        ALTER TABLE vehicles ALTER COLUMN year DROP NOT NULL;
        -- Then drop the old column
        ALTER TABLE vehicles DROP COLUMN year;
    END IF;
END $$;

-- Verify the correct column exists
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND (column_name LIKE '%year%' OR column_name = 'year')
ORDER BY column_name;


