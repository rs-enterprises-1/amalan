-- Refresh Supabase Schema Cache
-- Sometimes Supabase caches the schema and needs a refresh

-- This will force Supabase to refresh its schema cache
-- Just run any simple query to trigger a refresh
SELECT 1;

-- Then check the actual columns in your vehicles table
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
ORDER BY ordinal_position;


