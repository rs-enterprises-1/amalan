// Helper script to assign user roles programmatically
// Run this with: npx tsx scripts/assign-role.ts

import { createClient } from '@supabase/supabase-js'

// You'll need to use the service_role key for this (keep it secret!)
// Get it from: Supabase Dashboard → Settings → API → service_role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Add this to .env.local

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function assignUserRole(userEmail: string, role: 'admin' | 'staff') {
  try {
    // Get user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      return
    }

    const user = users.find(u => u.email === userEmail)
    
    if (!user) {
      console.error(`User with email ${userEmail} not found`)
      return
    }

    // Update user metadata
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          role: role
        }
      }
    )

    if (error) {
      console.error('Error updating user:', error)
      return
    }

    console.log(`✅ Successfully assigned role "${role}" to ${userEmail}`)
    console.log('Updated user:', data.user.email)
  } catch (error) {
    console.error('Error:', error)
  }
}

// Usage example:
// assignUserRole('admin@example.com', 'admin')
// assignUserRole('staff@example.com', 'staff')

// Uncomment and modify these lines to assign roles:
// assignUserRole('your-admin-email@example.com', 'admin')
// assignUserRole('your-staff-email@example.com', 'staff')

