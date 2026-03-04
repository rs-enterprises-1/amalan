'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { formatCurrency } from '@/lib/utils'
import { Download } from 'lucide-react'
import jsPDF from 'jspdf'
import { addCompanyHeaderToPDF } from '@/lib/pdf-header'

export default function SalesReportPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [stats, setStats] = useState({
    totalRevenue: 0,
    unitsSold: 0,
    avgSaleValue: 0,
    estNetProfit: 0,
  })
  const [recentSales, setRecentSales] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, startDate, endDate])

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

    // Set default date range (last 30 days)
    const end = new Date()
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  async function loadData() {
    if (!startDate || !endDate) return

    setLoading(true)
    
    const { data: sales } = await supabase
      .from('sales')
      .select('*, vehicle:vehicles(chassis_no, maker, model)')
      .gte('sold_date', startDate)
      .lte('sold_date', endDate)
      .order('sold_date', { ascending: false })
      .limit(20)

    if (sales) {
      const totalRevenue = sales.reduce((sum, s) => {
        const priceLkr = s.sold_currency === 'JPY'
          ? (s.sold_price || 0) * (s.rate_jpy_to_lkr || 1)
          : (s.sold_price || 0)
        return sum + priceLkr
      }, 0)

      const totalProfit = sales.reduce((sum, s) => sum + (s.profit || 0), 0)
      const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0

      setStats({
        totalRevenue,
        unitsSold: sales.length,
        avgSaleValue: avgSale,
        estNetProfit: totalProfit,
      })

      setRecentSales(sales)
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
      pdf.text('Sales Report', 105, currentY, { align: 'center' })
      currentY += 10

      // Date Range
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      const dateRangeText = `Period: ${startDate ? new Date(startDate).toLocaleDateString() : 'N/A'} to ${endDate ? new Date(endDate).toLocaleDateString() : 'N/A'}`
      pdf.text(dateRangeText, 105, currentY, { align: 'center' })
      currentY += 10

      // KPI Section
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Key Performance Indicators', 20, currentY)
      currentY += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Total Revenue: ${formatCurrency(stats.totalRevenue)}`, 25, currentY)
      currentY += 6
      pdf.text(`Units Sold: ${stats.unitsSold} Vehicles`, 25, currentY)
      currentY += 6
      pdf.text(`Average Sale Value: ${formatCurrency(stats.avgSaleValue)}`, 25, currentY)
      currentY += 6
      pdf.text(`Estimated Net Profit: ${formatCurrency(stats.estNetProfit)}`, 25, currentY)
      currentY += 10

      // Sales Table
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Recent Sales', 20, currentY)
      currentY += 8

      if (recentSales.length > 0) {
        // Table Header
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.text('Date', 20, currentY)
        pdf.text('Vehicle', 50, currentY)
        pdf.text('Sold Price', 140, currentY, { align: 'right' })
        pdf.text('Customer', 170, currentY, { align: 'right' })
        currentY += 6
        pdf.line(20, currentY, 190, currentY)
        currentY += 4

        // Table Rows
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        for (const sale of recentSales.slice(0, 30)) { // Limit to 30 rows per page
          if (currentY > 270) {
            pdf.addPage()
            currentY = 20
          }

          const soldPriceLkr = sale.sold_currency === 'JPY'
            ? (sale.sold_price || 0) * (sale.rate_jpy_to_lkr || 1)
            : (sale.sold_price || 0)
          const vehicle = sale.vehicle || {}
          const vehicleText = `${vehicle.maker || ''} ${vehicle.model || ''} (${sale.chassis_no})`
          
          pdf.text(new Date(sale.sold_date).toLocaleDateString(), 20, currentY)
          pdf.text(vehicleText.substring(0, 40), 50, currentY)
          pdf.text(formatCurrency(soldPriceLkr), 140, currentY, { align: 'right' })
          pdf.text((sale.customer_name || 'N/A').substring(0, 20), 170, currentY, { align: 'right' })
          currentY += 6
        }
      } else {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.text('No sales found for the selected date range.', 20, currentY)
      }

      // Save PDF
      const fileName = `Sales-Report-${startDate || 'all'}-${endDate || 'all'}-${Date.now()}.pdf`
      pdf.save(fileName)
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      alert(`Error generating PDF: ${error.message}`)
    }
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
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Business Reports"
          subtitle="Comprehensive analytics for your vehicle retail business"
          showFilters={true}
          onExport={handleExport}
          dateRange={{
            startDate,
            endDate,
            onStartDateChange: setStartDate,
            onEndDateChange: setEndDate,
          }}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card p-6 bg-white">
            <h3 className="text-sm font-medium text-slate-600 mb-2">Total Revenue</h3>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.totalRevenue)}</p>
          </div>
          <div className="card p-6 bg-white">
            <h3 className="text-sm font-medium text-slate-600 mb-2">Units Sold</h3>
            <p className="text-3xl font-bold text-slate-900">{stats.unitsSold} Vehicles</p>
          </div>
          <div className="card p-6 bg-white">
            <h3 className="text-sm font-medium text-slate-600 mb-2">Avg Sale Value</h3>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.avgSaleValue)}</p>
          </div>
          <div className="card p-6 bg-white">
            <h3 className="text-sm font-medium text-slate-600 mb-2">Est. Net Profit</h3>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.estNetProfit)}</p>
          </div>
        </div>

        {/* Recent Sales Table */}
        <div className="card p-6 bg-white">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Sales</h3>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : recentSales.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No sales found for the selected date range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Vehicle</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-700">Sold Price</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-700">Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale: any) => {
                    const soldPriceLkr = sale.sold_currency === 'JPY'
                      ? (sale.sold_price || 0) * (sale.rate_jpy_to_lkr || 1)
                      : (sale.sold_price || 0)
                    const vehicle = sale.vehicle || {}
                    
                    return (
                      <tr key={sale.chassis_no} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm text-slate-900">
                          {new Date(sale.sold_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900">
                          {vehicle.maker} {vehicle.model} ({sale.chassis_no})
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900 text-right">
                          {formatCurrency(soldPriceLkr)}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900 text-right">
                          {sale.customer_name || 'N/A'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
