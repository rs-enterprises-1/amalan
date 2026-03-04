'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Vehicle, Advance, AdvancePayment } from '@/lib/database.types'
import { User } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, Receipt, ChevronLeft } from 'lucide-react'
import jsPDF from 'jspdf'
import { addCompanyHeaderToPDF } from '@/lib/pdf-header'
import { getVehicleIdentifierSync, getVehicleIdentifierLabelSync } from '@/lib/vehicle-identifier'
import { getCompanySettings } from '@/lib/settings'

interface MarkSoldModalProps {
  vehicle: Vehicle
  user: User
  open: boolean
  onClose: () => void
  onSave: () => void
}

type DocumentType = 'transaction' | null
type PaymentMethod = 'cash' | 'cheque' | 'both' | 'bank_transfer' | null

export default function MarkSoldModal({
  vehicle,
  user,
  open,
  onClose,
  onSave,
}: MarkSoldModalProps) {
  const [documentType, setDocumentType] = useState<DocumentType>(null)
  const [existingAdvance, setExistingAdvance] = useState<Advance | null>(null)
  const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [soldPrice, setSoldPrice] = useState('')
  const [soldDate, setSoldDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  // Transaction Summary specific fields
  const [hasLeasing, setHasLeasing] = useState(false)
  const [leaseCompany, setLeaseCompany] = useState('')
  const [leaseAmount, setLeaseAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null)
  const [cheque1No, setCheque1No] = useState('')
  const [cheque1Amount, setCheque1Amount] = useState('')
  const [cheque2No, setCheque2No] = useState('')
  const [cheque2Amount, setCheque2Amount] = useState('')
  const [cash5000, setCash5000] = useState('')
  const [cash2000, setCash2000] = useState('')
  const [cash1000, setCash1000] = useState('')
  const [cash500, setCash500] = useState('')
  const [cash100, setCash100] = useState('')
  const [bankTransferDepositDate, setBankTransferDepositDate] = useState(new Date().toISOString().split('T')[0])
  const [bankTransferBankName, setBankTransferBankName] = useState('')
  const [bankTransferAccNo, setBankTransferAccNo] = useState('')
  const [bankTransferAmount, setBankTransferAmount] = useState('')
  const [registration, setRegistration] = useState('')
  const [valuation, setValuation] = useState('')
  const [rLicence, setRLicence] = useState('')
  const [customerSignature, setCustomerSignature] = useState('')
  const [authorizedSignature, setAuthorizedSignature] = useState('')
  const [documentGenerated, setDocumentGenerated] = useState(false)
  const [generatedDocumentType, setGeneratedDocumentType] = useState<DocumentType>(null)
  const [documentPrinted, setDocumentPrinted] = useState(false) // Track if document was printed
  const [saleRecordId, setSaleRecordId] = useState<string | null>(null) // Store sale record ID to delete if cancelled
  const [vehicleStatusChanged, setVehicleStatusChanged] = useState(false) // Track if we changed vehicle status
  
  // Vehicle description fields for Invoice
  const [engineNo, setEngineNo] = useState('')
  const [engineCapacity, setEngineCapacity] = useState('')
  const [color, setColor] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [seatingCapacity, setSeatingCapacity] = useState('')
  
  // Bank details for Invoice
  const [bankName, setBankName] = useState('')
  const [bankAddress, setBankAddress] = useState('')

  useEffect(() => {
    if (open) {
      loadAdvanceData()
      setDocumentType(null)
      setDocumentGenerated(false)
      setGeneratedDocumentType(null)
      setDocumentPrinted(false)
      setSaleRecordId(null)
      setVehicleStatusChanged(false)
      // Load vehicle description fields if they exist
      // Handle both 'color' and 'colour' column names
      setEngineNo(vehicle.engine_no || '')
      setEngineCapacity(vehicle.engine_capacity || '')
      setColor((vehicle as any).colour || (vehicle as any).color || '')
      setFuelType(vehicle.fuel_type || '')
      setSeatingCapacity(vehicle.seating_capacity || '')
    }
  }, [open, vehicle.chassis_no])

  async function loadAdvanceData() {
    try {
      const { data: advances, error } = await supabase
        .from('advances')
        .select('*')
        .eq('chassis_no', vehicle.chassis_no)
        .limit(1)

      if (error && error.code !== 'PGRST116' && error.code !== 'PGRST204') {
        console.warn('Error loading advance (non-critical):', error)
      }

      const advance = advances && advances.length > 0 ? advances[0] : null

      if (advance) {
        setExistingAdvance(advance)
        setCustomerName(advance.customer_name)
        setCustomerPhone(advance.customer_phone || '')
        setCustomerAddress(advance.customer_address || '')
        setCustomerId((advance as any).customer_id || '')
        setSoldPrice(advance.expected_sell_price_lkr.toString())
      } else {
        setExistingAdvance(null)
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
        setCustomerId('')
        setSoldPrice('')
      }

      const { data: payments } = await supabase
        .from('advance_payments')
        .select('*')
        .eq('chassis_no', vehicle.chassis_no)
        .order('paid_date', { ascending: true })

      setAdvancePayments(payments || [])
    } catch (err: any) {
      if (err?.code !== 'PGRST116' && err?.code !== 'PGRST204' && !err?.message?.includes('406')) {
        console.error('Unexpected error loading advance:', err)
      }
    }
  }

  function calculateTotalAdvance(): number {
    return advancePayments.reduce((sum, p) => sum + p.amount_lkr, 0)
  }

  function calculateCashTotal(): number {
    const n5000 = parseFloat(cash5000) || 0
    const n2000 = parseFloat(cash2000) || 0
    const n1000 = parseFloat(cash1000) || 0
    const n500 = parseFloat(cash500) || 0
    const n100 = parseFloat(cash100) || 0
    return (n5000 * 5000) + (n2000 * 2000) + (n1000 * 1000) + (n500 * 500) + (n100 * 100)
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

  function calculateChequeTotal(): number {
    const c1 = parseFloat(cheque1Amount) || 0
    const c2 = parseFloat(cheque2Amount) || 0
    return c1 + c2
  }

  function calculateBalanceSettlement(): number {
    if (paymentMethod === 'cash') return calculateCashTotal()
    if (paymentMethod === 'cheque') return calculateChequeTotal()
    if (paymentMethod === 'both') return calculateCashTotal() + calculateChequeTotal()
    if (paymentMethod === 'bank_transfer') return parseFloat(bankTransferAmount) || 0
    return 0
  }

  function calculateOtherCharges(): number {
    const reg = parseFloat(registration) || 0
    const val = parseFloat(valuation) || 0
    const rl = parseFloat(rLicence) || 0
    return reg + val + rl
  }

  async function handleSave() {
    if (!documentType) {
      alert('Please select Transaction Summary')
      return
    }

    if (!soldPrice || !customerName) {
      alert('Please fill in all required fields')
      return
    }

    if (documentType === 'transaction') {
      if (hasLeasing && (!leaseCompany || !leaseAmount)) {
        alert('Please enter leasing company and amount')
        return
      }
      if (!paymentMethod) {
        alert('Please select payment method')
        return
      }
      if (paymentMethod === 'cheque' || paymentMethod === 'both') {
        if (!cheque1No || !cheque1Amount) {
          alert('Please enter at least one cheque number and amount')
          return
        }
      }
      if (paymentMethod === 'cash' || paymentMethod === 'both') {
        const cashTotal = calculateCashTotal()
        if (cashTotal === 0) {
          alert('Please enter cash denominations')
          return
        }
      }
      if (paymentMethod === 'bank_transfer') {
        if (!bankTransferDepositDate || !bankTransferBankName || !bankTransferAccNo || !bankTransferAmount) {
          alert('Please fill in all bank transfer details (Deposit Date, Bank Name, Account Number, Amount)')
          return
        }
      }
    }

    setLoading(true)
    try {
      const soldPriceNum = parseFloat(soldPrice)
      const totalCost = vehicle.final_total_lkr || vehicle.japan_total_lkr || 0
      const profitLkr = soldPriceNum - totalCost
      const totalAdvance = calculateTotalAdvance()
      const leaseAmountNum = parseFloat(leaseAmount) || 0

      // Get current user for tracking
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const userRole = (currentUser?.user_metadata?.role as 'admin' | 'staff') || 'staff'

      // Create sale record (temporary - will be kept if OK clicked, deleted if Cancel clicked)
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          chassis_no: vehicle.chassis_no,
          sold_price: soldPriceNum,
          sold_currency: 'LKR',
          rate_jpy_to_lkr: null,
          // Keep both legacy profit and new profit_lkr in sync
          profit: profitLkr,
          profit_lkr: profitLkr,
          sold_date: soldDate,
          // Keep legacy customer_* columns filled (for NOT NULL / existing reports)
          customer_name: customerName,
          customer_address: customerAddress || null,
          customer_phone: customerPhone || null,
          // Map customer details to buyer_* columns on the sales table (new fields)
          buyer_name: customerName,
          created_by: currentUser?.id || null,
          created_by_role: userRole,
          buyer_address: customerAddress || null,
          buyer_phone: customerPhone || null,
          // Store customer ID as requested
          customer_id: customerId?.trim() || null,
        })
        .select()
        .single()

      if (saleError) throw saleError

      // Store sale record ID for potential deletion if cancelled
      if (saleData) {
        setSaleRecordId(saleData.chassis_no) // Using chassis_no as ID since it's the primary key

        // Save all transaction details
        const { error: detailError } = await supabase
          .from('transaction_details')
          .insert({
            chassis_no: vehicle.chassis_no,
            document_type: documentType,
            customer_name: customerName,
            customer_phone: customerPhone || null,
            customer_address: customerAddress || null,
            customer_id: customerId?.trim() || null,
            lease_company: documentType === 'transaction' && hasLeasing ? leaseCompany : null,
            lease_amount: documentType === 'transaction' && hasLeasing ? (parseFloat(leaseAmount) || null) : null,
            payment_method: documentType === 'transaction' ? paymentMethod : null,
            cheque1_no: cheque1No || null,
            cheque1_amount: parseFloat(cheque1Amount) || null,
            cheque2_no: cheque2No || null,
            cheque2_amount: parseFloat(cheque2Amount) || null,
            cash_5000: parseInt(cash5000) || 0,
            cash_2000: parseInt(cash2000) || 0,
            cash_1000: parseInt(cash1000) || 0,
            cash_500: parseInt(cash500) || 0,
            cash_100: parseInt(cash100) || 0,
            bank_transfer_deposit_date: paymentMethod === 'bank_transfer' ? bankTransferDepositDate : null,
            bank_transfer_bank_name: paymentMethod === 'bank_transfer' ? bankTransferBankName : null,
            bank_transfer_acc_no: paymentMethod === 'bank_transfer' ? bankTransferAccNo : null,
            bank_transfer_amount: paymentMethod === 'bank_transfer' ? parseFloat(bankTransferAmount) : null,
            registration: parseFloat(registration) || 0,
            valuation: parseFloat(valuation) || 0,
            r_licence: parseFloat(rLicence) || 0,
            customer_signature: customerSignature || null,
            authorized_signature: authorizedSignature || null,
          })

        if (detailError) {
          console.warn('Error saving transaction details:', detailError)
          // Continue even if detail save fails
        }
      }

      // Update vehicle status and description fields (temporary - will be reverted if Cancel clicked)
      // Save vehicle description fields when generating invoice
      await supabase
        .from('vehicles')
        .update({ 
          status: 'sold',
          engine_no: engineNo || null,
          engine_capacity: engineCapacity || null,
          colour: color || null, // Database uses 'colour' not 'color'
          fuel_type: fuelType || null,
          seating_capacity: seatingCapacity || null,
        })
        .eq('chassis_no', vehicle.chassis_no)
      
      setVehicleStatusChanged(true)

      // Create lease collection if transaction summary (temporary - will be deleted if Cancel clicked)
      if (documentType === 'transaction' && hasLeasing && leaseAmountNum > 0) {
        const { error: leaseError } = await supabase
          .from('lease_collections')
          .insert({
            chassis_no: vehicle.chassis_no,
            due_amount_lkr: leaseAmountNum,
            due_date: soldDate,
            collected: false,
            lease_company: leaseCompany,
          })

        if (leaseError) {
          console.warn('Error creating lease collection:', leaseError)
          // Continue even if lease creation fails
        }
      }

      // Generate Transaction Summary
      const printDoc = confirm('Print Transaction Summary?')
      if (printDoc) {
        await generateTransactionSummary(soldPriceNum, totalAdvance, leaseAmountNum)
        setDocumentGenerated(true)
        setGeneratedDocumentType('transaction')
        // documentPrinted will be set to true inside generateTransactionSummary after PDF is saved
      }

      // Don't close modal - let user generate other document or click Done/Back
      setLoading(false)
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function generateInvoice(soldPriceNum: number, totalAdvance: number) {
    try {
      // Save vehicle description fields to database when generating invoice
      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          engine_no: engineNo || null,
          engine_capacity: engineCapacity || null,
          colour: color || null, // Database uses 'colour' not 'color'
          fuel_type: fuelType || null,
          seating_capacity: seatingCapacity || null,
        })
        .eq('chassis_no', vehicle.chassis_no)

      if (updateError) {
        console.error('Error saving vehicle description fields:', updateError)
        // Continue with invoice generation even if save fails
      }

      const balancePaid = soldPriceNum - totalAdvance
      const addressParts = customerAddress ? customerAddress.split(',').map(p => p.trim()).filter(p => p) : []
      const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : (customerAddress || 'N/A')
      const invoiceNumber = `INV-${vehicle.chassis_no}-${Date.now()}`
      const invoiceDate = new Date(soldDate).toLocaleDateString()

      // Load the blank PNG template
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => {
          console.error('Failed to load template image')
          reject(new Error('Failed to load invoice template'))
        }
        img.src = '/templates/invoice_blank.png'
      })

      // Create canvas to draw on the template
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        alert('Failed to create canvas')
        return
      }

      // Draw the template image
      ctx.drawImage(img, 0, 0)

      // Set text style (black text only, no colors)
      ctx.fillStyle = '#000000'
      ctx.textAlign = 'left'

      // ============================================
      
      // ============================================
      // Edit these X and Y values to adjust text positioning on the invoice template
      // ============================================
      const startX = 100  // ← EDIT THIS to move text left/right (default X position)
      
      // Fixed Y coordinates for each element (edit these values)
      const yInvoiceNumber = 460      // ← Invoice Number Y position
      const yDate = 535               // ← Date Y position
      const yVehicleDetailsTitle = 230 // ← "Vehicle Details:" title Y position
      const yMaker = 1370              // ← Maker Y position
      const yModel = 1430              // ← Model Y position
      const yChassis = 1550            // ← Chassis Number Y position
      const yYear = 1490               // ← Year Y position
      const yMileage = 1610            // ← Mileage Y position
      const yEngineNo = 1670           // ← Engine No Y position
      const yEngineCapacity = 1730     // ← Engine Capacity Y position
      const yColour = 1790             // ← Colour Y position
      const yFuelType = 1850           // ← Fuel Type Y position
      const ySeatingCapacity = 1910    // ← Seating Capacity Y position
      const yCustomerDetailsTitle = 475 // ← "Customer Details:" title Y position
      const yCustomerName = 500       // ← Customer Name Y position
      const yCustomerPhone = 520      // ← Customer Phone Y position
      const yCustomerAddress = 540    // ← Customer Address Y position (first line)
      const yBankDetailsTitle = 570   // ← "Bank Details:" title Y position
      const yBankName = 595            // ← Bank Name Y position
      const yBankAddress = 615        // ← Bank Address Y position (first line)
      const yPaymentSummaryTitle = 665 // ← "Payment Summary:" title Y position
      const yVehiclePrice = 2040       // ← Vehicle Price Y position
      const yAdvancePaymentsTitle = 715 // ← "Advance Payments:" title Y position
      const yAdvanceTableHeader = 2270 // ← Advance table header Y position
      const yAmountToBePaid = 2500     // ← "Amount to be Paid" Y position
      const yAmountInWords = 2780      // ← "Amount in Words" Y position

      // Invoice Number
      ctx.font = 'bold 18px "Open Sans", sans-serif'
      ctx.fillText(`Invoice No: ${invoiceNumber}`, 1950, yInvoiceNumber)

      // Date
      ctx.font = 'bold 16px "Open Sans", sans-serif'
      ctx.fillText(`Date: ${invoiceDate}`, 1950, yDate)

      // Vehicle Details
      ctx.font = 'bold 16px "Open Sans", sans-serif'
      ctx.fillText('Vehicle Details:', 1000, yVehicleDetailsTitle)
      ctx.font = 'bold 24px "Open Sans", sans-serif'
      ctx.fillText(`Maker: ${vehicle.maker}`, 1000, yMaker)
      ctx.fillText(`Model: ${vehicle.model}`, 1000, yModel)
      ctx.fillText(`Chassis Number: ${vehicle.chassis_no}`, 1000, yChassis)
      ctx.fillText(`Year: ${vehicle.manufacturer_year}`, 1000, yYear)
      ctx.fillText(`Mileage: ${vehicle.mileage.toLocaleString()} km`, 1000, yMileage)
      ctx.fillText(`Engine No: ${engineNo}`, 1000, yEngineNo)
      ctx.fillText(`Engine Capacity: ${engineCapacity} cc`, 1000, yEngineCapacity)
      ctx.fillText(`Colour: ${color}`, 1000, yColour)
      ctx.fillText(`Fuel Type: ${fuelType}`, 1000, yFuelType)
      ctx.fillText(`Seating Capacity: ${seatingCapacity}`, 1000, ySeatingCapacity)

      // Customer Detail
      ctx.font = 'bold 14px "Open Sans", sans-serif'
      ctx.fillText(`Name: ${customerName}`, 630, yCustomerName)
      ctx.fillText(`Phone: ${customerPhone || 'N/A'}`, 630, yCustomerPhone)
      
      // Handle multi-line address if needed
      const addressLines = formattedAddress.split(',').map(line => line.trim())
      let addressY = yCustomerAddress
      addressLines.forEach(line => {
        if (line) {
          ctx.fillText(`Address: ${line}`, 630, addressY)
          addressY += 25
        }
      })
      if (addressLines.length === 0) {
        ctx.fillText(`Address: N/A`, 630, yCustomerAddress)
      }

      // Bank Details
      ctx.font = 'bold 14px "Open Sans", sans-serif'
      ctx.fillText(`Name: ${bankName}`, 630, yBankName)
      
      // Handle multi-line address if needed (comma-separated)
      const bankAddressLines = bankAddress.split(',').map(line => line.trim()).filter(line => line)
      let bankAddressY = yBankAddress
      bankAddressLines.forEach(line => {
        if (line) {
          ctx.fillText(`Address: ${line}`, 630, bankAddressY)
          bankAddressY += 20
        }
      })
      if (bankAddressLines.length === 0) {
        ctx.fillText(`Address: N/A`, 630, yBankAddress)
      }

      // Payment Summary
      ctx.font = 'bold 14px "Open Sans", sans-serif'
      ctx.fillText(`Vehicle Price: ${formatCurrency(soldPriceNum)}`, 1650, yVehiclePrice)

      if (totalAdvance > 0) {
        // Advance payments list
        ctx.font = 'bold 12px "Open Sans", sans-serif'
        let advanceRowY = yAdvanceTableHeader
        advancePayments.forEach(payment => {
          ctx.fillText(new Date(payment.paid_date).toLocaleDateString(), 450, advanceRowY)
          ctx.fillText(formatCurrency(payment.amount_lkr), 1000, advanceRowY)
          advanceRowY += 50
        })
        
        // Total Advance
        ctx.font = 'bold 12px "Open Sans", sans-serif'
        ctx.fillText(formatCurrency(totalAdvance), 1650, 2380)
      }

      ctx.font = 'bold 16px "Open Sans", sans-serif'
      ctx.fillText(`Amount to be Paid: ${formatCurrency(balancePaid)}`, 1650, yAmountToBePaid)
      
      // Amount in words
      const amountInWords = numberToWords(balancePaid)
      ctx.font = 'bold 14px "Open Sans", sans-serif'
      ctx.fillText(`Amount in Words: ${amountInWords} Rupees Only`, 480, yAmountInWords)

      // Convert canvas to image
      const imgData = canvas.toDataURL('image/png')

      // Create PDF (A4 size)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Calculate dimensions to fit A4
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / (imgWidth * 0.264583), pdfHeight / (imgHeight * 0.264583)) // Convert px to mm
      const finalWidth = imgWidth * 0.264583 * ratio
      const finalHeight = imgHeight * 0.264583 * ratio

      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 0, 0, finalWidth, finalHeight)

      // Download PDF
      pdf.save(`Invoice-${vehicle.chassis_no}-${Date.now()}.pdf`)
    } catch (error: any) {
      console.error('Error generating invoice:', error)
      alert(`Error generating invoice: ${error.message}. Make sure the template file exists at /templates/invoice_blank.png`)
    }
  }

  async function generateTransactionSummary(
    soldPriceNum: number,
    totalAdvance: number,
    leaseAmountNum: number
  ) {
    try {
      // Get settings to determine identifier
      const settings = await getCompanySettings()
      const vehicleIdentifier = getVehicleIdentifierSync(vehicle, settings.enable_sri_lanka_purchase)
      const vehicleIdentifierLabel = getVehicleIdentifierLabelSync(vehicle, settings.enable_sri_lanka_purchase)
      
      const otherCharges = calculateOtherCharges()
      const paymentAmount = calculateBalanceSettlement() // Cash/Cheque payment amount
      
      // Amount to be Paid = Unit Price - Total Advance
      const amountToBePaid = soldPriceNum - totalAdvance
      
      // Balance Settlement = Amount to be Paid - Lease Amount
      const balanceSettlement = hasLeasing ? amountToBePaid - leaseAmountNum : amountToBePaid
      
      const summaryNumber = String(Date.now()).slice(-4).padStart(4, '0')
      const summaryDate = new Date(soldDate).toLocaleDateString()

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Add company header with logo
      let headerY = await addCompanyHeaderToPDF(pdf, 20)

      // TRANSACTION SUMMARY title (middle)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('TRANSACTION SUMMARY', 105, headerY, { align: 'center' })
      headerY += 10

      // Summary No (right corner, left-aligned) and Date (left, with label)
      const summaryNoX = 160
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Summary No: ${summaryNumber}`, summaryNoX, headerY)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Date: ${summaryDate}`, 20, headerY)

      let currentY = headerY + 10

      // To: Customer Details (no "Deliver To:")
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('To:', 20, currentY)
      // Name on same line after "To:" with just 4 spaces (approximately 32mm from start, 4 spaces after "To:")
      const nameStartX = 32
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text(customerName || 'N/A', nameStartX, currentY)
      currentY += 8
      // Address below at same X position as start of name - print as one line
      if (customerAddress) {
        pdf.text(customerAddress, nameStartX, currentY)
        currentY += 6
      }
      
      // Print customer ID if available
      if (customerId) {
        pdf.text(`ID: ${customerId}`, nameStartX, currentY)
        currentY += 6
      }
      
      currentY += 3

      // Line separator
      pdf.line(20, currentY, 190, currentY)
      currentY += 10

      // Aligned positions for labels, colons, and values (left side)
      const labelStartX = 20
      const colonX = 80
      const valueStartX = 90

      // Vehicle Details in "Label: Value" format
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
      pdf.text(formatCurrency(soldPriceNum), valueStartX, currentY)
      currentY += 8

      // Line separator
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Advance Payments Table
      if (totalAdvance > 0 && advancePayments.length > 0) {
        const dateX = labelStartX + 10
        const amountX = dateX + 35
        
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        advancePayments.forEach(payment => {
          pdf.text(new Date(payment.paid_date).toLocaleDateString(), dateX, currentY)
          pdf.text(formatCurrency(payment.amount_lkr), amountX, currentY)
          currentY += 6
        })
        currentY += 6

        // Total Advance
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.text('Total Advance', labelStartX, currentY)
        pdf.text(':', colonX, currentY)
        pdf.text(formatCurrency(totalAdvance), valueStartX, currentY)
        currentY += 8
      }

      // Amount to be Paid
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Amount to be Paid', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(amountToBePaid), valueStartX, currentY)
      currentY += 8

      // Leasing Details (if applicable)
      if (hasLeasing && leaseAmountNum > 0) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.text('Leasing Details', labelStartX, currentY)
        currentY += 6
        
        pdf.text('Lease Company', labelStartX + 5, currentY)
        pdf.text(':', colonX + 5, currentY)
        pdf.text(leaseCompany || 'N/A', valueStartX + 5, currentY)
        currentY += 6
        
        pdf.text('Lease Amount', labelStartX + 5, currentY)
        pdf.text(':', colonX + 5, currentY)
        pdf.text(formatCurrency(leaseAmountNum), valueStartX + 5, currentY)
        currentY += 8
      }

      // Balance Settlement
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Balance Settlement', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(balanceSettlement), valueStartX, currentY)
      currentY += 8

      // Line separator
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Payment Details Section
      if (paymentMethod === 'bank_transfer') {
        // Bank Transfer Details (single column)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.text('Bank Transfer Details:', labelStartX, currentY)
        currentY += 8
        
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.text(`Deposit Date: ${new Date(bankTransferDepositDate).toLocaleDateString()}`, labelStartX, currentY)
        currentY += 6
        pdf.text(`Bank Name: ${bankTransferBankName}`, labelStartX, currentY)
        currentY += 6
        pdf.text(`Account Number: ${bankTransferAccNo}`, labelStartX, currentY)
        currentY += 6
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.text(`Amount: ${formatCurrency(parseFloat(bankTransferAmount) || 0)}`, labelStartX, currentY)
        currentY += 8
      } else {
        // Two-column layout: Cheque on Left, Cash on Right
        const leftX = 20
        const rightX = 110
        let leftY = currentY
        let rightY = currentY
        let maxY = currentY

        // Left column: Cheque Details (with labels)
        const hasCheque1 = cheque1No && cheque1Amount && parseFloat(cheque1Amount) > 0
        const hasCheque2 = cheque2No && cheque2Amount && parseFloat(cheque2Amount) > 0
        
        if ((paymentMethod === 'cheque' || paymentMethod === 'both') && (hasCheque1 || hasCheque2)) {
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(10)
          pdf.text('Cheque Details:', leftX, leftY)
          leftY += 8
          
          // Add labels for Cheque No and Amount
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(9)
          pdf.text('Cheque No:', leftX, leftY)
          pdf.text('Amount:', leftX + 50, leftY)
          leftY += 6
          
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          if (hasCheque1) {
            pdf.text(`${cheque1No}`, leftX, leftY)
            pdf.text(`${formatCurrency(parseFloat(cheque1Amount))}`, leftX + 50, leftY)
            leftY += 6
          }
          if (hasCheque2) {
            pdf.text(`${cheque2No}`, leftX, leftY)
            pdf.text(`${formatCurrency(parseFloat(cheque2Amount))}`, leftX + 50, leftY)
            leftY += 6
          }
          leftY += 2
          if (leftY > maxY) maxY = leftY
        }

        // Right column: Cash Details
        const cashDenominations = [
          { label: '5000', value: cash5000 },
          { label: '2000', value: cash2000 },
          { label: '1000', value: cash1000 },
          { label: '500', value: cash500 },
          { label: '100', value: cash100 },
        ]
        
        const hasCash = cashDenominations.some(denom => denom.value && parseFloat(denom.value) > 0)
        
        if ((paymentMethod === 'cash' || paymentMethod === 'both') && hasCash) {
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(10)
          pdf.text('Cash Details:', rightX, rightY)
          rightY += 6
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          
          cashDenominations.forEach(denom => {
            if (denom.value && parseFloat(denom.value) > 0) {
              const qty = parseFloat(denom.value)
              const amount = qty * parseFloat(denom.label)
              pdf.text(`${denom.label} x ${qty} = ${formatCurrency(amount)}`, rightX, rightY)
              rightY += 6
            }
          })
          if (rightY > maxY) maxY = rightY
        }

        currentY = maxY + 8
      }

      // Other Charges
      if (otherCharges > 0) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.text('Other Charges:', labelStartX, currentY)
        currentY += 6
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        if (parseFloat(registration) > 0) {
          pdf.text(`Registration: ${formatCurrency(parseFloat(registration))}`, labelStartX, currentY)
          currentY += 6
        }
        if (parseFloat(valuation) > 0) {
          pdf.text(`Valuation: ${formatCurrency(parseFloat(valuation))}`, labelStartX, currentY)
          currentY += 6
        }
        if (parseFloat(rLicence) > 0) {
          pdf.text(`R/Licence: ${formatCurrency(parseFloat(rLicence))}`, labelStartX, currentY)
          currentY += 6
        }
        currentY += 3

        // Other Charges Total
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.text('Other Charges Total', labelStartX, currentY)
        pdf.text(':', colonX, currentY)
        pdf.text(formatCurrency(otherCharges), valueStartX, currentY)
        currentY += 15
      }

      // Signatures at the very end (after other charges)
      const pageHeight = pdf.internal.pageSize.getHeight()
      currentY = Math.max(currentY, pageHeight - 40) // Ensure minimum space from bottom

      // Left: Authorized Signature
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('..............................', 20, currentY)
      currentY += 8
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Authorized Signature', 20, currentY)

      // Right: Customer Signature
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('..............................', 110, currentY - 8)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Customer Signature', 110, currentY)

      // Save PDF
      pdf.save(`Transaction-Summary-${vehicle.chassis_no}-${Date.now()}.pdf`)
      setDocumentPrinted(true) // Mark as printed
    } catch (error: any) {
      console.error('Error generating transaction summary:', error)
      alert(`Error generating transaction summary: ${error.message}`)
    }
  }

  async function generateTransactionSummaryOld(
    soldPriceNum: number,
    totalAdvance: number,
    leaseAmountNum: number
  ) {
    const summaryWindow = window.open('', '_blank')
    if (!summaryWindow) return

    const balanceAfterAdvance = soldPriceNum - totalAdvance
    const balanceAfterLease = hasLeasing ? balanceAfterAdvance - leaseAmountNum : balanceAfterAdvance
    const otherCharges = calculateOtherCharges()
    const balanceSettlement = calculateBalanceSettlement()
    // Final balance = Unit Price - Advance - Finance - Balance Settlement (Other Charges are separate)
    const finalBalance = balanceAfterLease - balanceSettlement

    summaryWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transaction Summary - ${vehicle.chassis_no}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #92400E; padding-bottom: 20px; }
            .header h1 { margin: 0; color: #92400E; font-size: 32px; }
            .section { margin: 25px 0; }
            .section h3 { color: #92400E; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 15px; }
            .details table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .details td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
            .details td:first-child { font-weight: bold; width: 35%; color: #475569; }
            .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .table th, .table td { padding: 10px; text-align: left; border: 1px solid #e5e7eb; }
            .table th { background: #fef3c7; font-weight: bold; }
            .table td:last-child { text-align: right; }
            .total-section { margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 10px; border: 2px solid #92400E; }
            .total-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 16px; }
            .total-row.final { font-size: 24px; font-weight: bold; margin-top: 15px; padding-top: 15px; border-top: 2px solid #92400E; }
            .signature-section { margin-top: 40px; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; text-align: center; }
            .signature-line { border-top: 2px solid #000; margin-top: 60px; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>TRANSACTION SUMMARY</h1>
            <div style="margin-top: 10px; color: #64748b;">Date: ${new Date(soldDate).toLocaleDateString()}</div>
          </div>
          
          <div class="section">
            <h3>Customer Details</h3>
            <table class="details">
              <tr><td>Name:</td><td>${customerName}</td></tr>
              <tr><td>Phone:</td><td>${customerPhone || 'N/A'}</td></tr>
              <tr><td>Address:</td><td>${(() => {
                const parts = customerAddress ? customerAddress.split(',').map(p => p.trim()).filter(p => p) : []
                return parts.length > 0 ? parts.join(', ') : (customerAddress || 'N/A')
              })()}</td></tr>
            </table>
          </div>

          <div class="section">
            <h3>Vehicle Details</h3>
            <table class="details">
              <tr><td>Maker & Model:</td><td>${vehicle.maker} ${vehicle.model}</td></tr>
              <tr><td>Chassis Number:</td><td>${vehicle.chassis_no}</td></tr>
              <tr><td>Year:</td><td>${vehicle.manufacturer_year}</td></tr>
              <tr><td>Mileage:</td><td>${vehicle.mileage.toLocaleString()} km</td></tr>
            </table>
          </div>

          <div class="section">
            <h3>Unit Price</h3>
            <div class="total-section">
              <div class="total-row">
                <span>Unit Price:</span>
                <span>${formatCurrency(soldPriceNum)}</span>
              </div>
            </div>
          </div>

          ${totalAdvance > 0 ? `
            <div class="section">
              <h3>Advance Payments</h3>
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  ${advancePayments.map(p => `
                    <tr>
                      <td>${new Date(p.paid_date).toLocaleDateString()}</td>
                      <td>${formatCurrency(p.amount_lkr)}</td>
                    </tr>
                  `).join('')}
                  <tr style="background: #fef3c7; font-weight: bold;">
                    <td>Total Advance:</td>
                    <td>${formatCurrency(totalAdvance)}</td>
                  </tr>
                </tbody>
              </table>
              <div class="total-section" style="margin-top: 15px;">
                <div class="total-row">
                  <span>Balance After Advance:</span>
                  <span>${formatCurrency(balanceAfterAdvance)}</span>
                </div>
              </div>
            </div>
          ` : ''}

          ${hasLeasing && leaseAmountNum > 0 ? `
            <div class="section">
              <h3>Leasing Details</h3>
              <table class="details">
                <tr><td>Lease Company:</td><td>${leaseCompany}</td></tr>
                <tr><td>Lease Amount:</td><td>${formatCurrency(leaseAmountNum)}</td></tr>
              </table>
              <div class="total-section" style="margin-top: 15px;">
                <div class="total-row">
                  <span>Balance After Lease:</span>
                  <span>${formatCurrency(balanceAfterLease)}</span>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="section">
            <h3>Balance Settlement</h3>
            <table class="details">
              <tr><td>Payment Method:</td><td>${paymentMethod?.toUpperCase() || 'N/A'}</td></tr>
            </table>
            ${(paymentMethod === 'cash' || paymentMethod === 'both') ? `
              <table class="table" style="margin-top: 15px;">
                <thead>
                  <tr>
                    <th>Denomination</th>
                    <th>Quantity</th>
                    <th>Amount (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  ${parseFloat(cash5000) > 0 ? `<tr><td>5000</td><td>${cash5000}</td><td>${formatCurrency(parseFloat(cash5000) * 5000)}</td></tr>` : ''}
                  ${parseFloat(cash2000) > 0 ? `<tr><td>2000</td><td>${cash2000}</td><td>${formatCurrency(parseFloat(cash2000) * 2000)}</td></tr>` : ''}
                  ${parseFloat(cash1000) > 0 ? `<tr><td>1000</td><td>${cash1000}</td><td>${formatCurrency(parseFloat(cash1000) * 1000)}</td></tr>` : ''}
                  ${parseFloat(cash500) > 0 ? `<tr><td>500</td><td>${cash500}</td><td>${formatCurrency(parseFloat(cash500) * 500)}</td></tr>` : ''}
                  ${parseFloat(cash100) > 0 ? `<tr><td>100</td><td>${cash100}</td><td>${formatCurrency(parseFloat(cash100) * 100)}</td></tr>` : ''}
                  <tr style="background: #fef3c7; font-weight: bold;">
                    <td colspan="2">Total Cash:</td>
                    <td>${formatCurrency(calculateCashTotal())}</td>
                  </tr>
                </tbody>
              </table>
            ` : ''}
            ${(paymentMethod === 'cheque' || paymentMethod === 'both') ? `
              <table class="table" style="margin-top: 15px;">
                <thead>
                  <tr>
                    <th>Cheque No</th>
                    <th>Amount (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  ${cheque1No ? `<tr><td>${cheque1No}</td><td>${formatCurrency(parseFloat(cheque1Amount) || 0)}</td></tr>` : ''}
                  ${cheque2No ? `<tr><td>${cheque2No}</td><td>${formatCurrency(parseFloat(cheque2Amount) || 0)}</td></tr>` : ''}
                  <tr style="background: #fef3c7; font-weight: bold;">
                    <td>Total Cheque:</td>
                    <td>${formatCurrency(calculateChequeTotal())}</td>
                  </tr>
                </tbody>
              </table>
            ` : ''}
            <div class="total-section" style="margin-top: 15px;">
              <div class="total-row">
                <span>Total Settlement:</span>
                <span>${formatCurrency(balanceSettlement)}</span>
              </div>
            </div>
          </div>

          ${otherCharges > 0 ? `
            <div class="section">
              <h3>Other Charges (Separate)</h3>
              <p style="color: #64748b; font-size: 12px; margin-bottom: 10px; font-style: italic;">These charges are separate.</p>
              <table class="table">
                <tbody>
                  ${registration && parseFloat(registration) > 0 ? `<tr><td>Registration</td><td>${formatCurrency(parseFloat(registration))}</td></tr>` : ''}
                  ${valuation && parseFloat(valuation) > 0 ? `<tr><td>Valuation</td><td>${formatCurrency(parseFloat(valuation))}</td></tr>` : ''}
                  ${rLicence && parseFloat(rLicence) > 0 ? `<tr><td>R/Licence</td><td>${formatCurrency(parseFloat(rLicence))}</td></tr>` : ''}
                  <tr style="background: #fef3c7; font-weight: bold;">
                    <td>Total Other Charges:</td>
                    <td>${formatCurrency(otherCharges)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">
                <strong>Customer Signature</strong>
              </div>
            </div>
            <div class="signature-box">
              <div class="signature-line">
                <strong>Authorized Signature</strong>
              </div>
            </div>
          </div>

          <div style="margin-top: 40px; text-align: center; color: #64748b; font-size: 14px;">
            <p>This is a computer-generated transaction summary.</p>
          </div>
        </body>
      </html>
    `)
    summaryWindow.document.close()
  }

  const totalAdvance = calculateTotalAdvance()
  const balanceAfterAdvance = parseFloat(soldPrice) ? parseFloat(soldPrice) - totalAdvance : 0

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
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              style={{ position: 'relative', zIndex: 10 }}
            >
              <div className="p-6 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-stone-800">Mark Vehicle as Sold</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {!documentType ? (
                  <>
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-semibold text-stone-800 mb-4">Generate Transaction Summary</h3>
                      {documentGenerated && (
                        <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <p className="text-sm text-amber-700">
                            <strong>Transaction Summary</strong> has been generated. 
                            Click Done to close.
                          </p>
                        </div>
                      )}
                      <div className="flex justify-center">
                        <button
                          onClick={() => setDocumentType('transaction')}
                          className={`card p-6 hover:shadow-lg transition-all border-2 ${
                            documentGenerated && generatedDocumentType === 'transaction'
                              ? 'border-green-500 bg-green-50'
                              : 'border-amber-200 hover:border-amber-400'
                          }`}
                          disabled={documentGenerated && generatedDocumentType === 'transaction'}
                        >
                          <Receipt className="w-12 h-12 mx-auto mb-3 text-amber-700" />
                          <h4 className="font-bold text-stone-800 mb-2">Transaction Summary</h4>
                          <p className="text-sm text-stone-600">Detailed summary with leasing, payment breakdown, and charges</p>
                          {documentGenerated && generatedDocumentType === 'transaction' && (
                            <p className="text-xs text-green-600 mt-2 font-semibold">✓ Generated</p>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-stone-800">
                        Transaction Summary Details
                      </h3>
                      <button
                        onClick={() => setDocumentType(null)}
                        className="px-4 py-2 text-sm font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-2 border border-amber-200"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Selection
                      </button>
                    </div>

                    {existingAdvance ? (
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <h3 className="font-semibold text-amber-900 mb-2">Advance Payment Exists</h3>
                        <p className="text-sm text-amber-700">Using stored customer details and selling price.</p>
                        <p className="mt-2"><strong>Unit Price:</strong> {formatCurrency(parseFloat(soldPrice))}</p>
                        <p className="mt-1"><strong>Customer:</strong> {customerName}</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ position: 'relative', zIndex: 10 }}>
                          <label className="label">Customer Name *</label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="input-field"
                            required
                            style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
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
                            <label className="label">Date *</label>
                            <input
                              type="date"
                              value={soldDate}
                              onChange={(e) => setSoldDate(e.target.value)}
                              className="input-field"
                              required
                              style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                            />
                          </div>
                        </div>
                        <div style={{ position: 'relative', zIndex: 10 }}>
                          <label className="label">Customer Address (comma-separated)</label>
                          <input
                            type="text"
                            value={customerAddress}
                            onChange={(e) => setCustomerAddress(e.target.value)}
                            className="input-field"
                            placeholder="e.g., Street, City, Province"
                            style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                          />
                          <p className="text-xs text-stone-500 mt-1">Enter address parts separated by commas</p>
                        </div>
                        <div style={{ position: 'relative', zIndex: 10 }}>
                          <label className="label">Customer ID</label>
                          <input
                            type="text"
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                            className="input-field"
                            placeholder="Enter customer ID"
                            style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                          />
                          {existingAdvance && customerId && (
                            <p className="text-xs text-stone-500 mt-1">Loaded from advance payment record</p>
                          )}
                        </div>
                      </>
                    )}

                    <div style={{ position: 'relative', zIndex: 10 }}>
                      <label className="label">Unit Price (LKR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={soldPrice}
                        onChange={(e) => setSoldPrice(e.target.value)}
                        className="input-field"
                        required
                        disabled={!!existingAdvance && !!soldPrice}
                        style={{ pointerEvents: existingAdvance && soldPrice ? 'none' : 'auto', zIndex: 10, position: 'relative', cursor: existingAdvance && soldPrice ? 'not-allowed' : 'text' }}
                      />
                      {existingAdvance && soldPrice && (
                        <p className="text-sm text-stone-600 mt-1">Price from advance record (non-editable)</p>
                      )}
                      {existingAdvance && !soldPrice && (
                        <p className="text-sm text-stone-600 mt-1">Enter unit price</p>
                      )}
                    </div>

                    {documentType === 'transaction' && (
                      <>
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <h3 className="font-semibold text-amber-900 mb-3">Unit Price & Advances</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Unit Price:</span>
                              <span className="font-semibold">{formatCurrency(parseFloat(soldPrice) || 0)}</span>
                            </div>
                            {totalAdvance > 0 && (
                              <>
                                <div className="mt-3">
                                  <p className="font-semibold mb-2">Advance Payments:</p>
                                  <div className="space-y-1 text-xs">
                                    {advancePayments.map(p => (
                                      <div key={p.id} className="flex justify-between">
                                        <span>{new Date(p.paid_date).toLocaleDateString()}</span>
                                        <span>{formatCurrency(p.amount_lkr)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-amber-300">
                                  <span>Total Advance:</span>
                                  <span className="font-semibold text-green-700">{formatCurrency(totalAdvance)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-amber-300">
                                  <span>Balance After Advance:</span>
                                  <span className="font-semibold">{formatCurrency(balanceAfterAdvance)}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-stone-200 pt-4">
                          <div className="flex items-center gap-3 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hasLeasing}
                                onChange={(e) => {
                                  setHasLeasing(e.target.checked)
                                  if (!e.target.checked) {
                                    setLeaseCompany('')
                                    setLeaseAmount('')
                                  }
                                }}
                                className="w-5 h-5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                              />
                              <span className="font-semibold text-stone-800">Has Leasing</span>
                            </label>
                          </div>
                          {hasLeasing && (
                            <>
                              <h3 className="font-semibold text-stone-800 mb-4">Leasing Details</h3>
                              <div className="grid grid-cols-2 gap-4">
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label">Lease Company *</label>
                                  <input
                                    type="text"
                                    value={leaseCompany}
                                    onChange={(e) => setLeaseCompany(e.target.value)}
                                    className="input-field"
                                    required
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label">Lease Amount (LKR) *</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={leaseAmount}
                                    onChange={(e) => setLeaseAmount(e.target.value)}
                                    className="input-field"
                                    required
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                              </div>
                              {leaseAmount && (
                                <div className="mt-2 p-3 bg-stone-50 rounded text-sm">
                                  <div className="flex justify-between">
                                    <span>Balance After Lease:</span>
                                    <span className="font-semibold">
                                      {formatCurrency(balanceAfterAdvance - (parseFloat(leaseAmount) || 0))}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="border-t border-stone-200 pt-4">
                          <h3 className="font-semibold text-stone-800 mb-4">Balance Settlement</h3>
                          <div className="mb-4">
                            <label className="label">Payment Method *</label>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('cash')}
                                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                                  paymentMethod === 'cash'
                                    ? 'bg-amber-100 border-amber-500 text-amber-900'
                                    : 'bg-white border-stone-300 text-stone-700 hover:border-amber-300'
                                }`}
                              >
                                Cash
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('cheque')}
                                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                                  paymentMethod === 'cheque'
                                    ? 'bg-amber-100 border-amber-500 text-amber-900'
                                    : 'bg-white border-stone-300 text-stone-700 hover:border-amber-300'
                                }`}
                              >
                                Cheque
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('both')}
                                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                                  paymentMethod === 'both'
                                    ? 'bg-amber-100 border-amber-500 text-amber-900'
                                    : 'bg-white border-stone-300 text-stone-700 hover:border-amber-300'
                                }`}
                              >
                                Both
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('bank_transfer')}
                                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                                  paymentMethod === 'bank_transfer'
                                    ? 'bg-amber-100 border-amber-500 text-amber-900'
                                    : 'bg-white border-stone-300 text-stone-700 hover:border-amber-300'
                                }`}
                              >
                                Bank Transfer
                              </button>
                            </div>
                          </div>

                          {(paymentMethod === 'cheque' || paymentMethod === 'both') && (
                            <div className="mb-4 p-4 bg-stone-50 rounded-lg">
                              <h4 className="font-semibold mb-3">Cheque Details</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">Cheque 1 No</label>
                                  <input
                                    type="text"
                                    value={cheque1No}
                                    onChange={(e) => setCheque1No(e.target.value)}
                                    className="input-field"
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">Cheque 1 Amount</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={cheque1Amount}
                                    onChange={(e) => setCheque1Amount(e.target.value)}
                                    className="input-field"
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">Cheque 2 No (Optional)</label>
                                  <input
                                    type="text"
                                    value={cheque2No}
                                    onChange={(e) => setCheque2No(e.target.value)}
                                    className="input-field"
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">Cheque 2 Amount</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={cheque2Amount}
                                    onChange={(e) => setCheque2Amount(e.target.value)}
                                    className="input-field"
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                              </div>
                              <div className="mt-2 text-sm text-stone-600">
                                Total Cheque: <span className="font-semibold">{formatCurrency(calculateChequeTotal())}</span>
                              </div>
                            </div>
                          )}

                          {(paymentMethod === 'cash' || paymentMethod === 'both') && (
                            <div className="mb-4 p-4 bg-stone-50 rounded-lg">
                              <h4 className="font-semibold mb-3">Cash Denominations</h4>
                              <div className="grid grid-cols-5 gap-3">
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">5000 x</label>
                                  <input
                                    type="number"
                                    value={cash5000}
                                    onChange={(e) => setCash5000(e.target.value)}
                                    className="input-field"
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">2000 x</label>
                                  <input
                                    type="number"
                                    value={cash2000}
                                    onChange={(e) => setCash2000(e.target.value)}
                                    className="input-field"
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">1000 x</label>
                                  <input
                                    type="number"
                                    value={cash1000}
                                    onChange={(e) => setCash1000(e.target.value)}
                                    className="input-field"
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">500 x</label>
                                  <input
                                    type="number"
                                    value={cash500}
                                    onChange={(e) => setCash500(e.target.value)}
                                    className="input-field"
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">100 x</label>
                                  <input
                                    type="number"
                                    value={cash100}
                                    onChange={(e) => setCash100(e.target.value)}
                                    className="input-field"
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                              </div>
                              <div className="mt-2 text-sm text-stone-600">
                                Total Cash: <span className="font-semibold">{formatCurrency(calculateCashTotal())}</span>
                              </div>
                            </div>
                          )}

                          {paymentMethod === 'bank_transfer' && (
                            <div className="mb-4 p-4 bg-stone-50 rounded-lg">
                              <h4 className="font-semibold mb-3">Bank Transfer Details</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">Deposit Date *</label>
                                  <input
                                    type="date"
                                    value={bankTransferDepositDate}
                                    onChange={(e) => setBankTransferDepositDate(e.target.value)}
                                    className="input-field"
                                    required
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">Bank Name *</label>
                                  <input
                                    type="text"
                                    value={bankTransferBankName}
                                    onChange={(e) => setBankTransferBankName(e.target.value)}
                                    className="input-field"
                                    required
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">Account Number *</label>
                                  <input
                                    type="text"
                                    value={bankTransferAccNo}
                                    onChange={(e) => setBankTransferAccNo(e.target.value)}
                                    className="input-field"
                                    required
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                                <div style={{ position: 'relative', zIndex: 10 }}>
                                  <label className="label text-sm">Amount *</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={bankTransferAmount}
                                    onChange={(e) => setBankTransferAmount(e.target.value)}
                                    className="input-field"
                                    required
                                    style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                                  />
                                </div>
                              </div>
                              <div className="mt-2 text-sm text-stone-600">
                                Total Bank Transfer: <span className="font-semibold">{formatCurrency(parseFloat(bankTransferAmount) || 0)}</span>
                              </div>
                            </div>
                          )}

                          {paymentMethod && (
                            <div className="p-3 bg-amber-50 rounded text-sm">
                              <div className="flex justify-between font-semibold">
                                <span>Total Settlement:</span>
                                <span>{formatCurrency(calculateBalanceSettlement())}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-stone-200 pt-4">
                          <h3 className="font-semibold text-stone-800 mb-4">Other Charges</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div style={{ position: 'relative', zIndex: 10 }}>
                              <label className="label">Registration</label>
                              <input
                                type="number"
                                step="0.01"
                                value={registration}
                                onChange={(e) => setRegistration(e.target.value)}
                                className="input-field"
                                style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                              />
                            </div>
                            <div style={{ position: 'relative', zIndex: 10 }}>
                              <label className="label">Valuation</label>
                              <input
                                type="number"
                                step="0.01"
                                value={valuation}
                                onChange={(e) => setValuation(e.target.value)}
                                className="input-field"
                                style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                              />
                            </div>
                            <div style={{ position: 'relative', zIndex: 10 }}>
                              <label className="label">R/Licence</label>
                              <input
                                type="number"
                                step="0.01"
                                value={rLicence}
                                onChange={(e) => setRLicence(e.target.value)}
                                className="input-field"
                                style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative', cursor: 'text' }}
                              />
                            </div>
                          </div>
                          {calculateOtherCharges() > 0 && (
                            <div className="mt-2 p-3 bg-stone-50 rounded text-sm">
                              <div className="flex justify-between font-semibold">
                                <span>Total Other Charges:</span>
                                <span>{formatCurrency(calculateOtherCharges())}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <div className="p-4 bg-stone-50 rounded-lg">
                      <h3 className="font-semibold mb-2">Cost Summary</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Total Cost:</span>
                          <span>{formatCurrency(vehicle.final_total_lkr || vehicle.japan_total_lkr || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Unit Price:</span>
                          <span>{formatCurrency(parseFloat(soldPrice) || 0)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-stone-300 font-semibold">
                          <span>Profit (LKR):</span>
                          <span className="text-green-700">
                            {formatCurrency((parseFloat(soldPrice) || 0) - (vehicle.final_total_lkr || vehicle.japan_total_lkr || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="p-6 border-t border-stone-200 flex items-center justify-end gap-4">
                {!documentType && documentGenerated ? (
                  <>
                    <button
                      onClick={async () => {
                        // If vehicle was marked as sold, revert it
                        if (vehicleStatusChanged) {
                          await supabase
                            .from('vehicles')
                            .update({ status: 'available' })
                            .eq('chassis_no', vehicle.chassis_no)
                        }
                        // If sale record was created, delete it
                        if (saleRecordId) {
                          await supabase
                            .from('sales')
                            .delete()
                            .eq('chassis_no', saleRecordId)
                        }
                        // Delete transaction details if created
                        if (saleRecordId) {
                          await supabase
                            .from('transaction_details')
                            .delete()
                            .eq('chassis_no', saleRecordId)
                        }
                        // Delete lease collection if created
                        if (generatedDocumentType === 'transaction' && saleRecordId) {
                          await supabase
                            .from('lease_collections')
                            .delete()
                            .eq('chassis_no', saleRecordId)
                        }
                        onClose()
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        // Done clicked - keep all changes, close modal
                        onSave()
                        onClose()
                      }}
                      className="btn-primary"
                    >
                      Done
                    </button>
                  </>
                ) : !documentGenerated ? (
                  <>
                    <button
                      onClick={async () => {
                        // If vehicle was marked as sold, revert it
                        if (vehicleStatusChanged) {
                          await supabase
                            .from('vehicles')
                            .update({ status: 'available' })
                            .eq('chassis_no', vehicle.chassis_no)
                        }
                        // If sale record was created, delete it
                        if (saleRecordId) {
                          await supabase
                            .from('sales')
                            .delete()
                            .eq('chassis_no', saleRecordId)
                        }
                        // Delete transaction details if created
                        if (saleRecordId) {
                          await supabase
                            .from('transaction_details')
                            .delete()
                            .eq('chassis_no', saleRecordId)
                        }
                        // Delete lease collection if created
                        if (documentType === 'transaction' && saleRecordId) {
                          await supabase
                            .from('lease_collections')
                            .delete()
                            .eq('chassis_no', saleRecordId)
                        }
                        onClose()
                      }}
                      className="btn-secondary"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    {documentType && (
                      <button
                        onClick={handleSave}
                        className="btn-primary"
                        disabled={loading || !soldPrice || !customerName}
                      >
                        {loading ? 'Processing...' : 'Mark as Sold & Print Transaction Summary'}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {documentPrinted ? (
                      // After printing, show Cancel and Done (no Back button)
                      <>
                        <button
                          onClick={async () => {
                            // Cancel clicked - revert all changes
                            // If vehicle was marked as sold, revert it
                            if (vehicleStatusChanged) {
                              await supabase
                                .from('vehicles')
                                .update({ status: 'available' })
                                .eq('chassis_no', vehicle.chassis_no)
                            }
                            // If sale record was created, delete it
                            if (saleRecordId) {
                              await supabase
                                .from('sales')
                                .delete()
                                .eq('chassis_no', vehicle.chassis_no)
                            }
                            // Delete transaction details if created
                            if (saleRecordId) {
                              await supabase
                                .from('transaction_details')
                                .delete()
                                .eq('chassis_no', vehicle.chassis_no)
                            }
                            // Delete lease collection if created
                            if (documentType === 'transaction' && saleRecordId) {
                              await supabase
                                .from('lease_collections')
                                .delete()
                                .eq('chassis_no', vehicle.chassis_no)
                            }
                            onClose()
                          }}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            // Done clicked - keep all changes, close modal
                            onSave()
                            onClose()
                          }}
                          className="btn-primary"
                        >
                          Done
                        </button>
                      </>
                    ) : (
                      // Before printing, show Cancel, Back, and Done
                      <>
                        <button
                          onClick={async () => {
                            // If vehicle was marked as sold, revert it
                            if (vehicleStatusChanged) {
                              await supabase
                                .from('vehicles')
                                .update({ status: 'available' })
                                .eq('chassis_no', vehicle.chassis_no)
                            }
                            // If sale record was created, delete it
                            if (saleRecordId) {
                              await supabase
                                .from('sales')
                                .delete()
                                .eq('chassis_no', vehicle.chassis_no)
                            }
                            // Delete transaction details if created
                            if (saleRecordId) {
                              await supabase
                                .from('transaction_details')
                                .delete()
                                .eq('chassis_no', vehicle.chassis_no)
                            }
                            // Delete lease collection if created
                            if (documentType === 'transaction' && saleRecordId) {
                              await supabase
                                .from('lease_collections')
                                .delete()
                                .eq('chassis_no', vehicle.chassis_no)
                            }
                            onClose()
                          }}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            // Back button - go back to document type selection
                            setDocumentGenerated(false)
                            setGeneratedDocumentType(null)
                            setDocumentType(null)
                            setDocumentPrinted(false)
                          }}
                          className="btn-secondary flex items-center gap-2"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Back
                        </button>
                        <button
                          onClick={() => {
                            // Done clicked - keep all changes, close modal
                            onSave()
                            onClose()
                          }}
                          className="btn-primary"
                        >
                          Done
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
