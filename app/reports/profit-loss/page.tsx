'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import Layout from '@/components/Layout'
import ReportPageTemplate from '@/components/ReportPageTemplate'
import { formatCurrency } from '@/lib/utils'
import jsPDF from 'jspdf'
import { addCompanyHeaderToPDF } from '@/lib/pdf-header'

export default function ProfitLossReportPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [stats, setStats] = useState({
    netRevenue: 0,
    costOfGoodsSold: 0,
    totalExpenses: 0,
    netProfit: 0,
  })
  const [recentSales, setRecentSales] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user && startDate && endDate) {
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

    const end = new Date()
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  async function loadData() {
    setLoading(true)
    
    // Load sales
    const { data: sales } = await supabase
      .from('sales')
      .select('*, vehicle:vehicles(*)')
      .gte('sold_date', startDate)
      .lte('sold_date', endDate)
      .order('sold_date', { ascending: false })
      .limit(20)

    // Load expenses for the date range
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)

    if (sales) {
      const netRevenue = sales.reduce((sum, s) => {
        const priceLkr = s.sold_currency === 'JPY'
          ? (s.sold_price || 0) * (s.rate_jpy_to_lkr || 1)
          : (s.sold_price || 0)
        return sum + priceLkr
      }, 0)

      const costOfGoodsSold = sales.reduce((sum, s) => {
        const vehicle = s.vehicle || {}
        return sum + (vehicle.final_total_lkr || 0)
      }, 0)

      // Calculate total expenses (don't duplicate - expenses are separate from vehicle costs)
      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

      // Net profit = Revenue - Cost of Goods Sold - Expenses
      const netProfit = netRevenue - costOfGoodsSold - totalExpenses

      setStats({
        netRevenue,
        costOfGoodsSold,
        totalExpenses,
        netProfit,
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
      pdf.text('Profit & Loss Report', 105, currentY, { align: 'center' })
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
      pdf.text('Financial Summary', 20, currentY)
      currentY += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Net Revenue: ${formatCurrency(stats.netRevenue)}`, 25, currentY)
      currentY += 6
      pdf.text(`Cost of Goods Sold: ${formatCurrency(stats.costOfGoodsSold)}`, 25, currentY)
      currentY += 6
      pdf.text(`Expenses: ${formatCurrency(stats.totalExpenses)}`, 25, currentY)
      currentY += 6
      pdf.setFont('helvetica', 'bold')
      pdf.text(`Net Profit: ${formatCurrency(stats.netProfit)}`, 25, currentY)
      currentY += 10

      // P&L Analysis Table
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Recent Sales P&L Analysis', 20, currentY)
      currentY += 8

      if (recentSales.length > 0) {
        // Table Header
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.text('Date', 20, currentY)
        pdf.text('Chassis No', 35, currentY)
        pdf.text('Vehicle', 60, currentY)
        pdf.text('Sold Price', 110, currentY, { align: 'right' })
        pdf.text('Cost', 140, currentY, { align: 'right' })
        pdf.text('Net Profit', 170, currentY, { align: 'right' })
        currentY += 6
        pdf.line(20, currentY, 190, currentY)
        currentY += 4

        // Table Rows
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)
        for (const sale of recentSales.slice(0, 30)) {
          if (currentY > 270) {
            pdf.addPage()
            currentY = 20
          }

          const soldPriceLkr = sale.sold_currency === 'JPY'
            ? (sale.sold_price || 0) * (sale.rate_jpy_to_lkr || 1)
            : (sale.sold_price || 0)
          const vehicle = sale.vehicle || {}
          const cost = vehicle.final_total_lkr || 0
          const netProfit = soldPriceLkr - cost
          
          pdf.text(new Date(sale.sold_date).toLocaleDateString(), 20, currentY)
          pdf.text(sale.chassis_no || 'N/A', 35, currentY)
          pdf.text(`${vehicle.maker || ''} ${vehicle.model || ''}`.substring(0, 20), 60, currentY)
          pdf.text(formatCurrency(soldPriceLkr), 110, currentY, { align: 'right' })
          pdf.text(formatCurrency(cost), 140, currentY, { align: 'right' })
          pdf.setFont('helvetica', netProfit >= 0 ? 'normal' : 'bold')
          pdf.text(formatCurrency(netProfit), 170, currentY, { align: 'right' })
          pdf.setFont('helvetica', 'normal')
          currentY += 6
        }
      } else {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.text('No sales found for the selected date range.', 20, currentY)
      }

      // Save PDF
      const fileName = `Profit-Loss-Report-${startDate || 'all'}-${endDate || 'all'}-${Date.now()}.pdf`
      pdf.save(fileName)
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      alert(`Error generating PDF: ${error.message}`)
    }
  }

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6 bg-white">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Net Revenue</h3>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.netRevenue)}</p>
          <p className="text-xs text-slate-500 mt-1">Excl. Tax</p>
        </div>
        <div className="card p-6 bg-white">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Cost of Goods Sold</h3>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.costOfGoodsSold)}</p>
          <p className="text-xs text-slate-500 mt-1">Vehicle Purchase Costs</p>
        </div>
        <div className="card p-6 bg-white">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Expenses</h3>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.totalExpenses)}</p>
          <p className="text-xs text-slate-500 mt-1">Additional costs</p>
        </div>
        <div className="card p-6 bg-white">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Net Profit</h3>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.netProfit)}</p>
          <p className="text-xs text-slate-500 mt-1">After all costs</p>
        </div>
      </div>

      {/* Recent Sales P&L Analysis */}
      <div className="card p-6 bg-white">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Recent Sales P&L Analysis</h3>
        <p className="text-sm text-slate-600 mb-4">Profitability breakdown per vehicle (last 20 sales)</p>
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
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Chassis No</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Vehicle</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-700">Sold Price</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-700">Cost</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-700">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale: any) => {
                  const soldPriceLkr = sale.sold_currency === 'JPY'
                    ? (sale.sold_price || 0) * (sale.rate_jpy_to_lkr || 1)
                    : (sale.sold_price || 0)
                  const vehicle = sale.vehicle || {}
                  const cost = vehicle.final_total_lkr || 0
                  const netProfit = soldPriceLkr - cost
                  
                  return (
                    <tr key={sale.chassis_no} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-900">
                        {new Date(sale.sold_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900 font-mono">
                        {sale.chassis_no || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900">
                        {vehicle.maker} {vehicle.model}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900 text-right">
                        {formatCurrency(soldPriceLkr)}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900 text-right">
                        {formatCurrency(cost)}
                      </td>
                      <td className={`py-3 px-4 text-sm text-right font-semibold ${
                        netProfit >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {formatCurrency(netProfit)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ReportPageTemplate>
  )
}
