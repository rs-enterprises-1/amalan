'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { User } from '@/lib/supabase'
import { getCompanySettings } from '@/lib/settings'
import Layout from './Layout'
import { 
  PlusCircle, 
  Car, 
  CheckCircle, 
  Receipt, 
  FileText,
  TrendingUp,
  DollarSign,
  Calendar,
  Clock,
  AlertTriangle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState({
    vehiclesSoldThisMonth: 0,
    totalAdvanceMoney: 0,
    leaseMoneyToCollect: 0,
    monthlyProfit: 0,
    netRevenue: 0,
    vehiclesInStock: 0,
    pendingPayments: 0,
  })
  const [performanceData, setPerformanceData] = useState<Array<{ date: string; revenue: number; grossProfit: number }>>([])
  const [stockAging, setStockAging] = useState({
    fresh: 0,
    stable: 0,
    warning: 0,
    critical: 0,
  })
  const [enableProfitIntelligence, setEnableProfitIntelligence] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
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

    // Load settings (profit intelligence toggle)
    const settings = await getCompanySettings()
    setEnableProfitIntelligence(settings.enable_profit_intelligence ?? false)

    // Load dashboard stats
    await Promise.all([
      loadVehiclesSoldThisMonth(),
      loadTotalAdvanceMoney(),
      loadLeaseMoneyToCollect(),
      loadMonthlyProfit(role),
      loadNetRevenue(),
      loadVehiclesInStock(),
      loadPendingPayments(),
      loadPerformanceData(),
      loadStockAging(),
    ])
    
    setLoading(false)
  }

  async function loadVehiclesSoldThisMonth() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const { count } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .gte('sold_date', startOfMonth.toISOString().split('T')[0])
    
    setStats(prev => ({ ...prev, vehiclesSoldThisMonth: count || 0 }))
  }

  async function loadTotalAdvanceMoney() {
    // Get all available vehicles (not sold)
    const { data: availableVehicles } = await supabase
      .from('vehicles')
      .select('chassis_no')
      .eq('status', 'available')
    
    if (!availableVehicles || availableVehicles.length === 0) {
      setStats(prev => ({ ...prev, totalAdvanceMoney: 0 }))
      return
    }
    
    // Get advance payments only for available vehicles
    const chassisNos = availableVehicles.map(v => v.chassis_no)
    const { data } = await supabase
      .from('advance_payments')
      .select('amount_lkr')
      .in('chassis_no', chassisNos)
    
    const total = data?.reduce((sum, payment) => sum + (payment.amount_lkr || 0), 0) || 0
    setStats(prev => ({ ...prev, totalAdvanceMoney: total }))
  }

  async function loadLeaseMoneyToCollect() {
    // Load uncollected leases and their transactions in parallel
    const [leaseResult, transactionsResult] = await Promise.all([
      supabase
        .from('lease_collections')
        .select('*')
        .eq('collected', false),
      supabase
        .from('lease_payment_transactions')
        .select('*')
    ])
    
    const leaseData = leaseResult.data || []
    
    if (leaseData.length === 0) {
      setStats(prev => ({ ...prev, leaseMoneyToCollect: 0 }))
      return
    }

    // Group transactions by lease_collection_id
    const transactionsData = transactionsResult.data || []
    const transactionsMap = new Map<string, any[]>()
    transactionsData.forEach(t => {
      const existing = transactionsMap.get(t.lease_collection_id) || []
      existing.push(t)
      transactionsMap.set(t.lease_collection_id, existing)
    })

    // Calculate remaining amount for each collection
    const total = leaseData.reduce((sum, lease) => {
      const transactions = transactionsMap.get(lease.id) || []
      let totalCollected = transactions.reduce((s, t) => s + (t.amount || 0), 0)
      
      // Include legacy transactions if no new transactions exist
      if (transactions.length === 0) {
        if (lease.cheque_amount && lease.cheque_amount > 0) {
          totalCollected += lease.cheque_amount
        }
        if (lease.personal_loan_amount && lease.personal_loan_amount > 0) {
          totalCollected += lease.personal_loan_amount
        }
      }
      
      const remaining = lease.due_amount_lkr - totalCollected
      return sum + (remaining > 0 ? remaining : 0)
    }, 0)
    
    setStats(prev => ({ ...prev, leaseMoneyToCollect: total }))
  }

  async function loadMonthlyProfit(role: 'admin' | 'staff') {
    if (role !== 'admin') return
    
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const { data } = await supabase
      .from('sales')
      .select('profit') // Database uses 'profit' (in LKR)
      .gte('sold_date', startOfMonth.toISOString().split('T')[0])
    
    // Each sale row only has "profit" (already in LKR)
    const total = data?.reduce((sum, sale) => sum + (sale.profit || 0), 0) || 0
    setStats(prev => ({ ...prev, monthlyProfit: total }))
  }

  async function loadNetRevenue() {
    const now = new Date()
    const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const { data } = await supabase
      .from('sales')
      .select('sold_price, sold_currency, rate_jpy_to_lkr')
      .gte('sold_date', startOf30Days.toISOString().split('T')[0])
    
    const total = data?.reduce((sum, sale) => {
      const priceLkr = sale.sold_currency === 'JPY' 
        ? (sale.sold_price || 0) * (sale.rate_jpy_to_lkr || 1)
        : (sale.sold_price || 0)
      return sum + priceLkr
    }, 0) || 0
    
    setStats(prev => ({ ...prev, netRevenue: total }))
  }

  async function loadVehiclesInStock() {
    const { count } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'available')
    
    setStats(prev => ({ ...prev, vehiclesInStock: count || 0 }))
  }

  async function loadPendingPayments() {
    // Load all sales and advance payments in parallel
    const [salesResult, paymentsResult] = await Promise.all([
      supabase
        .from('sales')
        .select('chassis_no, sold_price, sold_currency, rate_jpy_to_lkr'),
      supabase
        .from('advance_payments')
        .select('chassis_no, amount_lkr')
    ])
    
    const sales = salesResult.data || []
    const payments = paymentsResult.data || []
    
    // Group advance payments by chassis_no
    const paymentsByChassis = new Map<string, number>()
    payments.forEach(p => {
      const existing = paymentsByChassis.get(p.chassis_no) || 0
      paymentsByChassis.set(p.chassis_no, existing + (p.amount_lkr || 0))
    })
    
    // Calculate total pending
    let totalPending = 0
    sales.forEach(sale => {
      const soldPriceLkr = sale.sold_currency === 'JPY'
        ? (sale.sold_price || 0) * (sale.rate_jpy_to_lkr || 1)
        : (sale.sold_price || 0)
      
      const totalAdvance = paymentsByChassis.get(sale.chassis_no) || 0
      const pending = soldPriceLkr - totalAdvance
      
      if (pending > 0) {
        totalPending += pending
      }
    })
    
    setStats(prev => ({ ...prev, pendingPayments: totalPending }))
  }

  async function loadPerformanceData() {
    const now = new Date()
    const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const { data: sales } = await supabase
      .from('sales')
      .select('sold_date, sold_price, sold_currency, rate_jpy_to_lkr, profit')
      .gte('sold_date', startOf30Days.toISOString().split('T')[0])
      .order('sold_date', { ascending: true })
    
    // Group by date
    const dailyData = new Map<string, { revenue: number; grossProfit: number }>()
    
    sales?.forEach(sale => {
      const date = sale.sold_date
      const soldPriceLkr = sale.sold_currency === 'JPY'
        ? (sale.sold_price || 0) * (sale.rate_jpy_to_lkr || 1)
        : (sale.sold_price || 0)
      const profit = sale.profit || 0
      
      const existing = dailyData.get(date) || { revenue: 0, grossProfit: 0 }
      dailyData.set(date, {
        revenue: existing.revenue + soldPriceLkr,
        grossProfit: existing.grossProfit + profit,
      })
    })
    
    // Convert to array and fill missing dates
    const result: Array<{ date: string; revenue: number; grossProfit: number }> = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      const data = dailyData.get(dateStr) || { revenue: 0, grossProfit: 0 }
      result.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: data.revenue,
        grossProfit: data.grossProfit,
      })
    }
    
    setPerformanceData(result)
  }

  async function loadStockAging() {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select(`
        created_at,
        tax_lkr,
        clearance_lkr,
        transport_lkr,
        local_extra1_label,
        local_extra1_lkr,
        local_extra2_lkr,
        local_extra3_lkr
      `)
      .eq('status', 'available')
    
    const now = new Date()
    let fresh = 0, stable = 0, warning = 0, critical = 0
    
    vehicles?.forEach((vehicle: any) => {
      // Same rule as available list: consider Sri Lanka only if real local costs (excluding pure LC commission)
      const tax = vehicle.tax_lkr || 0
      const clearance = vehicle.clearance_lkr || 0
      const transport = vehicle.transport_lkr || 0

      const extra1Label = vehicle.local_extra1_label || ''
      const extra1 = (extra1Label === 'LC Commission' || extra1Label === '') ? 0 : (vehicle.local_extra1_lkr || 0)
      const extra2 = vehicle.local_extra2_lkr || 0
      const extra3 = vehicle.local_extra3_lkr || 0

      const hasAnyLocalCost =
        tax > 0 ||
        clearance > 0 ||
        transport > 0 ||
        extra1 > 0 ||
        extra2 > 0 ||
        extra3 > 0

      if (!hasAnyLocalCost) {
        // Still in Japan â†’ ignore in stock analysis
        return
      }

      const created = new Date(vehicle.created_at)
      const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysDiff <= 30) fresh++
      else if (daysDiff <= 60) stable++
      else if (daysDiff <= 90) warning++
      else critical++
    })
    
    setStockAging({ fresh, stable, warning, critical })
  }

  const quickActions = [
    { href: '/add-vehicle', label: 'Add Vehicle', icon: PlusCircle, adminOnly: true },
    { href: '/available', label: 'Available Vehicles', icon: Car, adminOnly: false },
    { href: '/sold', label: 'Sold Vehicles', icon: CheckCircle, adminOnly: false },
    { href: '/lease', label: 'Lease', icon: Receipt, adminOnly: false },
    { href: '/reports', label: 'Reports', icon: FileText, adminOnly: false },
  ]

  if (loading) {
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">Dashboard</h1>
          <p className="text-slate-600 text-sm">Overview of your vehicle retail operations</p>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isAdmin(user) && (
            <StatCard
              title="NET PROFIT (LAST 30 DAYS)"
              value={formatCurrency(stats.monthlyProfit)}
              subtitle="Selling Price - Cost"
              icon={TrendingUp}
              delay={0.1}
            />
          )}
          <StatCard
            title="LEASE MONEY TO BE COLLECTED"
            value={formatCurrency(stats.leaseMoneyToCollect)}
            subtitle="Outstanding lease installments"
            icon={DollarSign}
            delay={0.2}
          />
          <StatCard
            title="VEHICLES IN STOCK"
            value={stats.vehiclesInStock}
            subtitle="Available vehicles"
            icon={Car}
            delay={0.3}
          />
        </div>

        {/* Analysis Sections - only for admins + when setting is enabled */}
        {isAdmin(user) && enableProfitIntelligence && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Performance Intelligence */}
            <div className="lg:col-span-2 card p-6 bg-white">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-slate-900 rounded-full"></div>
                <h2 className="text-xl font-semibold text-slate-900">Performance Intelligence</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">Daily gross profit intelligence (Last 30 Days)</p>
              {performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" style={{ fontSize: '12px' }} />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} style={{ fontSize: '12px' }} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: '#1e293b' }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="grossProfit" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.3}
                      name="Gross Profit (LKR)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  No data available
                </div>
              )}
            </div>

            {/* Stock Analysis */}
            <div className="card p-6 bg-white">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-slate-700" />
                <h2 className="text-xl font-semibold text-slate-900">Stock Analysis</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">Inventory liquidity & aging health</p>
              <div className="space-y-4">
                <StockAgeItem
                  label="Fresh (0-30 Days)"
                  count={stockAging.fresh}
                  color="green"
                  icon={CheckCircle}
                />
                <StockAgeItem
                  label="Stable (30-60 Days)"
                  count={stockAging.stable}
                  color="blue"
                  icon={Car}
                />
                <StockAgeItem
                  label="Warning (60-90 Days)"
                  count={stockAging.warning}
                  color="orange"
                  icon={AlertTriangle}
                />
                <StockAgeItem
                  label="Critical (90+ Days)"
                  count={stockAging.critical}
                  color="red"
                  icon={AlertTriangle}
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, index) => {
              // Hide "Add Vehicle" for staff
              if (action.adminOnly && !isAdmin(user)) {
                return null
              }
              
              const Icon = action.icon
              return (
                <motion.button
                  key={action.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(action.href)}
                  className="card p-6 text-left bg-white hover:shadow-md transition-all duration-200 border border-slate-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 rounded-lg">
                      <Icon className="w-6 h-6 text-slate-700" />
                    </div>
                    <h3 className="text-base font-medium text-slate-900">{action.label}</h3>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </Layout>
  )
}

function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  delay 
}: { 
  title: string
  value: string | number
  subtitle?: string
  icon: any
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-6 bg-white"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-slate-100 rounded-lg">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
      </div>
      <h3 className="text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">{title}</h3>
      <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </motion.div>
  )
}

function StockAgeItem({ 
  label, 
  count, 
  color, 
  icon: Icon 
}: { 
  label: string
  count: number
  color: 'green' | 'blue' | 'orange' | 'red'
  icon: any
}) {
  const colorClasses = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700',
  }
  
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className="text-lg font-bold text-slate-900">{count} CARS</span>
    </div>
  )
}
