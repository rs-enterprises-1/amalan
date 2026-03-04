'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { User } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import TaxView from '@/components/TaxView'
import Layout from '@/components/Layout'

export default function TaxPage() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      router.push('/login')
      return
    }
    
    // Check if user is admin
    if (!isAdmin(currentUser)) {
      router.push('/')
      return
    }
    
    setUser(currentUser)
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

  return (
    <Layout>
      <TaxView user={user} />
    </Layout>
  )
}
