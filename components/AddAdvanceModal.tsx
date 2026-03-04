'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Vehicle, Advance, AdvancePayment } from '@/lib/database.types'
import { formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Printer, Trash2 } from 'lucide-react'
import jsPDF from 'jspdf'
import { addCompanyHeaderToPDF } from '@/lib/pdf-header'
import { getVehicleIdentifierSync, getVehicleIdentifierLabelSync } from '@/lib/vehicle-identifier'
import { getCompanySettings } from '@/lib/settings'
import { User } from '@/lib/supabase'

interface AddAdvanceModalProps {
  vehicle: Vehicle
  open: boolean
  onClose: () => void
  onSave: () => void
  user?: User | null
}

export default function AddAdvanceModal({
  vehicle,
  open,
  onClose,
  onSave,
  user,
}: AddAdvanceModalProps) {
  const [existingAdvance, setExistingAdvance] = useState<Advance | null>(null)
  const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [todayAmount, setTodayAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [bankTransferred, setBankTransferred] = useState(false)
  const [bankAccNo, setBankAccNo] = useState('')
  const [bankTransferDate, setBankTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [bankName, setBankName] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFirstAdvance, setIsFirstAdvance] = useState(true)

  useEffect(() => {
    if (open) {
      loadAdvanceData()
    }
  }, [open, vehicle.chassis_no])

  async function loadAdvanceData() {
    try {
      // Use .select() instead of .maybeSingle() to avoid 406 errors with RLS
      const { data: advances, error } = await supabase
        .from('advances')
        .select('*')
        .eq('chassis_no', vehicle.chassis_no)
        .limit(1)

      // 406 errors are expected when no row exists or RLS blocks - ignore them
      if (error) {
        // PGRST116 = no rows found, which is fine
        // 406 = not acceptable, often RLS-related but can be ignored if no data needed
        if (error.code !== 'PGRST116' && error.code !== 'PGRST204') {
          console.warn('Error loading advance (non-critical):', error)
        }
      }

      const advance = advances && advances.length > 0 ? advances[0] : null

      if (advance) {
        setExistingAdvance(advance)
        setCustomerName(advance.customer_name)
        setCustomerPhone(advance.customer_phone || '')
        setCustomerAddress(advance.customer_address || '')
        setCustomerId((advance as any).customer_id || '')
        setSellingPrice(advance.expected_sell_price_lkr.toString())
        setIsFirstAdvance(false)
      } else {
        setIsFirstAdvance(true)
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
        setCustomerId('')
        setSellingPrice('')
        setExistingAdvance(null)
      }
    } catch (err: any) {
      // Silently handle expected "no row" errors
      if (err?.code === 'PGRST116' || err?.code === 'PGRST204' || err?.message?.includes('406')) {
        setIsFirstAdvance(true)
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
        setCustomerId('')
        setSellingPrice('')
        setExistingAdvance(null)
      } else {
        console.error('Unexpected error loading advance:', err)
      }
    }

    const { data: payments } = await supabase
      .from('advance_payments')
      .select('*')
      .eq('chassis_no', vehicle.chassis_no)
      .order('paid_date', { ascending: true })

    setAdvancePayments(payments || [])
    setTodayAmount('')
    setPaymentDate(new Date().toISOString().split('T')[0])
  }

  function calculateTotalAdvance(): number {
    const existingTotal = advancePayments.reduce((sum, p) => sum + p.amount_lkr, 0)
    const today = parseFloat(todayAmount) || 0
    return existingTotal + today
  }

  async function handleSave() {
    if (!todayAmount || parseFloat(todayAmount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    setLoading(true)
    try {
      if (isFirstAdvance) {
        if (!customerName || !sellingPrice) {
          alert('Please fill in all required fields')
          setLoading(false)
          return
        }

        // Verify vehicle exists first
        const { data: vehicleCheck, error: vehicleCheckError } = await supabase
          .from('vehicles')
          .select('chassis_no')
          .eq('chassis_no', vehicle.chassis_no)
          .maybeSingle()

        if (vehicleCheckError) {
          console.error('Error checking vehicle:', vehicleCheckError)
          throw new Error(`Vehicle not found: ${vehicleCheckError.message}`)
        }

        if (!vehicleCheck) {
          throw new Error(`Vehicle with chassis number ${vehicle.chassis_no} does not exist. Please save the vehicle first.`)
        }

        // Get current user for tracking
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        const userRole = (currentUser?.user_metadata?.role as 'admin' | 'staff') || 'staff'

        // Create advance record
        // Note: If amount_lkr is required, we'll set it to 0 for the initial advance record
        // The actual payment will be added to advance_payments table
        const { error: advanceError, data: advanceData } = await supabase
          .from('advances')
          .insert({
            chassis_no: vehicle.chassis_no,
            customer_name: customerName.trim(),
            customer_phone: customerPhone?.trim() || null,
            customer_address: customerAddress?.trim() || null,
            customer_id: customerId?.trim() || null,
            expected_sell_price_lkr: parseFloat(sellingPrice),
            amount_lkr: parseFloat(todayAmount) || 0, // Add amount_lkr if required by schema
            created_by: currentUser?.id || null,
            created_by_role: userRole,
          })
          .select()

        if (advanceError) {
          console.error('Advance insert error:', advanceError)
          console.error('Attempted data:', {
            chassis_no: vehicle.chassis_no,
            customer_name: customerName.trim(),
            customer_phone: customerPhone?.trim() || null,
            customer_address: customerAddress?.trim() || null,
            expected_sell_price_lkr: parseFloat(sellingPrice),
          })
          throw new Error(`Failed to create advance: ${advanceError.message || advanceError.code || 'Unknown error'}`)
        }
      }

      // Get current user for tracking
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const userRole = (currentUser?.user_metadata?.role as 'admin' | 'staff') || 'staff'

      // Add payment
      const { error: paymentError } = await supabase
        .from('advance_payments')
        .insert({
          chassis_no: vehicle.chassis_no,
          // Use selected payment date instead of forcing today's date
          paid_date: paymentDate,
          amount_lkr: parseFloat(todayAmount),
          bank_transferred: bankTransferred,
          bank_acc_no: bankTransferred ? bankAccNo?.trim() || null : null,
          bank_transfer_date: bankTransferred ? bankTransferDate : null,
          bank_name: bankTransferred ? bankName?.trim() || null : null,
          created_by: currentUser?.id || null,
          created_by_role: userRole,
        })

      if (paymentError) throw paymentError

      // Generate receipt
      const printReceipt = confirm('Print Advance Receipt?')
      if (printReceipt) {
        await generateReceipt(bankTransferred, bankAccNo, bankTransferDate, bankName)
      }

      // Reset bank transfer fields
      setBankTransferred(false)
      setBankAccNo('')
      setBankTransferDate(new Date().toISOString().split('T')[0])
      setBankName('')
      setPaymentDate(new Date().toISOString().split('T')[0])

      onSave()
      onClose()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAdvance() {
    if (!confirm('Are you sure you want to delete all advance payments and customer information for this vehicle? This action cannot be undone.')) {
      return
    }

    setLoading(true)
    try {
      // Delete all advance payments for this vehicle
      const { error: paymentsError } = await supabase
        .from('advance_payments')
        .delete()
        .eq('chassis_no', vehicle.chassis_no)

      if (paymentsError) throw paymentsError

      // Delete the advance record (customer info)
      const { error: advanceError } = await supabase
        .from('advances')
        .delete()
        .eq('chassis_no', vehicle.chassis_no)

      if (advanceError) {
        // If advance doesn't exist, that's okay - just continue
        if (advanceError.code !== 'PGRST116' && advanceError.code !== 'PGRST204') {
          throw advanceError
        }
      }

      alert('All advance payments and customer information have been deleted successfully.')
      onSave()
      onClose()
    } catch (error: any) {
      alert(`Error deleting advance: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function generateReceipt(
    isBankTransferred: boolean = false,
    accNo: string = '',
    transferDate: string = '',
    bank: string = ''
  ) {
    try {
      // Get settings to determine identifier
      const settings = await getCompanySettings()
      const vehicleIdentifier = getVehicleIdentifierSync(vehicle, settings.enable_sri_lanka_purchase)
      const vehicleIdentifierLabel = getVehicleIdentifierLabelSync(vehicle, settings.enable_sri_lanka_purchase)
      
      const totalAdvance = calculateTotalAdvance()
      const remaining = parseFloat(sellingPrice) - totalAdvance
      const receiptNumber = String(Date.now()).slice(-4).padStart(4, '0')
      const receiptDate = new Date().toLocaleDateString()
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Add company header with logo
      let headerY = await addCompanyHeaderToPDF(pdf, 20)

      // ADVANCE PAYMENT RECEIPT title (middle)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('ADVANCE PAYMENT RECEIPT', 105, headerY, { align: 'center' })
      headerY += 10

      // Receipt No (right corner, left-aligned) and Date (left, with label)
      const receiptNoX = 160 // Right corner but left-aligned
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Receipt No: ${receiptNumber}`, receiptNoX, headerY)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Date: ${receiptDate}`, 20, headerY)

      let currentY = headerY + 10

      // Customer Details (below date)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      if (customerName) {
        pdf.text(`Name: ${customerName}`, 20, currentY)
        currentY += 6
      }
      if (customerPhone) {
        pdf.text(`Phone: ${customerPhone}`, 20, currentY)
        currentY += 6
      }
      if (customerAddress) {
        pdf.text(`Address: ${customerAddress}`, 20, currentY)
        currentY += 6
      }
      if (customerId) {
        pdf.text(`ID: ${customerId}`, 20, currentY)
        currentY += 6
      }
      
      // Draw a line after customer details
      currentY += 4
      pdf.setDrawColor(0, 0, 0)
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

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
      pdf.text(vehicle.maker, valueStartX, currentY)
      currentY += 6
      
      pdf.text('Model', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(vehicle.model, valueStartX, currentY)
      currentY += 6
      
      pdf.text(vehicleIdentifierLabel, labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(vehicleIdentifier, valueStartX, currentY)
      currentY += 6
      
      pdf.text('Year', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(vehicle.manufacturer_year.toString(), valueStartX, currentY)
      currentY += 6
      
      pdf.text('Mileage', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(`${vehicle.mileage.toLocaleString()} km`, valueStartX, currentY)
      currentY += 8

      // Unit Price
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Unit Price', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(parseFloat(sellingPrice)), valueStartX, currentY)
      currentY += 8

      // Line separator
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Advance Payments Table (Date and Amount)
      const advanceTableStartY = currentY
      const dateX = labelStartX + 10
      const amountX = dateX + 35
      
      // All advance payments (including today's if applicable)
      const allPayments = [...advancePayments]
      if (parseFloat(todayAmount) > 0) {
        allPayments.push({
          id: 'today',
          chassis_no: vehicle.chassis_no,
          // Use the selected payment date for today's payment in the receipt
          paid_date: paymentDate,
          amount_lkr: parseFloat(todayAmount),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          bank_transferred: isBankTransferred,
          bank_acc_no: accNo,
          bank_transfer_date: transferDate,
          bank_name: bank
        } as any)
      }
      
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      allPayments.forEach(payment => {
        const paymentDate = new Date(payment.paid_date).toLocaleDateString()
        pdf.text(paymentDate, dateX, currentY)
        pdf.text(formatCurrency(payment.amount_lkr), amountX, currentY)
        currentY += 6
        
        // Print bank transfer details if applicable
        const paymentBankTransferred = (payment as any).bank_transferred || false
        if (paymentBankTransferred) {
          const paymentAccNo = (payment as any).bank_acc_no || ''
          const paymentTransferDate = (payment as any).bank_transfer_date || ''
          const paymentBankName = (payment as any).bank_name || ''
          
          if (paymentAccNo || paymentTransferDate || paymentBankName) {
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(9)
            if (paymentBankName) {
              pdf.text(`  Bank: ${paymentBankName}`, dateX, currentY)
              currentY += 5
            }
            if (paymentAccNo) {
              pdf.text(`  Acc No: ${paymentAccNo}`, dateX, currentY)
              currentY += 5
            }
            if (paymentTransferDate) {
              pdf.text(`  Date: ${new Date(paymentTransferDate).toLocaleDateString()}`, dateX, currentY)
              currentY += 5
            }
            pdf.setFont('helvetica', 'bold')
          }
        }
      })
      
      currentY += 6

      // Total Advance (right side, aligned with Unit Price value)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Total Advance', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(totalAdvance), valueStartX, currentY)
      currentY += 8

      // Line separator after Total Advance
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Amount to be Paid
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Amount to be Paid', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(remaining), valueStartX, currentY)
      currentY += 8

      // Fill lower part of page
      const pageHeight = pdf.internal.pageSize.getHeight()
      currentY = pageHeight - 50 // Moved higher (reduced gap)

      // Left corner: Authorized Signature section (with extra dots)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('..............................', 20, currentY) // Extra dots for signature
      
      // Right corner: Customer Signature section (with extra dots)
      const rightSignatureX = 160 // Right side alignment
      pdf.text('..............................', rightSignatureX, currentY) // Extra dots for signature
      currentY += 8
      
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Authorized Signature', 20, currentY)
      
      // Right corner: Customer Signature label
      pdf.text('Customer Signature', rightSignatureX, currentY)

      // Save PDF
      pdf.save(`Advance-Receipt-${vehicle.chassis_no}-${Date.now()}.pdf`)
    } catch (error: any) {
      console.error('Error generating receipt:', error)
      alert(`Error generating receipt: ${error.message}`)
    }
  }

  const totalAdvance = calculateTotalAdvance()
  const remaining = parseFloat(sellingPrice) - totalAdvance

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              style={{ position: 'relative', zIndex: 10 }}
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Add Advance Payment</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {isFirstAdvance ? (
                  <>
                    <div style={{ position: 'relative', zIndex: 10 }}>
                      <label className="label">Customer Name *</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="input-field"
                        style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                        required
                      />
                    </div>
                    <div style={{ position: 'relative', zIndex: 10 }}>
                      <label className="label">Customer Phone</label>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="input-field"
                        style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                      />
                    </div>
                    <div style={{ position: 'relative', zIndex: 10 }}>
                      <label className="label">Customer Address</label>
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="input-field"
                        style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                      />
                    </div>
                    <div style={{ position: 'relative', zIndex: 10 }}>
                      <label className="label">Customer ID</label>
                      <input
                        type="text"
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="input-field"
                        style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                      />
                    </div>
                    <div style={{ position: 'relative', zIndex: 10 }}>
                      <label className="label">Selling Price (LKR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={sellingPrice}
                        onChange={(e) => setSellingPrice(e.target.value)}
                        className="input-field"
                        style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-2">Customer Information</h3>
                    <p><strong>Name:</strong> {customerName}</p>
                    <p><strong>Phone:</strong> {customerPhone || 'N/A'}</p>
                    <p><strong>Address:</strong> {customerAddress || 'N/A'}</p>
                    <p><strong>ID:</strong> {customerId || 'N/A'}</p>
                    <p className="mt-2"><strong>Selling Price:</strong> {formatCurrency(parseFloat(sellingPrice))}</p>
                  </div>
                )}

                {advancePayments.length > 0 && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h3 className="font-semibold mb-2">Previous Payments</h3>
                    <div className="space-y-1 text-sm">
                      {advancePayments.map((payment) => (
                        <div key={payment.id} className="flex justify-between">
                          <span>{new Date(payment.paid_date).toLocaleDateString()}</span>
                          <span>{formatCurrency(payment.amount_lkr)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-300">
                      <div className="flex justify-between font-semibold">
                        <span>Total Paid:</span>
                        <span className="text-green-700">{formatCurrency(advancePayments.reduce((sum, p) => sum + p.amount_lkr, 0))}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div style={{ position: 'relative', zIndex: 10 }}>
                    <label className="label">Payment Date *</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="input-field"
                      style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                      required
                    />
                  </div>
                  <div style={{ position: 'relative', zIndex: 10 }}>
                    <label className="label">Payment Amount (LKR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={todayAmount}
                      onChange={(e) => setTodayAmount(e.target.value)}
                      className="input-field"
                      style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                      placeholder="Enter amount"
                      required
                    />
                  </div>
                </div>

                {/* Bank Transfer Section */}
                <div className="border-t border-stone-200 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      checked={bankTransferred}
                      onChange={(e) => {
                        setBankTransferred(e.target.checked)
                        if (!e.target.checked) {
                          setBankAccNo('')
                          setBankTransferDate(new Date().toISOString().split('T')[0])
                          setBankName('')
                        }
                      }}
                      className="w-5 h-5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                      style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                    />
                    <span className="font-semibold text-stone-800">Bank Transferred</span>
                  </label>

                  {bankTransferred && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                      <div style={{ position: 'relative', zIndex: 10 }}>
                        <label className="label">Bank Name</label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="input-field"
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                          placeholder="Enter bank name"
                        />
                      </div>
                      <div style={{ position: 'relative', zIndex: 10 }}>
                        <label className="label">Account Number</label>
                        <input
                          type="text"
                          value={bankAccNo}
                          onChange={(e) => setBankAccNo(e.target.value)}
                          className="input-field"
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                          placeholder="Enter account number"
                        />
                      </div>
                      <div style={{ position: 'relative', zIndex: 10 }}>
                        <label className="label">Transfer Date</label>
                        <input
                          type="date"
                          value={bankTransferDate}
                          onChange={(e) => setBankTransferDate(e.target.value)}
                          className="input-field"
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {sellingPrice && (
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-semibold">Total Advance:</span>
                        <span className="text-xl font-bold text-green-700">{formatCurrency(totalAdvance)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-green-300">
                        <span className="font-semibold">Remaining Balance:</span>
                        <span className="text-xl font-bold text-slate-800">{formatCurrency(remaining)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 flex items-center justify-between">
                {/* Delete button on the left - small */}
                {!isFirstAdvance && (
                  <button
                    onClick={handleDeleteAdvance}
                    className="px-3 py-1.5 text-sm flex items-center gap-1.5 text-red-600 hover:bg-red-50 border border-red-300 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Advance
                  </button>
                )}
                {isFirstAdvance && <div></div>} {/* Spacer when no delete button */}
                
                {/* Action buttons on the right */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={onClose}
                    className="btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn-primary flex items-center gap-2"
                    disabled={loading || !todayAmount}
                  >
                    {loading ? 'Saving...' : 'Save & Print Receipt'}
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

