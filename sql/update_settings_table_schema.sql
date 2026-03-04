-- Update settings table schema to match new requirements
-- Run this in Supabase SQL Editor after creating the initial table

-- Add new columns (one at a time)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS company_email TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS company_telephone TEXT;

-- Remove old columns (if they exist, one at a time)
ALTER TABLE settings DROP COLUMN IF EXISTS br_no;
ALTER TABLE settings DROP COLUMN IF EXISTS tin;
ALTER TABLE settings DROP COLUMN IF EXISTS phone_numbers;
ALTER TABLE settings DROP COLUMN IF EXISTS header_logo_url;

-- Update existing row with default values if needed
UPDATE settings 
SET 
  company_address = COALESCE(company_address, 'No.164/B,Nittambuwa Road,Paththalagedara,Veyangoda'),
  company_email = COALESCE(company_email, 'rsenterprises59@gmail.com'),
  company_telephone = COALESCE(company_telephone, '0773073156,0332245886')
WHERE id = 1;
