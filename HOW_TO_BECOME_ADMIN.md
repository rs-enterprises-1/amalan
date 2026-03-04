# How to Change Your User Role to Admin

## Method 1: Using Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard**
   - Open https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication**
   - Click "Authentication" in the left sidebar
   - Click "Users" tab

3. **Find Your User**
   - Look for your email address in the list
   - Click on your email to open user details

4. **Edit User Metadata**
   - Scroll down to "User Metadata" section
   - Look for a field called `role`
   - If it doesn't exist, click "Add new field"
   - Set:
     - **Key**: `role`
     - **Value**: `admin`
   - Click "Save"

5. **Verify**
   - The role should now show as `admin` in the metadata
   - Logout and login again to your app
   - You should now see admin features

---

## Method 2: Using SQL (Alternative)

If you prefer SQL, run this in Supabase SQL Editor:

```sql
-- Update user role to admin
-- Replace 'your-email@example.com' with your actual email
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'your-email@example.com';

-- Verify the change
SELECT 
  email,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'your-email@example.com';
```

---

## Method 3: Using Supabase Client (Programmatic)

If you want to do it programmatically, you can run this in your browser console while logged in:

```javascript
// In browser console (F12) on your app
const { data: { user } } = await supabase.auth.getUser()
console.log('Current user:', user)

// Note: You can't directly update your own metadata via client
// You need to use the dashboard or have a server-side function
```

---

## After Changing Role

1. **Logout** from your app
2. **Login** again
3. **Check** the sidebar - it should show "ADMIN" badge
4. **Verify** you can see:
   - Monthly Profit on Dashboard
   - "Sell Now" buttons
   - Profit columns in reports

---

## Troubleshooting

### If role doesn't update:
1. Make sure you saved the metadata in Supabase
2. Clear browser cache and cookies
3. Logout and login again
4. Check browser console for any errors

### If you see "staff" instead of "admin":
1. Double-check the metadata value is exactly `admin` (lowercase, no quotes in the value field)
2. Make sure there are no extra spaces
3. Try logging out and back in

### Quick Test:
After updating, check in browser console:
```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser()
console.log('Role:', user?.user_metadata?.role)
```

It should show `admin`.


