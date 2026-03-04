-- Add "not_available" workflow + Undial transfer bank fields
-- Run in Supabase SQL Editor.

-- 1) Allow status = 'not_available' (recreate CHECK constraint safely)
DO $$
BEGIN
  -- Drop old constraint if exists (name may vary)
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.vehicles'::regclass
      AND contype = 'c'
      AND conname = 'vehicles_status_check'
  ) THEN
    ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_status_check;
  END IF;

  -- Add new constraint
  ALTER TABLE public.vehicles
    ADD CONSTRAINT vehicles_status_check
    CHECK (status IN ('available', 'sold', 'not_available'));
END $$;

-- 2) Add undial transfer bank fields (all optional)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS undial_transfer_has_bank BOOLEAN,
  ADD COLUMN IF NOT EXISTS undial_transfer_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS undial_transfer_acc_no TEXT,
  ADD COLUMN IF NOT EXISTS undial_transfer_date DATE;

