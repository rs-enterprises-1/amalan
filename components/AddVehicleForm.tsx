'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { fetchJPYToLKRRate, formatCurrency, formatNumber } from '@/lib/utils'
import { vehicleMakes, getModelsForMake } from '@/lib/vehicle-data'
import { getCompanySettings } from '@/lib/settings'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Check, X } from 'lucide-react'

interface AddVehicleFormProps {
  user: User
}

type Step = 1 | 2 | 3 | 4

export default function AddVehicleForm({ user }: AddVehicleFormProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [invoiceRate, setInvoiceRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [rateLoading, setRateLoading] = useState(false)

  // Purchase source: 'japan' or 'sri-lanka'
  const [purchaseSource, setPurchaseSource] = useState<'japan' | 'sri-lanka' | null>(null)
  const [buyingPriceLkr, setBuyingPriceLkr] = useState('') // For Sri Lanka purchases
  const [enableSriLankaPurchase, setEnableSriLankaPurchase] = useState(false)
  const [registrationNo, setRegistrationNo] = useState('') // For Sri Lanka purchases

  // Step 1: Vehicle Details
  const [chassisNo, setChassisNo] = useState('')
  const [maker, setMaker] = useState('')
  const [model, setModel] = useState('')
  const [isCustomModel, setIsCustomModel] = useState(false)
  const [manufacturerYear, setManufacturerYear] = useState('')
  const [mileage, setMileage] = useState('')
  const [engineNo, setEngineNo] = useState('')
  const [engineCapacity, setEngineCapacity] = useState('')
  const [colour, setColour] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [seatingCapacity, setSeatingCapacity] = useState('')

  // Step 2: Japan Costs (JPY)
  const [bidJpy, setBidJpy] = useState('')
  const [commissionJpy, setCommissionJpy] = useState('')
  const [insuranceJpy, setInsuranceJpy] = useState('')
  const [inlandTransportJpy, setInlandTransportJpy] = useState('')
  const [otherCost1Jpy, setOtherCost1Jpy] = useState('')
  const [otherCost1Label, setOtherCost1Label] = useState('')

  // Step 3: CIF Split
  const [invoiceAmountJpy, setInvoiceAmountJpy] = useState('')
  const [undialAmountJpy, setUndialAmountJpy] = useState('')

  // Step 4: JPY to LKR Conversion
  const [undialRate, setUndialRate] = useState('')

  // Sell Now (Admin only) - Step 4
  const [showSellNow, setShowSellNow] = useState(false)
  const [buyerName, setBuyerName] = useState('')
  const [buyerAddress, setBuyerAddress] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [expectedProfitJpy, setExpectedProfitJpy] = useState('')
  
  // Sell Now from Step 2 (Japan Costs)
  const [showSellNowStep2, setShowSellNowStep2] = useState(false)
  const [sellNowStep2Rate, setSellNowStep2Rate] = useState<number | null>(null)
  const [loadingRate, setLoadingRate] = useState(false)

  useEffect(() => {
    if (currentStep === 4) {
      loadInvoiceRate()
    }
  }, [currentStep])

  // Load Sri Lanka purchase setting on mount
  useEffect(() => {
    async function loadSetting() {
      try {
        const settings = await getCompanySettings()
        setEnableSriLankaPurchase(settings.enable_sri_lanka_purchase ?? false)
        
        // If Sri Lanka purchase is disabled, automatically set to Japan
        if (!settings.enable_sri_lanka_purchase) {
          setPurchaseSource('japan')
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        // Default to Japan if error
        setPurchaseSource('japan')
      }
    }
    loadSetting()
  }, [])

  async function loadInvoiceRate() {
    setRateLoading(true)
    try {
      const rate = await fetchJPYToLKRRate()
      setInvoiceRate(rate)
    } catch (error) {
      console.error('Failed to load exchange rate:', error)
      // Fallback rate (approximate current rate)
      setInvoiceRate(1.9775)
    } finally {
      setRateLoading(false)
    }
  }

  function calculateCIFTotal(): number {
    const bid = parseFloat(bidJpy) || 0
    const commission = parseFloat(commissionJpy) || 0
    const insurance = parseFloat(insuranceJpy) || 0
    const inland = parseFloat(inlandTransportJpy) || 0
    const other = parseFloat(otherCost1Jpy) || 0
    return bid + commission + insurance + inland + other
  }

  function calculateJapanTotalLKR(): number {
    if (purchaseSource === 'sri-lanka') {
      // For Sri Lanka, use buying price directly
      return parseFloat(buyingPriceLkr) || 0
    }
    const invoiceJpy = parseFloat(invoiceAmountJpy) || 0
    const undialJpy = parseFloat(undialAmountJpy) || 0
    const invoiceLkr = invoiceJpy * (invoiceRate || 0)
    const undialLkr = undialJpy * (parseFloat(undialRate) || 0)
    return invoiceLkr + undialLkr
  }

  function canProceedToStep2(): boolean {
    if (!purchaseSource) return false
    if (purchaseSource === 'sri-lanka') {
      // For Sri Lanka, just need vehicle details, buying price, and registration number
      return !!(
        chassisNo &&
        registrationNo &&
        maker &&
        model &&
        manufacturerYear &&
        mileage &&
        buyingPriceLkr &&
        parseFloat(buyingPriceLkr) > 0
      )
    }
    // For Japan, just need vehicle details
    return !!(
      chassisNo &&
      maker &&
      model &&
      manufacturerYear &&
      mileage
    )
  }

  function canProceedToStep3(): boolean {
    if (purchaseSource === 'sri-lanka') return false // Skip step 3 for Sri Lanka
    const cifTotal = calculateCIFTotal()
    return cifTotal > 0
  }

  function canProceedToStep4(): boolean {
    if (purchaseSource === 'sri-lanka') return false // Skip step 4 for Sri Lanka
    const invoiceJpy = parseFloat(invoiceAmountJpy) || 0
    const undialJpy = parseFloat(undialAmountJpy) || 0
    // Allow cases where full CIF is taken as invoice and undial is 0
    return invoiceJpy > 0 && undialJpy >= 0
  }

  function canSave(): boolean {
    if (purchaseSource === 'sri-lanka') {
      // For Sri Lanka, just need buying price
      return !!(buyingPriceLkr && parseFloat(buyingPriceLkr) > 0)
    }
    const undialJpy = parseFloat(undialAmountJpy) || 0
    const requiresUndialRate = undialJpy > 0
    
    return !!(
      invoiceRate &&
      (!requiresUndialRate || (undialRate && parseFloat(undialRate) > 0))
    )
  }

  async function handleSave() {
    if (!canSave()) return

    setLoading(true)
    try {
      // Validate required fields
      if (!chassisNo || !maker || !model || !manufacturerYear || !mileage) {
        throw new Error('Please fill in all required vehicle details')
      }

      const yearNum = parseInt(manufacturerYear)
      const mileageNum = parseInt(mileage)
      
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
        throw new Error('Please enter a valid manufacturer year')
      }
      
      if (isNaN(mileageNum) || mileageNum < 0) {
        throw new Error('Please enter a valid mileage')
      }

      let vehicleData: any
      
      if (purchaseSource === 'sri-lanka') {
        // For Sri Lanka purchases
        const buyingPrice = parseFloat(buyingPriceLkr) || 0
        if (buyingPrice <= 0) {
          throw new Error('Please enter a valid buying price')
        }

        vehicleData = {
          chassis_no: chassisNo.trim(),
          maker: maker.trim(),
          model: model.trim(),
          manufacturer_year: yearNum,
          mileage: mileageNum,
          status: 'available' as const,
          
          // No Japan costs for Sri Lanka purchases
          bid_jpy: null,
          commission_jpy: null,
          insurance_jpy: null,
          inland_transport_jpy: null,
          other_jpy: null,
          other_label: null,
          
          // Use buying price as invoice value (already in LKR, so rate = 1)
          invoice_amount_jpy: buyingPrice, // Store as invoice_amount_jpy for consistency
          invoice_jpy_to_lkr_rate: 1, // Rate is 1 since it's already in LKR
          undial_amount_jpy: null,
          undial_jpy_to_lkr_rate: null,
          
          tax_lkr: null,
          clearance_lkr: null,
          transport_lkr: null,
          local_extra1_label: null,
          local_extra1_lkr: null,
          local_extra2_label: null,
          local_extra2_lkr: null,
          local_extra3_label: null,
          local_extra3_lkr: null,
          
          japan_total_lkr: buyingPrice, // Use buying price as Japan total (for tax calculations)
          final_total_lkr: buyingPrice,
          buy_price: buyingPrice,
          buy_currency: 'LKR',
          registration_no: registrationNo.trim() || null,
        }
      } else {
        // For Japan purchases (existing logic)
        const cifTotal = calculateCIFTotal()
        const japanTotalLkr = calculateJapanTotalLKR()

        vehicleData = {
          chassis_no: chassisNo.trim(),
          maker: maker.trim(),
          model: model.trim(),
          manufacturer_year: yearNum,
          mileage: mileageNum,
          status: 'available' as const,
          
          bid_jpy: bidJpy ? parseFloat(bidJpy) : null,
          commission_jpy: commissionJpy ? parseFloat(commissionJpy) : null,
          insurance_jpy: insuranceJpy ? parseFloat(insuranceJpy) : null,
          inland_transport_jpy: inlandTransportJpy ? parseFloat(inlandTransportJpy) : null,
          other_jpy: otherCost1Jpy ? parseFloat(otherCost1Jpy) : null,
          other_label: otherCost1Label?.trim() || null,
          
          invoice_amount_jpy: invoiceAmountJpy ? parseFloat(invoiceAmountJpy) : null,
          invoice_jpy_to_lkr_rate: invoiceRate,
          undial_amount_jpy: undialAmountJpy ? parseFloat(undialAmountJpy) : null,
          undial_jpy_to_lkr_rate: (parseFloat(undialAmountJpy) || 0) > 0 && undialRate ? parseFloat(undialRate) : null,
          
          tax_lkr: null,
          clearance_lkr: null,
          transport_lkr: null,
          local_extra1_label: null,
          local_extra1_lkr: null,
          local_extra2_label: null,
          local_extra2_lkr: null,
          local_extra3_label: null,
          local_extra3_lkr: null,
          
          japan_total_lkr: japanTotalLkr || 0,
          final_total_lkr: japanTotalLkr || 0,
          buy_price: japanTotalLkr || 0,
          buy_currency: 'LKR',
        }
      }

      console.log('Saving vehicle data:', vehicleData)

      // Check if vehicle already exists (available or sold)
      const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('chassis_no, status')
        .eq('chassis_no', chassisNo.trim())
        .maybeSingle()

      let result
      if (existingVehicle) {
        alert(`Chassis already exists (${(existingVehicle as any).status || 'unknown'}).`)
        setLoading(false)
        return
      } else {
        // Get current user for tracking
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        const userRole = (currentUser?.user_metadata?.role as 'admin' | 'staff') || 'staff'
        
        // Insert new vehicle
        const { error, data } = await supabase
          .from('vehicles')
          .insert({
            ...vehicleData,
            created_by: currentUser?.id || null,
            created_by_role: userRole,
          })
          .select()
        result = { error, data }
      }

      if (result.error) {
        console.error('Supabase error:', result.error)
        throw new Error(`Failed to save vehicle: ${result.error.message}`)
      }

      const japanTotalLkr = purchaseSource === 'sri-lanka' 
        ? (parseFloat(buyingPriceLkr) || 0)
        : calculateJapanTotalLKR()

      if (isAdmin(user) && showSellNow) {
        await handleSellNow(japanTotalLkr)
      } else {
        router.push('/available')
      }
    } catch (error: any) {
      console.error('Error saving vehicle:', error)
      const errorMessage = error?.message || 'An unknown error occurred. Please check the console for details.'
      alert(`Error: ${errorMessage}`)
      setLoading(false)
    }
  }

  async function handleSaveNotAvailable() {
    setLoading(true)
    try {
      // Validate required fields (step 1 only)
      if (!chassisNo || !maker || !model || !manufacturerYear || !mileage) {
        throw new Error('Please fill in all required vehicle details')
      }

      const yearNum = parseInt(manufacturerYear)
      const mileageNum = parseInt(mileage)
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
        throw new Error('Please enter a valid manufacturer year')
      }
      if (isNaN(mileageNum) || mileageNum < 0) {
        throw new Error('Please enter a valid mileage')
      }

      // Check duplicates
      const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('chassis_no, status')
        .eq('chassis_no', chassisNo.trim())
        .maybeSingle()

      if (existingVehicle) {
        alert(`Chassis already exists (${(existingVehicle as any).status || 'unknown'}).`)
        return
      }

      const vehicleData: any = {
        chassis_no: chassisNo.trim(),
        maker: maker.trim(),
        model: model.trim(),
        manufacturer_year: yearNum,
        mileage: mileageNum,
        status: 'not_available',

        engine_no: engineNo?.trim() || null,
        engine_capacity: engineCapacity?.trim() || null,
        // DB column is "colour" (not "color")
        colour: colour?.trim() || null,
        fuel_type: fuelType?.trim() || null,
        seating_capacity: seatingCapacity?.trim() || null,

        // Save any costs already entered (steps 2 & 3), rates can be filled later
        bid_jpy: bidJpy ? parseFloat(bidJpy) : null,
        commission_jpy: commissionJpy ? parseFloat(commissionJpy) : null,
        insurance_jpy: insuranceJpy ? parseFloat(insuranceJpy) : null,
        inland_transport_jpy: inlandTransportJpy ? parseFloat(inlandTransportJpy) : null,
        other_jpy: otherCost1Jpy ? parseFloat(otherCost1Jpy) : null,
        other_label: otherCost1Label?.trim() || null,
        invoice_amount_jpy: invoiceAmountJpy ? parseFloat(invoiceAmountJpy) : null,
        invoice_jpy_to_lkr_rate: null,
        undial_amount_jpy: undialAmountJpy ? parseFloat(undialAmountJpy) : null,
        undial_jpy_to_lkr_rate: null,

        tax_lkr: null,
        clearance_lkr: null,
        transport_lkr: null,
        local_extra1_label: null,
        local_extra1_lkr: null,
        local_extra2_label: null,
        local_extra2_lkr: null,
        local_extra3_label: null,
        local_extra3_lkr: null,

        // Some DB schemas enforce NOT NULL on totals/buy_price. For "not_available" we default to 0.
        japan_total_lkr: 0,
        final_total_lkr: 0,
        buy_price: 0,
        buy_currency: 'LKR',
      }

      const { error } = await supabase
        .from('vehicles')
        .insert(vehicleData)

      if (error) throw error

      alert('Saved to Not Available. You can complete costs later and move it to Available.')
      router.push('/not-available')
    } catch (error: any) {
      console.error('Error saving not available vehicle:', error)
      alert(`Error: ${error?.message || error}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleSellNow(japanTotalLkr: number) {
    if (!buyerName || !expectedProfitJpy) return

    const expectedProfitLkr = parseFloat(expectedProfitJpy) * (invoiceRate || 0)
    const soldPriceJpy = parseFloat(invoiceAmountJpy) + parseFloat(expectedProfitJpy)
    const soldPriceLkr = soldPriceJpy * (invoiceRate || 0)
    const profitLkr = soldPriceLkr - japanTotalLkr

    const { error: saleError } = await supabase
      .from('sales')
        .insert({
          chassis_no: chassisNo,
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

    await supabase
      .from('vehicles')
      .update({ status: 'sold' })
      .eq('chassis_no', chassisNo)

    const printInvoice = confirm('Print Invoice?')
    if (printInvoice) {
      await generateInvoiceFromStep4(soldPriceJpy, soldPriceLkr)
    }

    router.push('/sold')
  }

  async function handleSellNowFromStep2() {
    if (!buyerName || !expectedProfitJpy) {
      alert('Please fill in customer name and expected profit')
      return
    }

    if (!sellNowStep2Rate) {
      alert('Exchange rate not loaded. Please wait...')
      return
    }

    setLoading(true)
    try {
      // Validate required fields
      if (!chassisNo || !maker || !model || !manufacturerYear || !mileage) {
        throw new Error('Please fill in all required vehicle details')
      }

      const yearNum = parseInt(manufacturerYear)
      const mileageNum = parseInt(mileage)
      
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
        throw new Error('Please enter a valid manufacturer year')
      }
      
      if (isNaN(mileageNum) || mileageNum < 0) {
        throw new Error('Please enter a valid mileage')
      }

      const cifTotal = calculateCIFTotal()
      if (cifTotal <= 0) {
        throw new Error('Please enter Japan costs')
      }

      // Calculate totals
      const japanTotalLkr = cifTotal * sellNowStep2Rate
      const expectedProfitLkr = parseFloat(expectedProfitJpy) * sellNowStep2Rate
      const soldPriceJpy = cifTotal + parseFloat(expectedProfitJpy)
      const soldPriceLkr = soldPriceJpy * sellNowStep2Rate
      const profitLkr = soldPriceLkr - japanTotalLkr

      // Save vehicle first
      const vehicleData = {
        chassis_no: chassisNo.trim(),
        maker: maker.trim(),
        model: model.trim(),
        manufacturer_year: yearNum,
        mileage: mileageNum,
        status: 'sold' as const, // Mark as sold immediately
        
        bid_jpy: bidJpy ? parseFloat(bidJpy) : null,
        commission_jpy: commissionJpy ? parseFloat(commissionJpy) : null,
        insurance_jpy: insuranceJpy ? parseFloat(insuranceJpy) : null,
        inland_transport_jpy: inlandTransportJpy ? parseFloat(inlandTransportJpy) : null,
        other_jpy: otherCost1Jpy ? parseFloat(otherCost1Jpy) : null,
        other_label: otherCost1Label?.trim() || null,
        
        invoice_amount_jpy: cifTotal, // Use CIF total as invoice amount
        invoice_jpy_to_lkr_rate: sellNowStep2Rate,
        undial_amount_jpy: 0, // No undial when selling from Step 2
        undial_jpy_to_lkr_rate: sellNowStep2Rate,
        
        tax_lkr: null,
        clearance_lkr: null,
        transport_lkr: null,
        local_extra1_label: null,
        local_extra1_lkr: null,
        local_extra2_label: null,
        local_extra2_lkr: null,
        local_extra3_label: null,
        local_extra3_lkr: null,
        
        japan_total_lkr: japanTotalLkr,
        final_total_lkr: japanTotalLkr,
        buy_price: japanTotalLkr,
        buy_currency: 'LKR',
      }

      // Check if vehicle already exists
      const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('chassis_no')
        .eq('chassis_no', chassisNo)
        .maybeSingle()

      let vehicleError
      if (existingVehicle) {
        // Update existing vehicle
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('chassis_no', chassisNo)
        vehicleError = error
      } else {
        // Insert new vehicle
        const { error } = await supabase
          .from('vehicles')
          .insert(vehicleData)
        vehicleError = error
      }

      if (vehicleError) throw vehicleError

      // Create sale record
      const { error: saleError } = await supabase
        .from('sales')
        .insert({
          chassis_no: chassisNo,
          sold_price: soldPriceJpy,
          sold_currency: 'JPY',
          rate_jpy_to_lkr: sellNowStep2Rate,
          profit: profitLkr, // Database uses 'profit' not 'profit_lkr'
          sold_date: new Date().toISOString().split('T')[0],
          customer_name: buyerName, // Database uses customer_name
          customer_address: buyerAddress || null,
          customer_phone: buyerPhone || null,
        })

      if (saleError) throw saleError

      // Ask to print invoice
      const printInvoice = confirm('Print Invoice?')
      if (printInvoice) {
        await generateInvoiceFromStep2(soldPriceJpy, cifTotal, parseFloat(expectedProfitJpy))
      }

      router.push('/sold')
    } catch (error: any) {
      console.error('Error selling vehicle:', error)
      alert(`Error: ${error.message}`)
      setLoading(false)
    }
  }

  async function generateInvoiceFromStep2(soldPriceJpy: number, cifTotal: number, expectedProfitJpy: number) {
    try {
      const invoiceNumber = `INV-${chassisNo}-${Date.now()}`
      const invoiceDate = new Date().toLocaleDateString()
      const addressParts = buyerAddress ? buyerAddress.split(',').map(p => p.trim()).filter(p => p) : []
      const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : (buyerAddress || 'N/A')

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

      // Calculate positions - adjust these based on your template layout
      const startX = 100
      let currentY = 150

      // Invoice Number
      ctx.font = 'bold 18px Arial'
      ctx.fillText(`Invoice No: ${invoiceNumber}`, startX, currentY)
      currentY += 30

      // Date
      ctx.font = '16px Arial'
      ctx.fillText(`Date: ${invoiceDate}`, startX, currentY)
      currentY += 50

      // Vehicle Details
      ctx.font = 'bold 16px Arial'
      ctx.fillText('Vehicle Details:', startX, currentY)
      currentY += 25
      ctx.font = '14px Arial'
      ctx.fillText(`Maker: ${maker}`, startX, currentY)
      currentY += 20
      ctx.fillText(`Model: ${model}`, startX, currentY)
      currentY += 20
      ctx.fillText(`Chassis Number: ${chassisNo}`, startX, currentY)
      currentY += 20
      ctx.fillText(`Year: ${manufacturerYear}`, startX, currentY)
      currentY += 20
      ctx.fillText(`Mileage: ${parseInt(mileage).toLocaleString()} km`, startX, currentY)
      currentY += 40

      // Customer Details
      ctx.font = 'bold 16px Arial'
      ctx.fillText('Customer Details:', startX, currentY)
      currentY += 25
      ctx.font = '14px Arial'
      ctx.fillText(`Name: ${buyerName}`, startX, currentY)
      currentY += 20
      ctx.fillText(`Phone: ${buyerPhone || 'N/A'}`, startX, currentY)
      currentY += 20
      
      // Handle multi-line address
      const addressLines = formattedAddress.split(',').map(line => line.trim())
      addressLines.forEach(line => {
        if (line) {
          ctx.fillText(`Address: ${line}`, startX, currentY)
          currentY += 20
        }
      })
      if (addressLines.length === 0) {
        ctx.fillText(`Address: N/A`, startX, currentY)
        currentY += 20
      }
      currentY += 20

      // Payment Summary (in JPY) - No advances for Sell Now
      ctx.font = 'bold 16px Arial'
      ctx.fillText('Payment Summary:', startX, currentY)
      currentY += 25
      ctx.font = 'bold 16px Arial'
      
      // Vehicle Price (CIF + Profit) - No advances, no breakdown
      ctx.fillText(`Vehicle Price: ${soldPriceJpy.toLocaleString()} JPY`, startX, currentY)

      // Convert canvas to image
      const imgData = canvas.toDataURL('image/png')

      // Create PDF (A4 size)
      const { jsPDF } = await import('jspdf')
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
      const ratio = Math.min(pdfWidth / (imgWidth * 0.264583), pdfHeight / (imgHeight * 0.264583))
      const finalWidth = imgWidth * 0.264583 * ratio
      const finalHeight = imgHeight * 0.264583 * ratio

      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 0, 0, finalWidth, finalHeight)

      // Download PDF
      pdf.save(`Invoice-${chassisNo}-${Date.now()}.pdf`)
    } catch (error: any) {
      console.error('Error generating invoice:', error)
      alert(`Error generating invoice: ${error.message}. Make sure the template file exists at /templates/invoice_blank.png`)
    }
  }

  async function generateInvoiceFromStep2Old(soldPriceJpy: number, soldPriceLkr: number, cifTotal: number) {
    const invoiceWindow = window.open('', '_blank')
    if (!invoiceWindow) return

    invoiceWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${process.env.NEXT_PUBLIC_INVOICE_PREFIX}${chassisNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 20px; }
            .header h1 { margin: 0; color: #1e40af; font-size: 32px; }
            .invoice-number { font-size: 18px; color: #64748b; margin-top: 10px; }
            .section { margin: 25px 0; }
            .section h3 { color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
            .details table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .details td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
            .details td:first-child { font-weight: bold; width: 35%; color: #475569; }
            .total-section { margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 10px; border: 2px solid #3b82f6; }
            .total-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 16px; }
            .total-row.final { font-size: 24px; font-weight: bold; margin-top: 15px; padding-top: 15px; border-top: 2px solid #3b82f6; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>INVOICE</h1>
            <div class="invoice-number">Invoice No: ${process.env.NEXT_PUBLIC_INVOICE_PREFIX}${chassisNo}-${Date.now()}</div>
            <div style="margin-top: 10px; color: #64748b;">Date: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="section">
            <h3>Vehicle Details</h3>
            <table class="details">
              <tr><td>Maker & Model:</td><td>${maker} ${model}</td></tr>
              <tr><td>Chassis Number:</td><td>${chassisNo}</td></tr>
              <tr><td>Year:</td><td>${manufacturerYear}</td></tr>
              <tr><td>Mileage:</td><td>${mileage.toLocaleString()} km</td></tr>
            </table>
          </div>

          <div class="section">
            <h3>Customer Details</h3>
            <table class="details">
              <tr><td>Name:</td><td>${buyerName}</td></tr>
              <tr><td>Phone:</td><td>${buyerPhone || 'N/A'}</td></tr>
              <tr><td>Address:</td><td>${buyerAddress || 'N/A'}</td></tr>
            </table>
          </div>

          <div class="section">
            <h3>Payment Details</h3>
            <div class="total-section">
              <div class="total-row final">
                <span>Sold Price (JPY):</span>
                <span>${soldPriceJpy.toLocaleString()} JPY</span>
              </div>
            </div>
          </div>

          <div style="margin-top: 40px; text-align: center; color: #64748b; font-size: 14px;">
            <p>Thank you for your business!</p>
            <p style="margin-top: 10px;">This is a computer-generated invoice.</p>
          </div>
        </body>
      </html>
    `)
    invoiceWindow.document.close()
  }

  async function generateInvoiceFromStep4(soldPriceJpy: number, soldPriceLkr: number) {
    // Similar to generateInvoiceFromStep2 but for Step 4
    await generateInvoiceFromStep2(soldPriceJpy, soldPriceLkr, parseFloat(invoiceAmountJpy) || 0)
  }

  async function loadRateForSellNow() {
    setLoadingRate(true)
    try {
      const rate = await fetchJPYToLKRRate()
      setSellNowStep2Rate(rate)
    } catch (error) {
      console.error('Failed to load exchange rate:', error)
      setSellNowStep2Rate(1.9775) // Fallback
    } finally {
      setLoadingRate(false)
    }
  }

  const steps = purchaseSource === 'sri-lanka' 
    ? [
        { number: 1, title: 'Vehicle Details' },
      ]
    : [
        { number: 1, title: 'Vehicle Details' },
        { number: 2, title: 'Japan Costs (JPY)' },
        { number: 3, title: 'Split CIF' },
        { number: 4, title: 'JPY → LKR Conversion' },
      ]

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-stone-900 mb-2">Add Vehicle</h1>
        <p className="text-stone-700 mb-8">Add a new vehicle to the system</p>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                      currentStep >= step.number
                        ? 'bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 text-amber-50 shadow-lg border border-amber-700/30'
                        : 'bg-stone-200 text-stone-500'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <span className="mt-2 text-sm font-medium text-stone-800">
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-2 transition-all duration-300 ${
                      currentStep > step.number
                        ? 'bg-gradient-to-r from-amber-900 to-amber-800'
                        : 'bg-stone-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="card p-8">
          <AnimatePresence mode="wait">
            {currentStep === 1 && !purchaseSource && enableSriLankaPurchase && (
              <motion.div
                key="purchase-source"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-stone-900 mb-6">Purchase Source</h2>
                <p className="text-stone-700 mb-6">Where was this vehicle purchased from?</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setPurchaseSource('japan')}
                    className="p-6 border-2 border-stone-300 rounded-lg hover:border-amber-600 hover:bg-amber-50 transition-all text-left"
                  >
                    <div className="font-semibold text-lg text-stone-900 mb-2">🇯🇵 Bought from Japan</div>
                    <div className="text-sm text-stone-600">Enter Japan costs in JPY and convert to LKR</div>
                  </button>
                  <button
                    onClick={() => setPurchaseSource('sri-lanka')}
                    className="p-6 border-2 border-stone-300 rounded-lg hover:border-amber-600 hover:bg-amber-50 transition-all text-left"
                  >
                    <div className="font-semibold text-lg text-stone-900 mb-2">🇱🇰 Bought from Sri Lanka</div>
                    <div className="text-sm text-stone-600">Enter buying price directly in LKR</div>
                  </button>
                </div>
              </motion.div>
            )}

            {currentStep === 1 && purchaseSource && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-stone-900">Vehicle Details</h2>
                  {purchaseSource === 'sri-lanka' && (
                    <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold">
                      🇱🇰 Sri Lanka Purchase
                    </div>
                  )}
                  {purchaseSource === 'japan' && (
                    <div className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-semibold">
                      🇯🇵 Japan Purchase
                    </div>
                  )}
                </div>
                
                {purchaseSource === 'sri-lanka' && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <label className="label">Buying Price (LKR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={buyingPriceLkr}
                      onChange={(e) => setBuyingPriceLkr(e.target.value)}
                      className="input-field"
                      placeholder="Enter buying price in LKR"
                      required
                    />
                    <p className="text-xs text-blue-700 mt-2">
                      This will be used as the invoice value for tax calculations
                    </p>
                  </div>
                )}
                
                <div>
                  <label className="label">Chassis Number *</label>
                  <input
                    type="text"
                    value={chassisNo}
                    onChange={(e) => setChassisNo(e.target.value)}
                    className="input-field"
                    placeholder="Enter chassis number"
                    required
                  />
                </div>

                {purchaseSource === 'sri-lanka' && (
                  <div>
                    <label className="label">Registration Number *</label>
                    <input
                      type="text"
                      value={registrationNo}
                      onChange={(e) => setRegistrationNo(e.target.value)}
                      className="input-field"
                      placeholder="Enter registration number"
                      required
                    />
                    <p className="text-xs text-blue-700 mt-2">
                      This will be displayed instead of chassis number in invoices and summaries
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Maker *</label>
                    <select
                      value={maker}
                      onChange={(e) => {
                        setMaker(e.target.value)
                        setModel('')
                        setIsCustomModel(false)
                      }}
                      className="select-field"
                      required
                    >
                      <option value="">Select Maker</option>
                      {vehicleMakes.map((make) => (
                        <option key={make} value={make}>
                          {make}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Model *</label>
                    {!isCustomModel ? (
                      <select
                        value={model}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '__custom__') {
                            setIsCustomModel(true)
                            setModel('')
                          } else {
                            setModel(value)
                          }
                        }}
                        className="select-field"
                        required
                        disabled={!maker}
                      >
                        <option value="">{maker ? 'Select Model' : 'Select Maker First'}</option>
                        {maker &&
                          getModelsForMake(maker).map((modelName) => (
                            <option key={modelName} value={modelName}>
                              {modelName}
                            </option>
                          ))}
                        {maker && (
                          <option value="__custom__">Other / Custom…</option>
                        )}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="input-field"
                        placeholder="Type custom model name"
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Manufacturer Year *</label>
                    <input
                      type="number"
                      value={manufacturerYear}
                      onChange={(e) => setManufacturerYear(e.target.value)}
                      className="input-field"
                      placeholder="e.g., 2020"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Mileage *</label>
                    <input
                      type="number"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      className="input-field"
                      placeholder="e.g., 50000"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && purchaseSource === 'japan' && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-stone-900 mb-6">Japan Costs (JPY)</h2>
                
                <div>
                  <label className="label">Bidding Price (JPY)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bidJpy}
                    onChange={(e) => setBidJpy(e.target.value)}
                    className="input-field"
                    placeholder="Enter amount"
                  />
                </div>

                <div>
                  <label className="label">Shipping (JPY)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={inlandTransportJpy}
                    onChange={(e) => setInlandTransportJpy(e.target.value)}
                    className="input-field"
                    placeholder="Enter amount"
                  />
                </div>

                <div>
                  <label className="label">Commission (JPY)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={commissionJpy}
                    onChange={(e) => setCommissionJpy(e.target.value)}
                    className="input-field"
                    placeholder="Enter amount"
                  />
                </div>

                <div>
                  <label className="label">Insurance (JPY)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={insuranceJpy}
                    onChange={(e) => setInsuranceJpy(e.target.value)}
                    className="input-field"
                    placeholder="Enter amount"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Other Cost 1 - Name</label>
                    <input
                      type="text"
                      value={otherCost1Label}
                      onChange={(e) => setOtherCost1Label(e.target.value)}
                      className="input-field"
                      placeholder="Custom name"
                    />
                  </div>
                  <div>
                    <label className="label">Other Cost 1 - Amount (JPY)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={otherCost1Jpy}
                      onChange={(e) => setOtherCost1Jpy(e.target.value)}
                      className="input-field"
                      placeholder="Enter amount"
                    />
                  </div>
                </div>

                  <div className="mt-6 p-4 bg-amber-50/50 rounded-lg border-2 border-amber-200/60">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900">Total CIF Cost (JPY):</span>
                    <span className="text-2xl font-bold text-amber-800">
                      {formatNumber(calculateCIFTotal())} JPY
                    </span>
                  </div>
                </div>

              </motion.div>
            )}

            {currentStep === 3 && purchaseSource === 'japan' && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-stone-900 mb-6">Split CIF into Two Parts</h2>
                <p className="text-stone-700 mb-6">
                  Total CIF: <strong>{formatNumber(calculateCIFTotal())} JPY</strong>
                </p>
                
                <div>
                  <label className="label">Invoice Amount (JPY) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceAmountJpy}
                    onChange={(e) => {
                      const invoiceValue = e.target.value
                      setInvoiceAmountJpy(invoiceValue)
                      // Auto-calculate Undial Amount
                      const cifTotal = calculateCIFTotal()
                      const invoiceNum = parseFloat(invoiceValue) || 0
                      if (invoiceNum > 0 && cifTotal > 0) {
                        const undialValue = cifTotal - invoiceNum
                        setUndialAmountJpy(undialValue >= 0 ? undialValue.toString() : '')
                      } else if (!invoiceValue) {
                        setUndialAmountJpy('')
                      }
                    }}
                    className="input-field"
                    placeholder="Enter invoice amount"
                    required
                  />
                </div>

                <div>
                  <label className="label">Undial Amount (JPY) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={undialAmountJpy}
                    onChange={(e) => setUndialAmountJpy(e.target.value)}
                    className="input-field"
                    placeholder="Auto-calculated or enter manually"
                    required
                  />
                  <p className="text-xs text-stone-600 mt-1">
                    Auto-calculated from Total CIF - Invoice Amount (you can still edit manually)
                  </p>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && purchaseSource === 'japan' && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-stone-900 mb-6">JPY → LKR Conversion</h2>
                
                <div>
                  <label className="label">Invoice Amount (JPY)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceAmountJpy}
                    disabled
                    className="input-field bg-stone-100/50"
                  />
                  <div className="mt-2">
                    <label className="label">
                      Invoice JPY → LKR Rate
                      {rateLoading && <span className="ml-2 text-xs text-amber-700">Loading...</span>}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={invoiceRate || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === '') {
                          setInvoiceRate(null)
                        } else {
                          const numValue = parseFloat(value)
                          if (!isNaN(numValue) && numValue > 0) {
                            setInvoiceRate(numValue)
                          }
                        }
                      }}
                      className="input-field"
                      placeholder="e.g., 1.9775"
                    />
                    <p className="text-xs text-stone-600 mt-1">
                      Auto-fetched from <a 
                        href="https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/jpy-lkr-indicative-rate-chart" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-amber-700 hover:underline"
                      >
                        Central Bank of Sri Lanka
                      </a> (you can edit manually)
                    </p>
                  </div>
                  <div className="mt-4 p-3 bg-amber-50/30 rounded-lg border border-amber-200/40">
                    <span className="font-semibold text-stone-800">Invoice LKR: </span>
                    <span className="text-lg text-amber-900">
                      {formatCurrency((parseFloat(invoiceAmountJpy) || 0) * (invoiceRate || 0))}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="label">Undial Amount (JPY)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={undialAmountJpy}
                    disabled
                    className="input-field bg-slate-50"
                  />
                  {(parseFloat(undialAmountJpy) || 0) > 0 && (
                    <>
                      <div className="mt-2">
                        <label className="label">Undial JPY → LKR Rate (Manual) *</label>
                        <input
                          type="number"
                          step="0.001"
                          value={undialRate}
                          onChange={(e) => setUndialRate(e.target.value)}
                          className="input-field"
                          placeholder="e.g., 1.998"
                          required
                        />
                      </div>
                      <div className="mt-4 p-3 bg-amber-50/30 rounded-lg border border-amber-200/40">
                        <span className="font-semibold text-stone-800">Undial LKR: </span>
                        <span className="text-lg text-amber-900">
                          {formatCurrency((parseFloat(undialAmountJpy) || 0) * (parseFloat(undialRate) || 0))}
                        </span>
                      </div>
                    </>
                  )}
                  {(parseFloat(undialAmountJpy) || 0) === 0 && (
                    <p className="text-xs text-slate-600 mt-2">
                      No undial amount, so undial rate is not required.
                    </p>
                  )}
                </div>

                <div className="mt-6 p-6 bg-gradient-to-r from-amber-50/60 to-stone-50 rounded-lg border-2 border-amber-300/50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-800">Total JPY:</span>
                      <span className="text-xl font-bold text-stone-900">
                        {formatNumber(calculateCIFTotal())} JPY
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-800">Total Japan Cost (LKR):</span>
                      <span className="text-2xl font-bold text-amber-900">
                        {formatCurrency(calculateJapanTotalLKR())}
                      </span>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-amber-200/40">
            <button
              onClick={() => {
                if (currentStep === 1 && purchaseSource) {
                  setPurchaseSource(null)
                } else {
                  setCurrentStep(Math.max(1, currentStep - 1) as Step)
                }
              }}
              disabled={currentStep === 1 && !purchaseSource && enableSriLankaPurchase}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            {!purchaseSource && enableSriLankaPurchase ? (
              <div className="flex items-center gap-4">
                {/* No next button until source is selected */}
              </div>
            ) : !purchaseSource && !enableSriLankaPurchase ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    if (canProceedToStep2()) {
                      setCurrentStep(2)
                    }
                  }}
                  disabled={!canProceedToStep2()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ) : purchaseSource === 'sri-lanka' && currentStep === 1 ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSaveNotAvailable}
                  disabled={loading || !canProceedToStep2()}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Add to Not Available'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || !canSave()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save & Add to Available'}
                </button>
              </div>
            ) : currentStep < 4 ? (
              <div className="flex items-center gap-4">
                {(currentStep === 1 || currentStep === 2 || currentStep === 3) && (
                  <button
                    onClick={handleSaveNotAvailable}
                    disabled={loading || !canProceedToStep2()}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Add to Not Available'}
                  </button>
                )}
                {currentStep === 2 && isAdmin(user) && calculateCIFTotal() > 0 && (
                  <button
                    onClick={async () => {
                      await loadRateForSellNow()
                      setShowSellNowStep2(true)
                    }}
                    disabled={loadingRate}
                    className="px-6 py-3 bg-gradient-to-r from-amber-800 to-amber-900 text-amber-50 font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 active:scale-95 border border-amber-700/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingRate ? 'Loading...' : 'Sell Now'}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (currentStep === 1 && canProceedToStep2()) {
                      setCurrentStep(2)
                    } else if (currentStep === 2 && canProceedToStep3()) {
                      setCurrentStep(3)
                    } else if (currentStep === 3 && canProceedToStep4()) {
                      setCurrentStep(4)
                    }
                  }}
                  disabled={
                    (currentStep === 1 && !canProceedToStep2()) ||
                    (currentStep === 2 && !canProceedToStep3()) ||
                    (currentStep === 3 && !canProceedToStep4())
                  }
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSave}
                disabled={!canSave() || loading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? 'Saving...' : 'Save Vehicle'}
                <Check className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Sell Now Modal for Step 2 */}
      {showSellNowStep2 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-stone-900">Sell Vehicle Now</h2>
              <button
                onClick={() => {
                  setShowSellNowStep2(false)
                  setBuyerName('')
                  setBuyerAddress('')
                  setBuyerPhone('')
                  setExpectedProfitJpy('')
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Total CIF: {formatNumber(calculateCIFTotal())} JPY
                  {sellNowStep2Rate && (
                    <span className="ml-2">Rate: 1 JPY = {sellNowStep2Rate} LKR</span>
                  )}
                </p>
              </div>

              <div>
                <label className="label">Customer Name *</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="label">Customer Address</label>
                <input
                  type="text"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Customer Phone</label>
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
                {sellNowStep2Rate && expectedProfitJpy && (
                  <p className="text-sm text-stone-600 mt-1">
                    Profit in LKR: {formatCurrency(parseFloat(expectedProfitJpy) * sellNowStep2Rate)}
                  </p>
                )}
              </div>

              {sellNowStep2Rate && expectedProfitJpy && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Calculation Summary</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Total CIF (JPY):</span>
                      <span>{formatNumber(calculateCIFTotal())} JPY</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Profit (JPY):</span>
                      <span>{formatNumber(parseFloat(expectedProfitJpy))} JPY</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-300 font-semibold">
                      <span>Sold Price (JPY):</span>
                      <span>{formatNumber(calculateCIFTotal() + parseFloat(expectedProfitJpy))} JPY</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-300 font-semibold text-green-700">
                      <span>Profit (LKR):</span>
                      <span>{formatCurrency((calculateCIFTotal() + parseFloat(expectedProfitJpy)) * sellNowStep2Rate - (calculateCIFTotal() * sellNowStep2Rate))}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-4">
              <button
                onClick={() => {
                  setShowSellNowStep2(false)
                  setBuyerName('')
                  setBuyerAddress('')
                  setBuyerPhone('')
                  setExpectedProfitJpy('')
                }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSellNowFromStep2}
                className="btn-primary"
                disabled={loading || !buyerName || !expectedProfitJpy || !sellNowStep2Rate}
              >
                {loading ? 'Processing...' : 'Sell & Print Invoice'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

