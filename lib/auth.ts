import { supabase, User, UserRole } from './supabase'

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null
  
  // In a real app, you'd fetch the role from a user_metadata or profiles table
  // For now, we'll check user metadata
  const role = (user.user_metadata?.role as UserRole) || 'staff'
  
  return {
    id: user.id,
    email: user.email!,
    role,
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth()
  if (user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }
  return user
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin'
}


