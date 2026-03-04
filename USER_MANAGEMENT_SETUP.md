# User Management Setup

## Overview

The Settings page now includes user management features:
1. **Add Users** (Admin only) - Create new user accounts with email, password, and role
2. **Change Password** - Update your own password

## Environment Variables Required

For user creation to work, you need to add the Supabase Service Role Key to your environment variables:

### For Local Development (.env.local)

Add this line to your `.env.local` file:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### For Netlify Deployment

1. Go to your Netlify dashboard
2. Navigate to: **Site settings** → **Environment variables**
3. Add a new variable:
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Your Supabase service role key (get it from Supabase Dashboard → Settings → API → service_role key)

### How to Get Your Service Role Key

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Find the **service_role** key (keep this secret! Never expose it in client-side code)
5. Copy the key and add it to your environment variables

## Security Notes

⚠️ **Important**: The service role key has admin privileges and should:
- ✅ Only be used in server-side code (API routes)
- ✅ Never be exposed to the client
- ✅ Never be committed to version control
- ✅ Be kept secret and secure

## Features

### Add Users (Admin Only)

- **Location**: Settings → Add Users tab
- **Required Fields**:
  - Email address
  - Password (minimum 6 characters)
  - Role (Admin or Staff)
- **Access**: Only users with `admin` role can access this feature

### Change Password

- **Location**: Settings → Change Password tab
- **Required Fields**:
  - New Password (minimum 6 characters)
  - Confirm New Password
- **Access**: All logged-in users can change their own password
- **Note**: After changing password, you will be automatically logged out and redirected to the login page

## API Routes

The following API routes are created:

1. **POST /api/users/create** - Create a new user (admin only)
2. **POST /api/users/change-password** - Change current user's password

Both routes require authentication and validate the user's permissions.

## Troubleshooting

### "Server configuration error: Service role key not found"

- Make sure you've added `SUPABASE_SERVICE_ROLE_KEY` to your environment variables
- Restart your development server after adding the variable
- For Netlify, make sure the variable is set in the dashboard and redeploy

### "Forbidden: Admin access required"

- Only users with `admin` role can create new users
- Check your user's role in Supabase Dashboard → Authentication → Users

### "Failed to create user"

- Check that the email is valid and not already in use
- Ensure password meets minimum requirements (6 characters)
- Check Supabase logs for detailed error messages
