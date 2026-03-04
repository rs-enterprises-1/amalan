'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { User } from '@/lib/supabase'
import Layout from '@/components/Layout'
import AddVehicleForm from '@/components/AddVehicleForm'

export default function AddVehiclePage() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      router.push('/login')
      return
    }
    
    const role = (authUser.user_metadata?.role as 'admin' | 'staff') || 'staff'
    setUser({
      id: authUser.id,
      email: authUser.email!,
      role,
    })
  }

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  // Staff cannot add vehicles
  if (!isAdmin(user)) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
            <p className="text-slate-600">Only administrators can add vehicles.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <AddVehicleForm user={user} />
    </Layout>
  )
}

