-- Add lc_charges_lkr field and migrate existing LC Charges data
-- Run this in Supabase SQL Editor

-- Step 1: Add the lc_charges_lkr column if it doesn't exist
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS lc_charges_lkr NUMERIC;

-- Step 2: Migrate existing LC Charges data from local_extra2 to lc_charges_lkr
-- This moves data where local_extra2_label matches LC Charges variations
-- Handles: 'LC Charges', 'L/C CHGS', 'LC CHGS', 'L.C. CHGS', etc.
UPDATE vehicles
SET lc_charges_lkr = local_extra2_lkr
WHERE (
  UPPER(TRIM(local_extra2_label)) = 'LC CHARGES' OR
  UPPER(TRIM(local_extra2_label)) = 'L/C CHGS' OR
  UPPER(TRIM(local_extra2_label)) = 'LC CHGS' OR
  UPPER(TRIM(local_extra2_label)) = 'L.C. CHGS' OR
  UPPER(TRIM(local_extra2_label)) LIKE 'LC%CHARGES%' OR
  UPPER(TRIM(local_extra2_label)) LIKE 'L/C%CHGS%' OR
  UPPER(TRIM(local_extra2_label)) LIKE 'L.C.%CHGS%'
)
  AND local_extra2_lkr IS NOT NULL
  AND (lc_charges_lkr IS NULL OR lc_charges_lkr = 0);

-- Step 3: Clear the old LC Charges data from local_extra2 fields
-- Only clear if we successfully migrated the data
UPDATE vehicles
SET local_extra2_label = NULL,
    local_extra2_lkr = NULL
WHERE (
  UPPER(TRIM(local_extra2_label)) = 'LC CHARGES' OR
  UPPER(TRIM(local_extra2_label)) = 'L/C CHGS' OR
  UPPER(TRIM(local_extra2_label)) = 'LC CHGS' OR
  UPPER(TRIM(local_extra2_label)) = 'L.C. CHGS' OR
  UPPER(TRIM(local_extra2_label)) LIKE 'LC%CHARGES%' OR
  UPPER(TRIM(local_extra2_label)) LIKE 'L/C%CHGS%' OR
  UPPER(TRIM(local_extra2_label)) LIKE 'L.C.%CHGS%'
)
  AND lc_charges_lkr IS NOT NULL;

-- Verify the migration
SELECT 
  chassis_no,
  local_extra2_label,
  local_extra2_lkr,
  lc_charges_lkr
FROM vehicles
WHERE (
  UPPER(TRIM(local_extra2_label)) LIKE '%LC%CHARGES%' OR
  UPPER(TRIM(local_extra2_label)) LIKE '%L/C%CHGS%' OR
  UPPER(TRIM(local_extra2_label)) LIKE '%L.C.%CHGS%' OR
  lc_charges_lkr IS NOT NULL
)
LIMIT 10;
