-- Create settings table to store company branding and system settings
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT NOT NULL DEFAULT 'R.S.Enterprises',
  company_address TEXT,
  company_email TEXT,
  company_telephone TEXT,
  company_logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default row if it doesn't exist
INSERT INTO settings (id, company_name)
VALUES (1, 'R.S.Enterprises')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON settings;
CREATE POLICY "Allow authenticated users to read settings" ON settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow admin to update settings" ON settings;
CREATE POLICY "Allow admin to update settings" ON settings
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow admin to insert settings" ON settings;
CREATE POLICY "Allow admin to insert settings" ON settings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
