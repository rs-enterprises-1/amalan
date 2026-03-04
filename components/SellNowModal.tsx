'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Vehicle } from '@/lib/database.types'
import { formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import jsPDF from 'jspdf'
import { addCompanyHeaderToPDF } from '@/lib/pdf-header'
import { getVehicleIdentifierSync, getVehicleIdentifierLabelSync } from '@/lib/vehicle-identifier'
import { getCompanySettings } from '@/lib/settings'
import { getCompanyNameForFooter } from '@/lib/pdf-footer'

interface SellNowModalProps {
  vehicle: Vehicle
  open: boolean
  onClose: () => void
  onSave: () => void
}

export default function SellNowModal({
  vehicle,
  open,
  onClose,
  onSave,
}: SellNowModalProps) {
  const [buyerName, setBuyerName] = useState('')
  const [buyerAddress, setBuyerAddress] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [expectedProfitJpy, setExpectedProfitJpy] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!buyerName || !expectedProfitJpy) {
      alert('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const invoiceRate = vehicle.invoice_jpy_to_lkr_rate || 0
      const expectedProfitLkr = parseFloat(expectedProfitJpy) * invoiceRate
      const soldPriceJpy = (vehicle.invoice_amount_jpy || 0) + parseFloat(expectedProfitJpy)
      const soldPriceLkr = soldPriceJpy * invoiceRate
      const profitLkr = soldPriceLkr - (vehicle.japan_total_lkr || 0)

      // Create sale record
      const { error: saleError } = await supabase
        .from('sales')
        .insert({
          chassis_no: vehicle.chassis_no,
          sold_price: soldPriceJpy,
          sold_currency: 'JPY',
          rate_jpy_to_lkr: invoiceRate,
          profit: profitLkr, // Database uses 'profit' not 'profit_lkr'
          sold_date: new Date().toISOString().split('T')[0],
          customer_name: buyerName, // Database uses customer_name
          customer_address: buyerAddress || null,
          customer_phone: buyerPhone || null,
        })

      if (saleError) throw saleError

      // Update vehicle status
      await supabase
        .from('vehicles')
        .update({ status: 'sold' })
        .eq('chassis_no', vehicle.chassis_no)

      // Generate invoice
      const printInvoice = confirm('Print Invoice?')
      if (printInvoice) {
        await generateInvoice(soldPriceJpy)
      }

      onSave()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function generateInvoice(soldPriceJpy: number) {
    try {
      // Get settings to determine identifier
      const settings = await getCompanySettings()
      const vehicleIdentifier = getVehicleIdentifierSync(vehicle, settings.enable_sri_lanka_purchase)
      const vehicleIdentifierLabel = getVehicleIdentifierLabelSync(vehicle, settings.enable_sri_lanka_purchase)
      
      const invoiceRate = vehicle.invoice_jpy_to_lkr_rate || 0
      const invoiceNumber = String(Date.now()).slice(-4).padStart(4, '0')
      const invoiceDate = new Date().toISOString().split('T')[0]
      const invoiceDateStr = new Date(invoiceDate).toLocaleDateString()
      const invoiceNoX = 160

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
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Invoice No: ${invoiceNumber}`, invoiceNoX, headerY)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Date: ${invoiceDateStr}`, 20, headerY)

      // To: Customer Details (no "Deliver To:", no phone)
      let currentY = headerY + 10
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('To:', 20, currentY)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text(buyerName, 20, 82)
      const buyerAddressLines = buyerAddress ? buyerAddress.split(',').map(l => l.trim()).filter(l => l) : []
      let addressY = 89
      buyerAddressLines.forEach(line => {
        pdf.text(line, 20, addressY)
        addressY += 6
      })

      // Line separator
      const maxY = Math.max(addressY, 89) + 3
      pdf.line(20, maxY, 190, maxY)
      currentY = maxY + 10

      // Description heading (centered)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Description', 105, currentY, { align: 'center' })
      currentY += 10

      // Aligned positions for labels, colons, and values (left side)
      const labelStartX = 20
      const colonX = 80
      const valueStartX = 90

      // Vehicle Details in "Label: Value" format (basic details only, no engine no, etc.)
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

      // Unit Price in JPY (under vehicle details, same X alignment)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Unit Price', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(`${soldPriceJpy.toLocaleString()} JPY`, valueStartX, currentY)
      currentY += 8

      // Line separator
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Total/Price (no advance section)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Total', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(`${soldPriceJpy.toLocaleString()} JPY`, valueStartX, currentY)
      currentY += 8

      // Fill lower part of page
      const pageHeight = pdf.internal.pageSize.getHeight()
      currentY = pageHeight - 40

      // Footer text (moved up)
      const companyName = await getCompanyNameForFooter()
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Please draw the payment in favour of ${companyName}`, 105, currentY, { align: 'center' })
      currentY += 15

      // Left corner: Signature section (with extra dots)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('..............................', 20, currentY) // Extra dots for signature
      currentY += 8
      
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Authorized Signature', 20, currentY)

      // Save PDF
      pdf.save(`Invoice-${vehicle.chassis_no}-${Date.now()}.pdf`)
    } catch (error: any) {
      console.error('Error generating invoice:', error)
      alert(`Error generating invoice: ${error.message}`)
    }
  }

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
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Sell Now (Admin Only)</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-700">
                    <strong>Note:</strong> This will use the Invoice JPY → LKR rate ({vehicle.invoice_jpy_to_lkr_rate}) 
                    to convert the expected profit. Profit is stored internally in LKR and will NOT be shown on the invoice.
                  </p>
                </div>

                <div>
                  <label className="label">Buyer Name *</label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label">Buyer Address</label>
                  <input
                    type="text"
                    value={buyerAddress}
                    onChange={(e) => setBuyerAddress(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Buyer Phone</label>
                  <input
                    type="text"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Expected Profit (JPY) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={expectedProfitJpy}
                    onChange={(e) => setExpectedProfitJpy(e.target.value)}
                    className="input-field"
                    placeholder="Enter expected profit in JPY"
                    required
                  />
                  <p className="text-sm text-slate-600 mt-1">
                    Will be converted to LKR using invoice rate: {vehicle.invoice_jpy_to_lkr_rate}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Calculation Preview</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Invoice Amount (JPY):</span>
                      <span>{vehicle.invoice_amount_jpy?.toLocaleString() || 0} JPY</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Profit (JPY):</span>
                      <span>{parseFloat(expectedProfitJpy || '0').toLocaleString()} JPY</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-300 font-semibold">
                      <span>Sold Price (JPY):</span>
                      <span>
                        {((vehicle.invoice_amount_jpy || 0) + parseFloat(expectedProfitJpy || '0')).toLocaleString()} JPY
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-4">
                <button
                  onClick={onClose}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={loading || !buyerName || !expectedProfitJpy}
                >
                  {loading ? 'Processing...' : 'Sell & Print Invoice'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

