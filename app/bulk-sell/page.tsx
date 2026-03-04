'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { isAdmin } from '@/lib/auth'
import { Vehicle } from '@/lib/database.types'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, X } from 'lucide-react'
import jsPDF from 'jspdf'

export default function BulkSellPage() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVehiclesForBulk, setSelectedVehiclesForBulk] = useState<Set<string>>(new Set())
  const [bulkProfits, setBulkProfits] = useState<Record<string, string>>({})
  const [bulkCustomerName, setBulkCustomerName] = useState('')
  const [bulkCustomerAddress, setBulkCustomerAddress] = useState('')

  useEffect(() => {
    checkUser()
    loadVehicles()
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

  async function loadVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'available')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading vehicles:', error)
      return
    }

    setVehicles(data || [])
    setLoading(false)
  }

  function toggleVehicleSelection(chassisNo: string) {
    const newSelected = new Set(selectedVehiclesForBulk)
    if (newSelected.has(chassisNo)) {
      newSelected.delete(chassisNo)
      // Remove profit entry when deselected
      const newProfits = { ...bulkProfits }
      delete newProfits[chassisNo]
      setBulkProfits(newProfits)
    } else {
      newSelected.add(chassisNo)
    }
    setSelectedVehiclesForBulk(newSelected)
  }

  async function generateBulkInvoice() {
    if (selectedVehiclesForBulk.size === 0) {
      alert('Please select at least one vehicle')
      return
    }

    if (!bulkCustomerName) {
      alert('Please enter customer name')
      return
    }

    const selectedVehicles = vehicles.filter(v => selectedVehiclesForBulk.has(v.chassis_no))
    
    // Validate all selected vehicles have profit entered
    for (const vehicle of selectedVehicles) {
      if (!bulkProfits[vehicle.chassis_no] || parseFloat(bulkProfits[vehicle.chassis_no]) <= 0) {
        alert(`Please enter expected profit for ${vehicle.maker} ${vehicle.model} (${vehicle.chassis_no})`)
        return
      }
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Company Header
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(24)
      pdf.text('R.S.Enterprises', 105, 20, { align: 'center' })

      // Company Details (middle, small font)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('No.164/B,Nittambuwa Road,Paththalagedara,Veyangoda', 105, 28, { align: 'center' })
      pdf.text('Tel: 0773073156,0332245886', 105, 34, { align: 'center' })
      pdf.text('Email : rsenterprises59@gmail.com', 105, 40, { align: 'center' })

      // Line separator
      pdf.setDrawColor(0, 0, 0)
      pdf.line(20, 45, 190, 45)

      // INVOICE title (middle)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('INVOICE', 105, 55, { align: 'center' })

      // Invoice No (right) and Date (left)
      const invoiceNo = `INV-${Date.now()}`
      const invoiceDate = new Date().toLocaleDateString()
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.text(`Invoice No: ${invoiceNo}`, 190, 65, { align: 'right' })
      pdf.text(`Date: ${invoiceDate}`, 20, 65)

      // To: Customer Address
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.text('To:', 20, 75)
      const addressLines = bulkCustomerAddress ? bulkCustomerAddress.split(',').map(l => l.trim()).filter(l => l) : []
      let addressY = 82
      if (addressLines.length > 0) {
        addressLines.forEach(line => {
          pdf.text(line, 20, addressY)
          addressY += 6
        })
      } else {
        pdf.text(bulkCustomerName, 20, addressY)
        addressY += 6
      }

      // Line separator
      pdf.line(20, addressY + 2, 190, addressY + 2)
      let tableStartY = addressY + 8

      // Description heading
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Description', 20, tableStartY)

      // Table header
      tableStartY += 8
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Maker + Model', 20, tableStartY)
      pdf.text('Chassis', 80, tableStartY)
      pdf.text('Year', 120, tableStartY)
      pdf.text('Price', 150, tableStartY)

      // Table header line
      pdf.line(20, tableStartY + 2, 190, tableStartY + 2)
      tableStartY += 6

      // Table rows
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      let totalPrice = 0
      let currentY = tableStartY

      for (const vehicle of selectedVehicles) {
        const profitJpy = parseFloat(bulkProfits[vehicle.chassis_no]) || 0
        const invoiceAmountJpy = vehicle.invoice_amount_jpy || 0
        const invoiceRate = vehicle.invoice_jpy_to_lkr_rate || 0
        const soldPriceJpy = invoiceAmountJpy + profitJpy
        const soldPriceLkr = soldPriceJpy * invoiceRate
        totalPrice += soldPriceLkr

        const makerModel = `${vehicle.maker} ${vehicle.model}`
        // Handle long text by splitting if needed
        const maxWidth = 55
        if (pdf.getTextWidth(makerModel) > maxWidth) {
          // Split text if too long
          const words = makerModel.split(' ')
          let line = ''
          let lineY = currentY
          words.forEach(word => {
            const testLine = line + (line ? ' ' : '') + word
            if (pdf.getTextWidth(testLine) > maxWidth && line) {
              pdf.text(line, 20, lineY)
              lineY += 5
              line = word
            } else {
              line = testLine
            }
          })
          if (line) {
            pdf.text(line, 20, lineY)
          }
          currentY = lineY + 5
        } else {
          pdf.text(makerModel, 20, currentY)
          currentY += 6
        }

        pdf.text(vehicle.chassis_no, 80, currentY - 6)
        pdf.text(vehicle.manufacturer_year.toString(), 120, currentY - 6)
        pdf.text(formatCurrency(soldPriceLkr), 150, currentY - 6)

        // Check if we need a new page
        if (currentY > 250) {
          pdf.addPage()
          currentY = 20
          // Redraw table header on new page
          pdf.setFont('helvetica', 'bold')
          pdf.text('Maker + Model', 20, currentY)
          pdf.text('Chassis', 80, currentY)
          pdf.text('Year', 120, currentY)
          pdf.text('Price', 150, currentY)
          pdf.line(20, currentY + 2, 190, currentY + 2)
          currentY += 6
          pdf.setFont('helvetica', 'normal')
        }
      }

      // Total row
      currentY += 3
      pdf.line(20, currentY, 190, currentY)
      currentY += 6
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Total', 20, currentY)
      pdf.text(formatCurrency(totalPrice), 150, currentY)

      // Footer text
      currentY += 15
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.text('Please draw the payment in favour of R.S.Enterprises', 105, currentY, { align: 'center' })

      // Save PDF
      pdf.save(`Bulk-Invoice-${invoiceNo}.pdf`)

      // Mark vehicles as sold and create sale records
      for (const vehicle of selectedVehicles) {
        const profitJpy = parseFloat(bulkProfits[vehicle.chassis_no]) || 0
        const invoiceAmountJpy = vehicle.invoice_amount_jpy || 0
        const invoiceRate = vehicle.invoice_jpy_to_lkr_rate || 0
        const soldPriceJpy = invoiceAmountJpy + profitJpy
        const soldPriceLkr = soldPriceJpy * invoiceRate
        const profitLkr = soldPriceLkr - (vehicle.japan_total_lkr || 0)

        // Create sale record
        await supabase
          .from('sales')
          .insert({
            chassis_no: vehicle.chassis_no,
            sold_price: soldPriceJpy,
            sold_currency: 'JPY',
            rate_jpy_to_lkr: invoiceRate,
            profit: profitLkr,
            sold_date: new Date().toISOString().split('T')[0],
            customer_name: bulkCustomerName,
            customer_address: bulkCustomerAddress || null,
          })

        // Update vehicle status
        await supabase
          .from('vehicles')
          .update({ status: 'sold' })
          .eq('chassis_no', vehicle.chassis_no)
      }

      alert('Bulk invoice generated and vehicles marked as sold successfully!')
      setSelectedVehiclesForBulk(new Set())
      setBulkProfits({})
      setBulkCustomerName('')
      setBulkCustomerAddress('')
      loadVehicles()
      router.push('/sold')
    } catch (error: any) {
      console.error('Error generating bulk invoice:', error)
      alert(`Error: ${error.message}`)
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

  if (!isAdmin(user)) {
    return (
      <Layout>
        <div className="card p-12 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-slate-600">Only administrators can access Bulk Sell.</p>
        </div>
      </Layout>
    )
  }

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
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">Bulk Sell</h1>
          <p className="text-slate-600 text-sm">Select multiple vehicles and generate one invoice</p>
        </div>

        <div className="card p-6 space-y-6">
          {/* Customer Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800">Customer Details</h3>
            <div>
              <label className="label">Customer Name *</label>
              <input
                type="text"
                value={bulkCustomerName}
                onChange={(e) => setBulkCustomerName(e.target.value)}
                className="input-field"
                placeholder="Enter customer name"
                style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
              />
            </div>
            <div>
              <label className="label">Customer Address</label>
              <input
                type="text"
                value={bulkCustomerAddress}
                onChange={(e) => setBulkCustomerAddress(e.target.value)}
                className="input-field"
                placeholder="Enter address (comma-separated)"
                style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
              />
            </div>
          </div>

          {/* Vehicle Selection */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800">Select Vehicles</h3>
            {vehicles.length === 0 ? (
              <div className="p-8 text-center border border-slate-200 rounded-lg">
                <p className="text-slate-600">No available vehicles to sell</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-4">
                {vehicles.map((vehicle) => (
                  <div key={vehicle.chassis_no} className="flex items-center gap-4 p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedVehiclesForBulk.has(vehicle.chassis_no)}
                      onChange={() => toggleVehicleSelection(vehicle.chassis_no)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">
                        {vehicle.maker} {vehicle.model}
                      </div>
                      <div className="text-sm text-slate-600">
                        Chassis: {vehicle.chassis_no} | Year: {vehicle.manufacturer_year}
                      </div>
                    </div>
                    {selectedVehiclesForBulk.has(vehicle.chassis_no) && (
                      <div className="w-32">
                        <label className="label text-xs">Expected Profit (JPY)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={bulkProfits[vehicle.chassis_no] || ''}
                          onChange={(e) => setBulkProfits({
                            ...bulkProfits,
                            [vehicle.chassis_no]: e.target.value
                          })}
                          className="input-field text-sm"
                          placeholder="Enter profit"
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {selectedVehiclesForBulk.size > 0 && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-sm font-semibold text-slate-800 mb-2">
                Selected: {selectedVehiclesForBulk.size} vehicle(s)
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200">
            <button
              onClick={() => {
                setSelectedVehiclesForBulk(new Set())
                setBulkProfits({})
                setBulkCustomerName('')
                setBulkCustomerAddress('')
              }}
              className="btn-secondary"
            >
              Clear
            </button>
            <button
              onClick={generateBulkInvoice}
              className="btn-primary"
              disabled={selectedVehiclesForBulk.size === 0 || !bulkCustomerName}
            >
              Generate Invoice
            </button>
          </div>
        </div>
      </motion.div>
    </Layout>
  )
}

