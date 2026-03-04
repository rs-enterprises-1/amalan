'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { Sale, AdvancePayment, LeaseCollection } from '@/lib/database.types'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import { TrendingUp, DollarSign, Receipt, Calendar, Download } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import jsPDF from 'jspdf'

interface ReportsViewProps {
  user: User
}

export default function ReportsView({ user }: ReportsViewProps) {
  const [monthlyProfit, setMonthlyProfit] = useState(0)
  const [salesSummary, setSalesSummary] = useState({
    totalSales: 0,
    totalVehicles: 0,
    averageProfit: 0,
  })
  const [advanceSummary, setAdvanceSummary] = useState({
    advanceHeld: 0,
    totalVehicles: 0,
  })
  const [leaseSummary, setLeaseSummary] = useState({
    pending: 0,
    collected: 0,
  })
  const [monthlyProfitData, setMonthlyProfitData] = useState<Array<{ month: string; profit: number }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1) // 1-12
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Monthly Profit (Admin Only)
    if (isAdmin(user)) {
      const { data: sales } = await supabase
        .from('sales')
        .select('profit, sold_date') // Database uses 'profit' (in LKR)
        .gte('sold_date', startOfMonth.toISOString().split('T')[0])
    
      // Each sale row only has "profit" (already in LKR)
      const profit = sales?.reduce((sum, s) => sum + (s.profit || 0), 0) || 0
      setMonthlyProfit(profit)

      // Load monthly profit data for graph (last 12 months)
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      const { data: allSales } = await supabase
        .from('sales')
        .select('profit, sold_date') // "profit" only
        .gte('sold_date', twelveMonthsAgo.toISOString().split('T')[0])
        .order('sold_date', { ascending: true })

      // Group by month
      const monthlyData = new Map<string, number>()
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      
      // Initialize last 12 months with 0
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
        monthlyData.set(key, 0)
      }

      // Add actual profit data
      allSales?.forEach(sale => {
        const saleDate = new Date(sale.sold_date)
        const key = `${monthNames[saleDate.getMonth()]} ${saleDate.getFullYear()}`
        const currentProfit = monthlyData.get(key) || 0
        monthlyData.set(key, currentProfit + (sale.profit || 0))
      })

      // Convert to array format for chart
      const chartData = Array.from(monthlyData.entries()).map(([month, profit]) => ({
        month,
        profit: Math.round(profit * 100) / 100 // Round to 2 decimal places
      }))

      setMonthlyProfitData(chartData)
    }

    // Sales Summary
    const { data: allSales } = await supabase
      .from('sales')
      .select('profit, sold_price') // Database uses 'profit' (in LKR)

    const totalSales = allSales?.reduce((sum, s) => sum + (s.sold_price || 0), 0) || 0
    const totalProfit = allSales?.reduce((sum, s) => sum + (s.profit || 0), 0) || 0
    const avgProfit = allSales && allSales.length > 0 ? totalProfit / allSales.length : 0

    setSalesSummary({
      totalSales,
      totalVehicles: allSales?.length || 0,
      averageProfit: avgProfit,
    })

    // Advance Held (only for vehicles NOT sold)
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('chassis_no, status')
      .neq('status', 'sold')

    const unsoldChassisNos = new Set(vehicles?.map(v => v.chassis_no) || [])
    
    const { data: payments } = await supabase
      .from('advance_payments')
      .select('amount_lkr, chassis_no')

    // Filter payments for unsold vehicles only
    const unsoldPayments = payments?.filter(p => unsoldChassisNos.has(p.chassis_no)) || []
    const advanceHeld = unsoldPayments.reduce((sum, p) => sum + (p.amount_lkr || 0), 0)
    
    // Count unique vehicles with advances
    const vehiclesWithAdvances = new Set(unsoldPayments.map(p => p.chassis_no))
    
    setAdvanceSummary({
      advanceHeld,
      totalVehicles: vehiclesWithAdvances.size,
    })

    // Lease Summary
    const { data: leases } = await supabase
      .from('lease_collections')
      .select('*')

    // Load all transactions
    const { data: transactionsData } = await supabase
      .from('lease_payment_transactions')
      .select('*')
    
    const transactionsMap = new Map<string, any[]>()
    transactionsData?.forEach(t => {
      const existing = transactionsMap.get(t.lease_collection_id) || []
      existing.push(t)
      transactionsMap.set(t.lease_collection_id, existing)
    })

    // Calculate pending (remaining amount for uncollected) and collected amounts
    let pending = 0
    let collected = 0

    leases?.forEach(lease => {
      const transactions = transactionsMap.get(lease.id) || []
      let totalCollected = transactions.reduce((sum, t) => sum + (t.amount || 0), 0)
      
      // Include legacy transactions if no new transactions exist
      if (transactions.length === 0) {
        if (lease.cheque_amount && lease.cheque_amount > 0) {
          totalCollected += lease.cheque_amount
        }
        if (lease.personal_loan_amount && lease.personal_loan_amount > 0) {
          totalCollected += lease.personal_loan_amount
        }
      }
      
      if (lease.collected) {
        // For collected leases, add the total collected amount
        collected += totalCollected
      } else {
        // For pending leases, calculate remaining amount
        const remaining = lease.due_amount_lkr - totalCollected
        if (remaining > 0) {
          pending += remaining
        }
        // Also add what's been collected so far
        collected += totalCollected
      }
    })

    setLeaseSummary({ pending, collected })
    setLoading(false)
  }

  async function generateAdvanceHeldReport() {
    try {
      // Get all unsold vehicles
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('chassis_no, maker, model, status')
        .neq('status', 'sold')
        .order('chassis_no', { ascending: true })

      if (!vehicles || vehicles.length === 0) {
        alert('No unsold vehicles found.')
        return
      }

      const unsoldChassisNos = new Set(vehicles.map(v => v.chassis_no))
      
      // Get all advance payments for unsold vehicles
      const { data: payments } = await supabase
        .from('advance_payments')
        .select('chassis_no, amount_lkr, paid_date')
        .order('paid_date', { ascending: true })

      const unsoldPayments = payments?.filter(p => unsoldChassisNos.has(p.chassis_no)) || []
      
      // Group payments by chassis_no
      const paymentsByChassis = new Map<string, { vehicle: typeof vehicles[0]; payments: typeof unsoldPayments; total: number }>()
      
      vehicles.forEach(vehicle => {
        const vehiclePayments = unsoldPayments.filter(p => p.chassis_no === vehicle.chassis_no)
        const total = vehiclePayments.reduce((sum, p) => sum + (p.amount_lkr || 0), 0)
        if (total > 0) {
          paymentsByChassis.set(vehicle.chassis_no, {
            vehicle,
            payments: vehiclePayments,
            total
          })
        }
      })

      if (paymentsByChassis.size === 0) {
        alert('No advance payments found for unsold vehicles.')
        return
      }

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Title
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('Advance Held Report', 105, 20, { align: 'center' })
      
      // Subtitle
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' })

      let currentY = 40

      // Summary
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Summary', 20, currentY)
      currentY += 6
      
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      const totalAdvanceHeld = Array.from(paymentsByChassis.values()).reduce((sum, v) => sum + v.total, 0)
      pdf.text(`Total Advance Held: ${formatCurrency(totalAdvanceHeld)}`, 20, currentY)
      currentY += 5
      pdf.text(`Vehicles with Advances: ${paymentsByChassis.size}`, 20, currentY)
      currentY += 10

      // Line
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Table headers
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Chassis No', 20, currentY)
      pdf.text('Maker + Model', 60, currentY)
      pdf.text('Total Advance', 130, currentY, { align: 'right' })
      pdf.text('Payments', 160, currentY)
      
      currentY += 3
      pdf.line(20, currentY, 190, currentY)
      currentY += 6

      // Table rows
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      
      const sortedEntries = Array.from(paymentsByChassis.entries()).sort((a, b) => 
        a[0].localeCompare(b[0])
      )

      sortedEntries.forEach(([chassisNo, data]) => {
        // Check if we need a new page
        if (currentY > 270) {
          pdf.addPage()
          currentY = 20
          
          // Redraw headers
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(10)
          pdf.text('Chassis No', 20, currentY)
          pdf.text('Maker + Model', 60, currentY)
          pdf.text('Total Advance', 130, currentY, { align: 'right' })
          pdf.text('Payments', 160, currentY)
          currentY += 3
          pdf.line(20, currentY, 190, currentY)
          currentY += 6
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
        }

        const makerModel = `${data.vehicle.maker} ${data.vehicle.model}`
        const truncatedChassis = chassisNo.length > 12 ? chassisNo.substring(0, 12) : chassisNo
        const truncatedMakerModel = makerModel.length > 25 ? makerModel.substring(0, 25) : makerModel

        pdf.text(truncatedChassis, 20, currentY)
        pdf.text(truncatedMakerModel, 60, currentY)
        pdf.text(formatCurrency(data.total), 130, currentY, { align: 'right' })
        pdf.text(`${data.payments.length}`, 160, currentY)
        
        currentY += 6
      })

      // Footer
      currentY += 5
      pdf.line(20, currentY, 190, currentY)
      currentY += 6
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text(`Grand Total: ${formatCurrency(totalAdvanceHeld)}`, 130, currentY, { align: 'right' })

      // Save PDF
      pdf.save(`Advance-Held-Report-${Date.now()}.pdf`)
    } catch (error: any) {
      console.error('Error generating advance held report:', error)
      alert(`Error generating report: ${error.message}`)
    }
  }

  async function generateMonthlySalesReport() {
    try {
      // Get start and end dates for selected month/year
      const startDate = new Date(selectedYear, selectedMonth - 1, 1)
      const endDate = new Date(selectedYear, selectedMonth, 0) // Last day of month
      
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      // Fetch sales for the selected month - include profit and currency/rate for display
      const { data: sales } = await supabase
        .from('sales')
        .select('chassis_no, sold_date, sold_price, sold_currency, rate_jpy_to_lkr, profit')
        .gte('sold_date', startDateStr)
        .lte('sold_date', endDateStr)
        .order('sold_date', { ascending: true })

      if (!sales || sales.length === 0) {
        alert('No sales found for the selected month.')
        return
      }

      // Fetch vehicles to get total cost (final_total_lkr)
      const chassisNos = sales.map(s => s.chassis_no)
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('chassis_no, final_total_lkr')
        .in('chassis_no', chassisNos)

      const vehiclesMap = new Map(vehicles?.map(v => [v.chassis_no, v]) || [])

      // Prepare table data - use profit from sales table (calculated at sale time)
      const tableData = sales.map(sale => {
        const vehicle = vehiclesMap.get(sale.chassis_no)
        const totalCost = vehicle?.final_total_lkr || 0
        // Convert sold_price to LKR if it's in JPY for display
        let soldPriceLkr = sale.sold_price || 0
        if (sale.sold_currency === 'JPY' && sale.rate_jpy_to_lkr) {
          soldPriceLkr = (sale.sold_price || 0) * sale.rate_jpy_to_lkr
        }
        // Use profit from sales table (already calculated with rate at time of sale)
        const profit = sale.profit || 0
        return {
          date: sale.sold_date,
          chassis: sale.chassis_no,
          totalCost,
          soldPrice: soldPriceLkr,
          profit
        }
      })

      // Calculate totals
      const totalCostSum = tableData.reduce((sum, r) => sum + r.totalCost, 0)
      const totalSoldSum = tableData.reduce((sum, r) => sum + r.soldPrice, 0)
      const totalProfitSum = tableData.reduce((sum, r) => sum + r.profit, 0)

      // Create PDF in landscape A4
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      // Title
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December']
      const monthName = monthNames[selectedMonth - 1]
      pdf.text(`MONTHLY SALES REPORT - ${monthName} ${selectedYear}`, 148, 20, { align: 'center' })

      // Table headers
      let currentY = 35
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Date', 20, currentY)
      pdf.text('Chassis', 50, currentY)
      pdf.text('Total Cost', 120, currentY, { align: 'right' })
      pdf.text('Sold Price', 170, currentY, { align: 'right' })
      pdf.text('Profit', 220, currentY, { align: 'right' })

      // Draw header line
      pdf.line(20, currentY + 3, 277, currentY + 3)
      currentY += 8

      // Table rows
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      tableData.forEach(row => {
        const date = new Date(row.date).toLocaleDateString()
        pdf.text(date, 20, currentY)
        pdf.text(row.chassis, 50, currentY)
        pdf.text(formatCurrency(row.totalCost), 120, currentY, { align: 'right' })
        pdf.text(formatCurrency(row.soldPrice), 170, currentY, { align: 'right' })
        pdf.text(formatCurrency(row.profit), 220, currentY, { align: 'right' })
        currentY += 6

        // Add new page if needed
        if (currentY > 190) {
          pdf.addPage()
          currentY = 20
        }
      })

      // Total row
      currentY += 3
      pdf.line(20, currentY, 277, currentY)
      currentY += 6
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('TOTAL', 20, currentY)
      pdf.text(formatCurrency(totalCostSum), 120, currentY, { align: 'right' })
      pdf.text(formatCurrency(totalSoldSum), 170, currentY, { align: 'right' })
      pdf.text(formatCurrency(totalProfitSum), 220, currentY, { align: 'right' })

      // Save PDF
      pdf.save(`Monthly-Sales-Report-${monthName}-${selectedYear}.pdf`)
    } catch (error: any) {
      console.error('Error generating monthly sales report:', error)
      alert(`Error generating report: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-4xl font-bold text-slate-800 mb-2">Reports</h1>
        <p className="text-slate-600">View system reports and summaries</p>
      </div>

      {isAdmin(user) && (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-8 bg-slate-50 border-2 border-slate-800"
          >
            <div className="flex items-center gap-4 mb-4">
              <TrendingUp className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Monthly Profit (Admin Only)</h2>
            </div>
            <div className="text-4xl font-bold text-slate-900">
              {formatCurrency(monthlyProfit)}
            </div>
            <p className="text-slate-600 mt-2">Profit for current month</p>
          </motion.div>

          {/* Removed Monthly Profit Trend chart as requested */}
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Sales Summary</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Vehicles Sold:</span>
              <span className="font-bold">{salesSummary.totalVehicles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Sales:</span>
              <span className="font-bold">{formatCurrency(salesSummary.totalSales)}</span>
            </div>
            {isAdmin(user) && (
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-600">Avg Profit:</span>
                <span className="font-bold text-green-700">{formatCurrency(salesSummary.averageProfit)}</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={generateAdvanceHeldReport}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Advance Summary</h3>
            <Download className="w-4 h-4 text-slate-400 ml-auto" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Advance Held:</span>
              <span className="font-bold text-green-700">{formatCurrency(advanceSummary.advanceHeld)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Vehicles:</span>
              <span className="font-bold">{advanceSummary.totalVehicles}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Click to download report</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Receipt className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Lease Collection</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Pending:</span>
              <span className="font-bold text-orange-700">{formatCurrency(leaseSummary.pending)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Collected:</span>
              <span className="font-bold text-green-700">{formatCurrency(leaseSummary.collected)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Monthly Sales Report (Admin Only) */}
      {isAdmin(user) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Monthly Sales Report</h3>
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <div>
              <label className="label text-sm">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="input-field"
              >
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>
            
            <div>
              <label className="label text-sm">Year</label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="input-field"
                min="2000"
                max="2100"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={generateMonthlySalesReport}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Generate & Download PDF
              </button>
            </div>
          </div>
          
          <p className="text-sm text-slate-600">
            Generate a monthly sales report in table format (Date, Chassis, Total Cost, Sold Price, Profit) as a landscape A4 PDF.
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}

