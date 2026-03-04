-- Fix buy_currency column in vehicles table

-- Option 1: If buy_currency column doesn't exist, add it
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS buy_currency TEXT CHECK (buy_currency IN ('JPY', 'LKR'));

-- Option 2: If buy_currency exists but has NOT NULL constraint and you want to make it nullable:
-- ALTER TABLE vehicles ALTER COLUMN buy_currency DROP NOT NULL;

-- Option 3: If buy_currency exists with NOT NULL and you want to set a default value:
-- ALTER TABLE vehicles ALTER COLUMN buy_currency SET DEFAULT 'LKR';

-- Option 4: Update existing records to set buy_currency = 'LKR' if it's null
UPDATE vehicles 
SET buy_currency = 'LKR' 
WHERE buy_currency IS NULL;

-- Verify the column
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name = 'buy_currency';


