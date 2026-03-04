'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import Layout from '@/components/Layout'
import ReportPageTemplate from '@/components/ReportPageTemplate'
import { formatCurrency } from '@/lib/utils'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import jsPDF from 'jspdf'
import { addCompanyHeaderToPDF } from '@/lib/pdf-header'

export default function InventoryReportPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [stats, setStats] = useState({
    stockValuation: 0,
    stockTurnRate: 0,
    vehiclesInStock: 0,
  })
  const [stockAging, setStockAging] = useState({
    fresh: 0,
    stable: 0,
    warning: 0,
    critical: 0,
  })
  const [topBrands, setTopBrands] = useState<any[]>([])
  const [oldestStock, setOldestStock] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

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

  async function loadData() {
    setLoading(true)
    
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'available')

    if (vehicles) {
      const stockValuation = vehicles.reduce((sum, v) => sum + (v.final_total_lkr || 0), 0)
      
      // Get sales in last 12 months
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const { count: salesCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .gte('sold_date', twelveMonthsAgo.toISOString().split('T')[0])
      
      const stockTurnRate = vehicles.length > 0 ? (salesCount || 0) / vehicles.length : 0

      // Stock aging
      const now = new Date()
      let fresh = 0, stable = 0, warning = 0, critical = 0
      const oldest: any[] = []

      vehicles.forEach(vehicle => {
        const created = new Date(vehicle.created_at)
        const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysDiff <= 30) fresh++
        else if (daysDiff <= 60) stable++
        else if (daysDiff <= 90) warning++
        else critical++

        // Only show vehicles in "Oldest Stock (Action Required)" that are already in Sri Lanka.
        // Rule from user:
        // - While vehicle is still in Japan, only LC commission might be filled; other local costs are empty.
        // - Once vehicle is in Sri Lanka, local charges like tax / clearance / transport / local_extras are filled.
        const tax = (vehicle as any).tax_lkr
        const clearance = (vehicle as any).clearance_lkr
        const transport = (vehicle as any).transport_lkr
        const localExtras = [
          (vehicle as any).local_extra1_lkr,
          (vehicle as any).local_extra2_lkr,
          (vehicle as any).local_extra3_lkr,
          (vehicle as any).local_extra4_lkr,
          (vehicle as any).local_extra5_lkr,
        ]

        const hasAnyLocalCost =
          (tax && tax > 0) ||
          (clearance && clearance > 0) ||
          (transport && transport > 0) ||
          localExtras.some((v) => v && v > 0)

        // If no local costs (only LC commission or none), treat as "still in Japan" → do NOT push to oldest list.
        if (hasAnyLocalCost) {
          oldest.push({ ...vehicle, days: daysDiff })
        }
      })

      oldest.sort((a, b) => b.days - a.days)
      setOldestStock(oldest.slice(0, 10))

      setStockAging({ fresh, stable, warning, critical })

      // Top brands
      const brandCounts = new Map<string, number>()
      vehicles.forEach(v => {
        const count = brandCounts.get(v.maker) || 0
        brandCounts.set(v.maker, count + 1)
      })
      
      const brands = Array.from(brandCounts.entries())
        .map(([name, count]) => ({ name, value: count }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
      
      setTopBrands(brands)

      setStats({
        stockValuation,
        stockTurnRate: Math.round(stockTurnRate * 10) / 10,
        vehiclesInStock: vehicles.length,
      })
    }

    setLoading(false)
  }

  async function handleExport() {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Add company header
      let currentY = await addCompanyHeaderToPDF(pdf, 20)

      // Report Title
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('Inventory Report', 105, currentY, { align: 'center' })
      currentY += 10

      // KPI Section
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Key Performance Indicators', 20, currentY)
      currentY += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Stock Valuation: ${formatCurrency(stats.stockValuation)}`, 25, currentY)
      currentY += 6
      pdf.text(`Vehicles in Stock: ${stats.vehiclesInStock}`, 25, currentY)
      currentY += 6
      pdf.text(`Stock Turn Rate: ${stats.stockTurnRate}x`, 25, currentY)
      currentY += 10

      // Stock Aging
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Stock Aging', 20, currentY)
      currentY += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`0-30 Days (Fresh): ${stockAging.fresh}`, 25, currentY)
      currentY += 6
      pdf.text(`31-60 Days (Stable): ${stockAging.stable}`, 25, currentY)
      currentY += 6
      pdf.text(`61-90 Days (Warning): ${stockAging.warning}`, 25, currentY)
      currentY += 6
      pdf.text(`90+ Days (Critical): ${stockAging.critical}`, 25, currentY)
      currentY += 10

      // Top Brands
      if (topBrands.length > 0) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(12)
        pdf.text('Top 10 Brands by Stock', 20, currentY)
        currentY += 8

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        topBrands.forEach((brand, index) => {
          if (currentY > 270) {
            pdf.addPage()
            currentY = 20
          }
          pdf.text(`${index + 1}. ${brand.name}: ${brand.value} vehicles`, 25, currentY)
          currentY += 6
        })
        currentY += 5
      }

      // Oldest Stock
      if (oldestStock.length > 0) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(12)
        pdf.text('Oldest Stock (Action Required)', 20, currentY)
        currentY += 8

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        oldestStock.slice(0, 20).forEach((vehicle) => {
          if (currentY > 270) {
            pdf.addPage()
            currentY = 20
          }
          const vehicleText = `${vehicle.maker} ${vehicle.model} (${vehicle.chassis_no})`
          pdf.text(vehicleText.substring(0, 50), 25, currentY)
          pdf.text(`${vehicle.days} days`, 140, currentY)
          pdf.text(formatCurrency(vehicle.final_total_lkr || 0), 170, currentY, { align: 'right' })
          currentY += 6
        })
      }

      // Save PDF
      const fileName = `Inventory-Report-${Date.now()}.pdf`
      pdf.save(fileName)
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      alert(`Error generating PDF: ${error.message}`)
    }
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

  if (!user) {
    return <div>Loading...</div>
  }

  // Block staff from accessing reports
  if (!isAdmin(user)) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
            <p className="text-slate-600">Only administrators can access reports.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <ReportPageTemplate
      title="Business Reports"
      subtitle="Comprehensive analytics for your vehicle retail business"
      onExport={handleExport}
      dateRange={{
        startDate,
        endDate,
        onStartDateChange: setStartDate,
        onEndDateChange: setEndDate,
      }}
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 bg-white">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Stock Valuation</h3>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.stockValuation)}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.vehiclesInStock} vehicles in stock</p>
        </div>
        <div className="card p-6 bg-white">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Stock Turn Rate</h3>
          <p className="text-3xl font-bold text-slate-900">{stats.stockTurnRate}x</p>
          <p className="text-xs text-slate-500 mt-1">12-month sales / current inventory</p>
        </div>
        <div className="card p-6 bg-white">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Stock Aging</h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-sm">
              <span>0-30 Days:</span>
              <span className="font-semibold">{stockAging.fresh}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>31-60 Days:</span>
              <span className="font-semibold">{stockAging.stable}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>61-90 Days:</span>
              <span className="font-semibold">{stockAging.warning}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>90+ Days:</span>
              <span className="font-semibold">{stockAging.critical}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Brands */}
        <div className="card p-6 bg-white">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 10 Brands by Stock</h3>
          {topBrands.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topBrands}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {topBrands.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 text-center py-8">No data available</p>
          )}
        </div>

        {/* Oldest Stock */}
        <div className="card p-6 bg-white">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Oldest Stock (Action Required)</h3>
          {oldestStock.length > 0 ? (
            <div className="space-y-2">
              {oldestStock.map((vehicle) => (
                <div key={vehicle.chassis_no} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-slate-900">{vehicle.maker} {vehicle.model}</p>
                      <p className="text-sm text-slate-600">VIN: {vehicle.chassis_no}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{formatCurrency(vehicle.final_total_lkr || 0)}</p>
                      <p className="text-sm text-red-600">{vehicle.days} days</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No data available</p>
          )}
        </div>
      </div>
    </ReportPageTemplate>
  )
}
