-- Fix buy_price column in vehicles table
-- If buy_price doesn't exist, add it. If it exists but is nullable, make it nullable or set default.

-- Option 1: If buy_price column doesn't exist, add it
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS buy_price NUMERIC;

-- Option 2: If buy_price exists but has NOT NULL constraint and you want to make it nullable:
-- ALTER TABLE vehicles ALTER COLUMN buy_price DROP NOT NULL;

-- Option 3: If buy_price exists with NOT NULL and you want to set a default value:
-- ALTER TABLE vehicles ALTER COLUMN buy_price SET DEFAULT 0;

-- Option 4: Update existing records to set buy_price = japan_total_lkr if buy_price is null
UPDATE vehicles 
SET buy_price = japan_total_lkr 
WHERE buy_price IS NULL AND japan_total_lkr IS NOT NULL;

-- Verify the column
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name = 'buy_price';


