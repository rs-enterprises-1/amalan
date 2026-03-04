'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { User } from '@/lib/supabase'
import Layout from '@/components/Layout'
import AvailableVehiclesList from '@/components/AvailableVehiclesList'
import NotAvailableVehiclesList from '@/components/NotAvailableVehiclesList'

export default function AvailableVehiclesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<'available' | 'not-available' | 'reserved'>('available')
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">Inventory Management</h1>
          <p className="text-slate-600 text-sm">Track in-stock and reserved vehicles</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'available'
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setActiveTab('reserved')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'reserved'
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reserved
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'available' && <AvailableVehiclesList user={user} showReservedBadge={true} />}
        {activeTab === 'reserved' && <ReservedVehiclesList user={user} />}
      </div>
    </Layout>
  )
}

// Reserved vehicles are available vehicles with advances - show them like in stock
function ReservedVehiclesList({ user }: { user: User }) {
  return <AvailableVehiclesList user={user} showReservedOnly={true} />
}


