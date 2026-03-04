'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Vehicle, Advance, AdvancePayment } from '@/lib/database.types'
import { User } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, FileCheck, ChevronLeft } from 'lucide-react'
import jsPDF from 'jspdf'
import { addCompanyHeaderToPDF } from '@/lib/pdf-header'
import { getCompanyNameForFooter } from '@/lib/pdf-footer'
import { getVehicleIdentifierSync, getVehicleIdentifierLabelSync } from '@/lib/vehicle-identifier'
import { getCompanySettings } from '@/lib/settings'

interface GenerateInvoiceModalProps {
  user: User
}

export default function GenerateInvoiceModal({ user }: GenerateInvoiceModalProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  
  // Invoice form fields
  const [invoicePrice, setInvoicePrice] = useState('')
  const [financeAmount, setFinanceAmount] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAddress, setBankAddress] = useState('')
  const [engineNo, setEngineNo] = useState('')
  const [engineCapacity, setEngineCapacity] = useState('')
  const [color, setColor] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [seatingCapacity, setSeatingCapacity] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>([])
  const [existingAdvance, setExistingAdvance] = useState<Advance | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadVehicles()
  }, [])

  useEffect(() => {
    if (selectedVehicle && showInvoiceForm) {
      loadVehicleData()
    }
  }, [selectedVehicle, showInvoiceForm])

  async function loadVehicles() {
    try {
      // Load available vehicles that don't have invoices generated
      // Vehicles with invoice generated have engine_no, engine_capacity, color, fuel_type, seating_capacity filled
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading vehicles:', error)
        return
      }

      // Filter out vehicles that already have invoices generated
      // (have all invoice description fields filled - check for truthy values and non-empty strings)
      // Note: Database uses 'colour' but TypeScript interface uses 'color'
      const vehiclesWithoutInvoices = (data || []).filter(v => {
        const vehicleColor = (v as any).colour || v.color // Check both column names
        // Convert to strings and check if they're non-empty
        const engineNo = String(v.engine_no || '').trim()
        const engineCapacity = String(v.engine_capacity || '').trim()
        const color = String(vehicleColor || '').trim()
        const fuelType = String(v.fuel_type || '').trim()
        const seatingCapacity = String(v.seating_capacity || '').trim()
        
        const hasInvoice = engineNo !== '' &&
                          engineCapacity !== '' &&
                          color !== '' &&
                          fuelType !== '' &&
                          seatingCapacity !== ''
        return !hasInvoice
      })

      console.log('Total vehicles:', data?.length || 0)
      console.log('Vehicles without invoices:', vehiclesWithoutInvoices.length)
      setVehicles(vehiclesWithoutInvoices)
      setLoading(false)
    } catch (error: any) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  async function loadVehicleData() {
    if (!selectedVehicle) return

    try {
      // Load advance data
      const { data: advances } = await supabase
        .from('advances')
        .select('*')
        .eq('chassis_no', selectedVehicle.chassis_no)
        .limit(1)

      const advance = advances && advances.length > 0 ? advances[0] : null

      if (advance) {
        setExistingAdvance(advance)
        setCustomerName(advance.customer_name)
        setCustomerPhone(advance.customer_phone || '')
        setCustomerAddress(advance.customer_address || '')
        setCustomerId((advance as any).customer_id || '')
      } else {
        setExistingAdvance(null)
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
        setCustomerId('')
      }

      // Load advance payments
      const { data: payments } = await supabase
        .from('advance_payments')
        .select('*')
        .eq('chassis_no', selectedVehicle.chassis_no)
        .order('paid_date', { ascending: true })

      setAdvancePayments(payments || [])

      // Load vehicle description fields if they exist
      setEngineNo(selectedVehicle.engine_no || '')
      setEngineCapacity(selectedVehicle.engine_capacity || '')
      // Database uses 'colour' not 'color'
      setColor((selectedVehicle as any).colour || selectedVehicle.color || '')
      setFuelType(selectedVehicle.fuel_type || '')
      setSeatingCapacity(selectedVehicle.seating_capacity || '')

      // Set default invoice price (can be different from unit price)
      if (advance) {
        setInvoicePrice(advance.expected_sell_price_lkr.toString())
      } else {
        setInvoicePrice('')
      }

      // Reset finance amount
      setFinanceAmount('')
    } catch (error: any) {
      console.error('Error loading vehicle data:', error)
    }
  }

  function calculateTotalAdvance(): number {
    return advancePayments.reduce((sum, p) => sum + p.amount_lkr, 0)
  }

  function calculateInvoicePriceLKR(): number {
    const price = parseFloat(invoicePrice) || 0
    return price // Only LKR is used
  }

  // Convert number to words (for invoice balance amount) - using millions format
  function numberToWords(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    
    if (num === 0) return 'Zero'
    
    const convertHundreds = (n: number): string => {
      if (n === 0) return ''
      if (n < 20) return ones[n]
      if (n < 100) {
        const ten = Math.floor(n / 10)
        const one = n % 10
        return tens[ten] + (one > 0 ? ' ' + ones[one] : '')
      }
      const hundred = Math.floor(n / 100)
      const remainder = n % 100
      return ones[hundred] + ' Hundred' + (remainder > 0 ? ' ' + convertHundreds(remainder) : '')
    }
    
    const convert = (n: number): string => {
      if (n === 0) return 'Zero'
      
      let result = ''
      
      // Millions (1,000,000)
      const millions = Math.floor(n / 1000000)
      if (millions > 0) {
        result += convertHundreds(millions) + ' Million '
        n = n % 1000000
      }
      
      // Thousands (1,000)
      const thousands = Math.floor(n / 1000)
      if (thousands > 0) {
        result += convertHundreds(thousands) + ' Thousand '
        n = n % 1000
      }
      
      // Hundreds and below
      if (n > 0) {
        result += convertHundreds(n)
      }
      
      return result.trim()
    }
    
    // Handle decimal part (cents)
    const wholePart = Math.floor(num)
    const decimalPart = Math.round((num - wholePart) * 100)
    
    let words = convert(wholePart)
    if (decimalPart > 0) {
      words += ' and ' + convertHundreds(decimalPart) + ' Cents'
    }
    
    return words
  }

  async function handleGenerateInvoice() {
    if (!selectedVehicle) return

    // Validation
    if (!invoicePrice || !customerName || !bankName || !bankAddress) {
      alert('Please fill in all required fields (Invoice Price, Customer Name, Bank Name, Bank Address)')
      return
    }

    if (!engineNo || !engineCapacity || !color || !fuelType || !seatingCapacity) {
      alert('Please fill in all required vehicle description fields (Engine No, Engine Capacity, Colour, Fuel Type, Seating Capacity)')
      return
    }


    setGenerating(true)

    try {
      const invoicePriceLKR = calculateInvoicePriceLKR()
      const totalAdvance = calculateTotalAdvance()
      const balancePaid = invoicePriceLKR - totalAdvance

      // Save invoice data to database (we can create an invoices table or use a flag)
      // For now, we'll save vehicle description fields
      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          engine_no: engineNo,
          engine_capacity: engineCapacity,
          colour: color, // Database uses 'colour' not 'color'
          fuel_type: fuelType,
          seating_capacity: seatingCapacity,
        })
        .eq('chassis_no', selectedVehicle.chassis_no)

      if (updateError) {
        console.error('Error updating vehicle:', updateError)
        alert(`Error saving invoice data: ${updateError.message}`)
        setGenerating(false)
        return
      }

      // Verify the update was successful
      const { data: updatedVehicle } = await supabase
        .from('vehicles')
        .select('engine_no, engine_capacity, colour, fuel_type, seating_capacity')
        .eq('chassis_no', selectedVehicle.chassis_no)
        .single()

      if (!updatedVehicle || !updatedVehicle.engine_no || !updatedVehicle.engine_capacity || !updatedVehicle.colour || !updatedVehicle.fuel_type || !updatedVehicle.seating_capacity) {
        alert('Warning: Invoice data may not have been saved correctly. Please check the vehicle in Available Vehicles.')
      }

      // Generate invoice PDF
      await generateInvoicePDF(invoicePriceLKR, totalAdvance, parseFloat(financeAmount) || 0)

      // Reload vehicles to update list (this will remove the vehicle from the list)
      await loadVehicles()
      
      // Reset form
      setShowInvoiceForm(false)
      setSelectedVehicle(null)
      
      alert('Invoice generated successfully! The vehicle has been removed from the Generate Invoice list and marked as "Invoice Generated" in Available Vehicles.')
    } catch (error: any) {
      console.error('Error generating invoice:', error)
      alert(`Error generating invoice: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  async function generateInvoicePDF(invoicePriceLKR: number, totalAdvance: number, financeAmount: number = 0) {
    if (!selectedVehicle) return

    try {
      // Get settings to determine identifier
      const settings = await getCompanySettings()
      const vehicleIdentifier = getVehicleIdentifierSync(selectedVehicle, settings.enable_sri_lanka_purchase)
      const vehicleIdentifierLabel = getVehicleIdentifierLabelSync(selectedVehicle, settings.enable_sri_lanka_purchase)
      
      const balancePaid = invoicePriceLKR - totalAdvance
      // Generate shorter invoice number (e.g., 0001, 0002, etc.)
      const invoiceNumber = String(Date.now()).slice(-4).padStart(4, '0')
      const invoiceDateStr = new Date(invoiceDate).toLocaleDateString()

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Add company header with logo
      let headerY = await addCompanyHeaderToPDF(pdf, 20)

      // INVOICE title (middle)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('INVOICE', 105, headerY, { align: 'center' })
      headerY += 10

      // Invoice No (right corner, left-aligned) and Date (left, with label)
      const invoiceNoX = 160 // Right corner but left-aligned
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Invoice No: ${invoiceNumber}`, invoiceNoX, headerY)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Date: ${invoiceDateStr}`, 20, headerY)

      // Left side: To: Bank Details
      let currentY = headerY + 10
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('To:', 20, currentY)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text(bankName, 20, 82)
      const bankAddressLines = bankAddress ? bankAddress.split(',').map(l => l.trim()).filter(l => l) : []
      let bankY = 89
      bankAddressLines.forEach(line => {
        pdf.text(line, 20, bankY)
        bankY += 6
      })

      // Right side: Deliver To: Customer Details (left-aligned but on right side)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Deliver To:', invoiceNoX, 75)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text(customerName, invoiceNoX, 82)
      if (customerPhone) {
        pdf.text(`Phone: ${customerPhone}`, invoiceNoX, 89)
      }
      const customerAddressLines = customerAddress ? customerAddress.split(',').map(l => l.trim()).filter(l => l) : []
      let customerY = customerPhone ? 96 : 89
      customerAddressLines.forEach(line => {
        pdf.text(line, invoiceNoX, customerY)
        customerY += 6
      })
      if (customerId) {
        pdf.text(`ID: ${customerId}`, invoiceNoX, customerY)
        customerY += 6
      }

      // Line separator
      const maxY = Math.max(bankY, customerY) + 3
      pdf.line(20, maxY, 190, maxY)
      currentY = maxY + 10 // Less space before Description (moved upward)

      // Description heading (centered)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Description', 105, currentY, { align: 'center' })
      currentY += 10

      // Aligned positions for labels, colons, and values (left side)
      const labelStartX = 20 // Left side
      const colonX = 80 // Colon position (1 tab after label)
      const valueStartX = 90 // Value starts 1 tab after colon

      // Vehicle Details in "Label: Value" format (aligned, left side)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Maker', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(selectedVehicle.maker, valueStartX, currentY)
      currentY += 6
      
      pdf.text('Model', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(selectedVehicle.model, valueStartX, currentY)
      currentY += 6
      
      pdf.text(vehicleIdentifierLabel, labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(vehicleIdentifier, valueStartX, currentY)
      currentY += 6
      
      pdf.text('Year', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(selectedVehicle.manufacturer_year.toString(), valueStartX, currentY)
      currentY += 6
      
      pdf.text('Mileage', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(`${selectedVehicle.mileage.toLocaleString()} km`, valueStartX, currentY)
      currentY += 6
      
      pdf.text('Engine No', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(String(engineNo || 'N/A'), valueStartX, currentY)
      currentY += 6
      
      pdf.text('Engine Capacity', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(`${String(engineCapacity || 'N/A')} cc`, valueStartX, currentY)
      currentY += 6
      
      pdf.text('Colour', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(String(color || 'N/A'), valueStartX, currentY)
      currentY += 6
      
      pdf.text('Fuel Type', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(String(fuelType || 'N/A'), valueStartX, currentY)
      currentY += 6
      
      pdf.text('Seating Capacity', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(String(seatingCapacity || 'N/A'), valueStartX, currentY)
      currentY += 8

      // Unit Price (under Seating Capacity, same X alignment)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Unit Price', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(invoicePriceLKR), valueStartX, currentY)
      currentY += 8

      // Line separator
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Finance Amount (if provided, for printing only)
      if (financeAmount > 0) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.text('Finance Amount', labelStartX, currentY)
        pdf.text(':', colonX, currentY)
        pdf.text(formatCurrency(financeAmount), valueStartX, currentY)
        currentY += 8
      }
      
      // Ensure minimum spacing before footer
      currentY += 20

      // Fill lower part of page with spacing
      const pageHeight = pdf.internal.pageSize.getHeight()
      
      // Move "Please draw..." up a bit
      currentY = pageHeight - 40

      // Footer text (moved up)
      const companyName = await getCompanyNameForFooter()
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Please draw the payment in favour of ${companyName}`, 105, currentY, { align: 'center' })
      currentY += 15

      // Left corner: Signature section
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('..............................', 20, currentY) // Dots for signature (enough length)
      currentY += 8
      
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Authorized Signature', 20, currentY)

      // Save PDF
      pdf.save(`Invoice-${selectedVehicle.chassis_no}-${Date.now()}.pdf`)
    } catch (error: any) {
      console.error('Error generating invoice:', error)
      alert(`Error generating invoice: ${error.message}`)
      throw error
    }
  }

  const filteredVehicles = vehicles.filter(v => 
    v.chassis_no.toString().toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalAdvance = calculateTotalAdvance()
  const invoicePriceLKR = calculateInvoicePriceLKR()
  const balanceAfterAdvance = invoicePriceLKR - totalAdvance

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (showInvoiceForm && selectedVehicle) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => {
              setShowInvoiceForm(false)
              setSelectedVehicle(null)
            }}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-stone-900">Generate Invoice</h1>
            <p className="text-stone-700">Vehicle: {selectedVehicle.maker} {selectedVehicle.model} ({selectedVehicle.chassis_no})</p>
          </div>
        </div>

        <div className="card p-6 space-y-6" style={{ position: 'relative', zIndex: 1 }}>
          {/* Invoice Price */}
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200" style={{ position: 'relative', zIndex: 1 }}>
            <h3 className="font-semibold text-amber-900 mb-3">Invoice Price *</h3>
            <div style={{ position: 'relative', zIndex: 10 }}>
              <label className="label">Invoice Price (LKR) *</label>
              <input
                type="number"
                step="0.01"
                value={invoicePrice}
                onChange={(e) => setInvoicePrice(e.target.value)}
                className="input-field"
                required
                placeholder="Enter price in LKR"
                style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
              />
            </div>
            <div className="mt-4" style={{ position: 'relative', zIndex: 10 }}>
              <label className="label">Finance Amount (LKR)</label>
              <input
                type="number"
                step="0.01"
                value={financeAmount}
                onChange={(e) => setFinanceAmount(e.target.value)}
                className="input-field"
                placeholder="Enter finance amount (for printing only)"
                style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
              />
              <p className="text-xs text-stone-600 mt-1">This amount is only for printing on the invoice, not saved to database.</p>
            </div>
            <div className="mt-3 p-3 bg-white rounded border border-amber-200">
              <div className="flex justify-between text-sm">
                <span>Invoice Price (LKR):</span>
                <span className="font-semibold">{formatCurrency(invoicePriceLKR)}</span>
              </div>
            </div>
          </div>

          {/* Invoice Date */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <label className="label">Invoice Date *</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="input-field"
              required
              style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
            />
          </div>

          {/* Customer Details */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200" style={{ position: 'relative', zIndex: 1 }}>
            <h3 className="font-semibold text-blue-900 mb-3">Customer Details *</h3>
            <div className="grid grid-cols-2 gap-4">
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="input-field"
                  required
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                />
              </div>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Phone</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="input-field"
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                />
              </div>
              <div className="col-span-2" style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Address (separate by comma)</label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="input-field"
                  placeholder="Enter address, separated by comma"
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                />
              </div>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Customer ID</label>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="input-field"
                  placeholder="Enter customer ID"
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                />
                {existingAdvance && customerId && (
                  <p className="text-xs text-stone-500 mt-1">Loaded from advance payment record</p>
                )}
              </div>
            </div>
          </div>

          {/* Vehicle Description */}
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200" style={{ position: 'relative', zIndex: 1 }}>
            <h3 className="font-semibold text-amber-900 mb-3">Vehicle Description *</h3>
            <div className="grid grid-cols-2 gap-4">
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Engine No *</label>
                <input
                  type="text"
                  value={engineNo}
                  onChange={(e) => setEngineNo(e.target.value)}
                  className="input-field"
                  required
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                />
              </div>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Engine Capacity (cc) *</label>
                <input
                  type="text"
                  value={engineCapacity}
                  onChange={(e) => setEngineCapacity(e.target.value)}
                  className="input-field"
                  required
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                />
              </div>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Colour *</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="input-field"
                  required
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                />
              </div>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Fuel Type *</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="input-field"
                  required
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'pointer' }}
                >
                  <option value="">Select Fuel Type</option>
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                  <option value="CNG">CNG</option>
                </select>
              </div>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Seating Capacity *</label>
                <input
                  type="number"
                  min="1"
                  value={seatingCapacity}
                  onChange={(e) => setSeatingCapacity(e.target.value)}
                  className="input-field"
                  required
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                />
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200" style={{ position: 'relative', zIndex: 1 }}>
            <h3 className="font-semibold text-green-900 mb-3">Bank Details *</h3>
            <div className="grid grid-cols-1 gap-4">
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Name *</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="input-field"
                  required
                  placeholder="Enter bank name"
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                />
              </div>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label className="label">Address * (separate by comma)</label>
                <input
                  type="text"
                  value={bankAddress}
                  onChange={(e) => setBankAddress(e.target.value)}
                  className="input-field"
                  required
                  placeholder="Enter address, separated by comma"
                  style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                />
              </div>
            </div>
          </div>



          {/* Generate Button */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => {
                setShowInvoiceForm(false)
                setSelectedVehicle(null)
              }}
              className="flex-1 px-6 py-3 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateInvoice}
              disabled={generating}
              className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-stone-900 mb-2">Generate Invoice</h1>
          <p className="text-stone-700">Select a vehicle to generate an invoice</p>
        </div>
      </div>

      {/* Search by Chassis */}
      {vehicles.length > 0 && (
        <div className="card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by chassis number..."
              className="input-field pl-10"
            />
          </div>
          {searchQuery && (
            <div className="mt-3 text-sm text-stone-600 flex items-center gap-2">
              <span>
                Found {filteredVehicles.length} vehicle(s) matching "{searchQuery}"
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="ml-2 px-2 py-1 text-amber-700 hover:text-amber-800 underline text-xs"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="card p-12 text-center">
          <FileCheck className="w-16 h-16 mx-auto text-stone-400 mb-4" />
          <h3 className="text-xl font-semibold text-stone-700 mb-2">No Available Vehicles</h3>
          <p className="text-stone-600">No vehicles available for invoice generation</p>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-16 h-16 mx-auto text-stone-400 mb-4" />
          <h3 className="text-xl font-semibold text-stone-700 mb-2">No Vehicles Found</h3>
          <p className="text-stone-600">No vehicles match your search criteria</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredVehicles.map((vehicle, index) => (
            <motion.div
              key={vehicle.chassis_no}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card p-6 hover:shadow-xl transition-all duration-300 cursor-pointer"
              onClick={() => {
                setSelectedVehicle(vehicle)
                setShowInvoiceForm(true)
              }}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-stone-800">
                      {vehicle.maker} {vehicle.model}
                    </h3>
                    <p className="text-sm text-stone-600">
                      Chassis: {vehicle.chassis_no}
                    </p>
                    <p className="text-sm text-stone-600">
                      Year: {vehicle.manufacturer_year} | Mileage: {vehicle.mileage.toLocaleString()} km
                    </p>
                  </div>
                  <FileCheck className="w-6 h-6 text-amber-600" />
                </div>
                <button
                  className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedVehicle(vehicle)
                    setShowInvoiceForm(true)
                  }}
                >
                  <FileCheck className="w-4 h-4" />
                  Generate Invoice
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

