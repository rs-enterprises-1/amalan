'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { Vehicle } from '@/lib/database.types'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Edit, DollarSign, CheckCircle, Car, Trash2, Search, Printer, AlertCircle } from 'lucide-react'
import jsPDF from 'jspdf'
import EditLocalCostsModal from './EditLocalCostsModal'
import AddAdvanceModal from './AddAdvanceModal'
import MarkSoldModal from './MarkSoldModal'

interface AvailableVehiclesListProps {
  user: User
  showReservedBadge?: boolean
  showReservedOnly?: boolean
}

export default function AvailableVehiclesList({ user, showReservedBadge = false, showReservedOnly = false }: AvailableVehiclesListProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showEditCosts, setShowEditCosts] = useState(false)
  const [showAddAdvance, setShowAddAdvance] = useState(false)
  const [showMarkSold, setShowMarkSold] = useState(false)
  const [reservedChassisNos, setReservedChassisNos] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    loadVehicles()
  }, [])

  // Refresh when page becomes visible (user navigates back to this page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadVehicles()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

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

    let filteredVehicles = data || []

    // Get reserved vehicles (vehicles with advances)
    const chassisNos = filteredVehicles.map(v => v.chassis_no)
    const { data: advances } = await supabase
      .from('advances')
      .select('chassis_no')
      .in('chassis_no', chassisNos)

    const reservedSet = new Set(advances?.map(a => a.chassis_no) || [])
    setReservedChassisNos(reservedSet)

    // If showReservedOnly is true, filter to only vehicles with advances
    if (showReservedOnly) {
      filteredVehicles = filteredVehicles.filter(v => reservedSet.has(v.chassis_no))
    }

    setVehicles(filteredVehicles)
    setLoading(false)
  }

  function calculateLocalTotal(vehicle: Vehicle): number {
    const tax = vehicle.tax_lkr || 0
    const clearance = vehicle.clearance_lkr || 0
    const transport = vehicle.transport_lkr || 0

    // Extra local costs (multiple slots)
    const extra1 = vehicle.local_extra1_lkr || 0
    const extra2 = vehicle.local_extra2_lkr || 0
    const extra3 = vehicle.local_extra3_lkr || 0
    const extra4 = (vehicle as any).local_extra4_lkr || 0
    const extra5 = (vehicle as any).local_extra5_lkr || 0

    // For Sri Lanka purchases we store the three extra local costs in
    // local_extra3 / local_extra4 / local_extra5 (see EditLocalCostsModal).
    if (isSriLankaPurchase(vehicle)) {
      return tax + clearance + transport + extra3 + extra4 + extra5
    }

    // For Japan purchases, include all extra local cost slots (1–5)
    return tax + clearance + transport + extra1 + extra2 + extra3 + extra4 + extra5
  }

  function isSriLankaPurchase(vehicle: Vehicle): boolean {
    // Sri Lanka purchases have:
    // - invoice_jpy_to_lkr_rate = 1 (already in LKR)
    // - No Japan costs (all bid_jpy, commission_jpy, etc. are null)
    const hasNoJapanCosts = !vehicle.bid_jpy && !vehicle.commission_jpy && !vehicle.insurance_jpy && 
                             !vehicle.inland_transport_jpy && !vehicle.other_jpy
    const rateIsOne = vehicle.invoice_jpy_to_lkr_rate === 1 || vehicle.invoice_jpy_to_lkr_rate === null
    
    return hasNoJapanCosts && rateIsOne
  }

  function getMissingRequiredFields(vehicle: Vehicle): string[] {
    const missing: string[] = []
    const isSriLanka = isSriLankaPurchase(vehicle)
    
    if (isSriLanka) {
      // For Sri Lanka purchases, no required fields - all are optional
      // Return empty array (no warnings)
      return []
    } else {
      // For Japan purchases:
      // - If there are NO local costs (only LC commission / nothing), vehicle is still in Japan → no warnings.
      // - Once local costs are filled (vehicle in Sri Lanka), require Tax / Clearance / Transport / LC Charges.
      if (!hasLocalCostsEntered(vehicle)) {
        return []
      }

      // Vehicle is effectively in Sri Lanka (local costs entered) → check Tax, Clearance, Transport, LC Charges
      if (!vehicle.tax_lkr || vehicle.tax_lkr === 0) {
        missing.push('Tax')
      }
      if (!vehicle.clearance_lkr || vehicle.clearance_lkr === 0) {
        missing.push('Clearance')
      }
      if (!vehicle.transport_lkr || vehicle.transport_lkr === 0) {
        missing.push('Transport')
      }
      // Check LC Charges - check both new field and old location for backward compatibility
      const lcCharges = vehicle.lc_charges_lkr || 
        ((vehicle.local_extra2_label && 
          (vehicle.local_extra2_label.toUpperCase().trim() === 'LC CHARGES' ||
           vehicle.local_extra2_label.toUpperCase().trim() === 'L/C CHGS' ||
           vehicle.local_extra2_label.toUpperCase().trim() === 'LC CHGS' ||
           vehicle.local_extra2_label.toUpperCase().trim() === 'L.C. CHGS' ||
           (vehicle.local_extra2_label.toUpperCase().includes('LC') && vehicle.local_extra2_label.toUpperCase().includes('CHARGES')) ||
           (vehicle.local_extra2_label.toUpperCase().includes('L/C') && vehicle.local_extra2_label.toUpperCase().includes('CHGS')) ||
           (vehicle.local_extra2_label.toUpperCase().includes('L.C.') && vehicle.local_extra2_label.toUpperCase().includes('CHGS'))
          )) ? vehicle.local_extra2_lkr : null)
      if (!lcCharges || lcCharges === 0) {
        missing.push('LC Charges')
      }
    }
    return missing
  }

  function hasLocalCostsEntered(vehicle: Vehicle): boolean {
    // Check if any local costs are entered, excluding LC Commission (which is auto-filled)
    const tax = vehicle.tax_lkr || 0
    const clearance = vehicle.clearance_lkr || 0
    const transport = vehicle.transport_lkr || 0
    
    // Check extra1 only if it's NOT LC Commission
    const extra1Label = vehicle.local_extra1_label || ''
    const extra1 = (extra1Label === 'LC Commission' || extra1Label === '') ? 0 : (vehicle.local_extra1_lkr || 0)
    
    const extra2 = vehicle.local_extra2_lkr || 0
    const extra3 = vehicle.local_extra3_lkr || 0
    
    return tax > 0 || clearance > 0 || transport > 0 || extra1 > 0 || extra2 > 0 || extra3 > 0
  }

  function calculateCombinedTotal(vehicle: Vehicle): number {
    const japanTotal = vehicle.japan_total_lkr || 0
    const localTotal = calculateLocalTotal(vehicle)
    return japanTotal + localTotal
  }

  async function generateAllVehiclesChartPDF() {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Title
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('Available Vehicles Chart', 105, 15, { align: 'center' })

      // Table headers
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      let yPos = 25
      const col1X = 15  // Chassis No
      const col2X = 50  // Maker + Model
      const col3X = 120 // Total Cost
      
      pdf.text('Chassis No', col1X, yPos)
      pdf.text('Maker + Model', col2X, yPos)
      pdf.text('Total Cost (LKR)', col3X, yPos)
      
      // Draw header line
      yPos += 3
      pdf.line(15, yPos, 190, yPos)
      yPos += 5

      // Table rows
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      
      const sortedVehicles = [...vehicles].sort((a, b) => {
        const aTotal = calculateCombinedTotal(a)
        const bTotal = calculateCombinedTotal(b)
        return bTotal - aTotal // Sort by total cost descending
      })

      sortedVehicles.forEach((vehicle, index) => {
        // Check if we need a new page
        if (yPos > 270) {
          pdf.addPage()
          yPos = 20
          
          // Redraw headers on new page
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(11)
          pdf.text('Chassis No', col1X, yPos)
          pdf.text('Maker + Model', col2X, yPos)
          pdf.text('Total Cost (LKR)', col3X, yPos)
          yPos += 3
          pdf.line(15, yPos, 190, yPos)
          yPos += 5
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(10)
        }

        const chassisNo = vehicle.chassis_no.toString()
        const makerModel = `${vehicle.maker} ${vehicle.model}`
        const totalCost = calculateCombinedTotal(vehicle)

        // Truncate if too long
        const maxChassisWidth = 30
        const maxMakerModelWidth = 60
        let displayChassis = chassisNo
        let displayMakerModel = makerModel

        if (pdf.getTextWidth(displayChassis) > maxChassisWidth) {
          displayChassis = displayChassis.substring(0, Math.min(15, displayChassis.length))
        }
        if (pdf.getTextWidth(displayMakerModel) > maxMakerModelWidth) {
          displayMakerModel = displayMakerModel.substring(0, Math.min(40, displayMakerModel.length))
        }

        pdf.text(displayChassis, col1X, yPos)
        pdf.text(displayMakerModel, col2X, yPos)
        pdf.text(formatCurrency(totalCost), col3X, yPos)
        
        yPos += 7
      })

      // Footer with total count and sum
      yPos += 5
      pdf.line(15, yPos, 190, yPos)
      yPos += 7
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      const grandTotal = sortedVehicles.reduce((sum, v) => sum + calculateCombinedTotal(v), 0)
      pdf.text(`Total Vehicles: ${sortedVehicles.length}`, col1X, yPos)
      pdf.text(`Grand Total: ${formatCurrency(grandTotal)}`, col3X, yPos)

      // Save PDF
      pdf.save(`Available-Vehicles-Chart-${Date.now()}.pdf`)
    } catch (error: any) {
      console.error('Error generating vehicles chart:', error)
      alert(`Error generating chart: ${error.message}`)
    }
  }

  async function generateCostBreakdownPDF(vehicle: Vehicle) {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Set font
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(20)
      pdf.text('Cost Breakdown Report', 105, 20, { align: 'center' })

      // Vehicle Information
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Vehicle Information', 20, 35)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      let yPos = 42
      pdf.text(`Maker: ${vehicle.maker}`, 20, yPos)
      yPos += 7
      pdf.text(`Model: ${vehicle.model}`, 20, yPos)
      yPos += 7
      pdf.text(`Chassis Number: ${vehicle.chassis_no}`, 20, yPos)
      yPos += 7
      pdf.text(`Year: ${vehicle.manufacturer_year}`, 20, yPos)
      yPos += 7
      pdf.text(`Mileage: ${formatNumber(vehicle.mileage)} km`, 20, yPos)
      yPos += 10

      // Japan Costs (JPY)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text('Japan Costs (JPY)', 20, yPos)
      yPos += 7
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      
      const bidJpy = vehicle.bid_jpy || 0
      const shippingJpy = vehicle.inland_transport_jpy || 0
      const commissionJpy = vehicle.commission_jpy || 0
      const insuranceJpy = vehicle.insurance_jpy || 0
      const otherJpy = vehicle.other_jpy || 0
      const otherLabel = vehicle.other_label || 'Other Cost'
      const cifTotal = bidJpy + shippingJpy + commissionJpy + insuranceJpy + otherJpy

      pdf.text(`Bidding Price: ${formatNumber(bidJpy)} JPY`, 20, yPos)
      yPos += 7
      pdf.text(`Shipping: ${formatNumber(shippingJpy)} JPY`, 20, yPos)
      yPos += 7
      pdf.text(`Commission: ${formatNumber(commissionJpy)} JPY`, 20, yPos)
      yPos += 7
      pdf.text(`Insurance: ${formatNumber(insuranceJpy)} JPY`, 20, yPos)
      yPos += 7
      if (otherJpy > 0) {
        pdf.text(`${otherLabel}: ${formatNumber(otherJpy)} JPY`, 20, yPos)
        yPos += 7
      }
      pdf.setFont('helvetica', 'bold')
      pdf.text(`Total CIF: ${formatNumber(cifTotal)} JPY`, 20, yPos)
      yPos += 10

      // CIF Split
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text('CIF Split', 20, yPos)
      yPos += 7
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      
      const invoiceJpy = vehicle.invoice_amount_jpy || 0
      const undialJpy = vehicle.undial_amount_jpy || 0
      const invoiceRate = vehicle.invoice_jpy_to_lkr_rate || 0
      const undialRate = vehicle.undial_jpy_to_lkr_rate || 0

      pdf.text(`Invoice Amount: ${formatNumber(invoiceJpy)} JPY`, 20, yPos)
      yPos += 7
      pdf.text(`Invoice Rate: ${invoiceRate.toFixed(4)}`, 20, yPos)
      yPos += 7
      pdf.text(`Invoice Amount (LKR): ${formatCurrency(invoiceJpy * invoiceRate)}`, 20, yPos)
      yPos += 7
      if (undialJpy > 0) {
        pdf.text(`Undial Amount: ${formatNumber(undialJpy)} JPY`, 20, yPos)
        yPos += 7
        pdf.text(`Undial Rate: ${undialRate.toFixed(4)}`, 20, yPos)
        yPos += 7
        pdf.text(`Undial Amount (LKR): ${formatCurrency(undialJpy * undialRate)}`, 20, yPos)
        yPos += 7
      }
      pdf.setFont('helvetica', 'bold')
      const japanTotalLkr = (invoiceJpy * invoiceRate) + (undialJpy * undialRate)
      pdf.text(`Total Japan Cost (LKR): ${formatCurrency(japanTotalLkr)}`, 20, yPos)
      yPos += 10

      // Local Costs (LKR)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text('Local Costs (LKR)', 20, yPos)
      yPos += 7
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      
      const tax = vehicle.tax_lkr || 0
      const clearance = vehicle.clearance_lkr || 0
      const transport = vehicle.transport_lkr || 0

      const isSriLanka = isSriLankaPurchase(vehicle)

      // Map extra local costs depending on purchase type.
      // For Sri Lanka purchases, the user enters three extra locals into
      // local_extra3 / 4 / 5 (see EditLocalCostsModal). We want them to show
      // up here as "Extra Cost 1 / 2 / 3".
      const extra1 = isSriLanka ? (vehicle.local_extra3_lkr || 0) : (vehicle.local_extra1_lkr || 0)
      const extra1Label = isSriLanka
        ? (vehicle.local_extra3_label || 'Extra Cost 1')
        : (vehicle.local_extra1_label || 'Extra Cost 1')

      const extra2 = isSriLanka ? ((vehicle as any).local_extra4_lkr || 0) : (vehicle.local_extra2_lkr || 0)
      const extra2Label = isSriLanka
        ? ((vehicle as any).local_extra4_label || 'Extra Cost 2')
        : (vehicle.local_extra2_label || 'Extra Cost 2')

      const extra3 = isSriLanka ? ((vehicle as any).local_extra5_lkr || 0) : (vehicle.local_extra3_lkr || 0)
      const extra3Label = isSriLanka
        ? ((vehicle as any).local_extra5_label || 'Extra Cost 3')
        : (vehicle.local_extra3_label || 'Extra Cost 3')

      // For Japan purchases we can also have extra4 / extra5 – show them as well.
      const extra4 = !isSriLanka ? ((vehicle as any).local_extra4_lkr || 0) : 0
      const extra4Label = !isSriLanka
        ? ((vehicle as any).local_extra4_label || 'Extra Cost 4')
        : ''

      const extra5 = !isSriLanka ? ((vehicle as any).local_extra5_lkr || 0) : 0
      const extra5Label = !isSriLanka
        ? ((vehicle as any).local_extra5_label || 'Extra Cost 5')
        : ''

      if (tax > 0) {
        pdf.text(`Tax: ${formatCurrency(tax)}`, 20, yPos)
        yPos += 7
      }
      if (clearance > 0) {
        pdf.text(`Clearance: ${formatCurrency(clearance)}`, 20, yPos)
        yPos += 7
      }
      if (transport > 0) {
        pdf.text(`Transport: ${formatCurrency(transport)}`, 20, yPos)
        yPos += 7
      }
      if (extra1 > 0) {
        pdf.text(`${extra1Label}: ${formatCurrency(extra1)}`, 20, yPos)
        yPos += 7
      }
      if (extra2 > 0) {
        pdf.text(`${extra2Label}: ${formatCurrency(extra2)}`, 20, yPos)
        yPos += 7
      }
      if (extra3 > 0) {
        pdf.text(`${extra3Label}: ${formatCurrency(extra3)}`, 20, yPos)
        yPos += 7
      }
      if (extra4 > 0) {
        pdf.text(`${extra4Label}: ${formatCurrency(extra4)}`, 20, yPos)
        yPos += 7
      }
      if (extra5 > 0) {
        pdf.text(`${extra5Label}: ${formatCurrency(extra5)}`, 20, yPos)
        yPos += 7
      }
      
      const localTotal = calculateLocalTotal(vehicle)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`Total Local Costs (LKR): ${formatCurrency(localTotal)}`, 20, yPos)
      yPos += 10

      // Final Total
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      const finalTotal = japanTotalLkr + localTotal
      pdf.text(`Final Combined Total (LKR): ${formatCurrency(finalTotal)}`, 20, yPos)

      // Save PDF
      pdf.save(`Cost-Breakdown-${vehicle.chassis_no}-${Date.now()}.pdf`)
    } catch (error: any) {
      console.error('Error generating cost breakdown:', error)
      alert(`Error generating cost breakdown: ${error.message}`)
    }
  }

  async function handleDeleteVehicle(vehicle: Vehicle) {
    if (!confirm(`Are you sure you want to delete this vehicle?\n\nVehicle: ${vehicle.maker} ${vehicle.model}\nChassis: ${vehicle.chassis_no}\n\nThis will permanently delete:\n- Vehicle record\n- All advance payments\n- All advance records\n- All related data\n\nThis action cannot be undone!`)) {
      return
    }

    try {
      // Delete vehicle - this will cascade delete related records (advances, advance_payments, etc.)
      // due to ON DELETE CASCADE in the database
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('chassis_no', vehicle.chassis_no)

      if (error) throw error

      alert('Vehicle deleted successfully.')
      loadVehicles() // Reload the list
    } catch (error: any) {
      console.error('Error deleting vehicle:', error)
      alert(`Error deleting vehicle: ${error.message}`)
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
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-1">Available Vehicles</h1>
            <p className="text-slate-600 text-sm">Manage vehicles currently in stock</p>
          </div>
          {vehicles.length > 0 && (
            <button
              onClick={generateAllVehiclesChartPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Printer className="w-4 h-4" />
              Print All Vehicles
            </button>
          )}
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
                  Found {vehicles.filter(v => v.chassis_no.toString().toLowerCase().includes(searchQuery.toLowerCase())).length} vehicle(s) matching "{searchQuery}"
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
            <Car className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Available Vehicles</h3>
            <p className="text-slate-600">Start by adding a new vehicle</p>
          </div>
        ) : vehicles.filter(v => v.chassis_no.toString().toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
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
            {vehicles
              .filter(v => v.chassis_no.toString().toLowerCase().includes(searchQuery.toLowerCase()))
              .map((vehicle, index) => (
              <motion.div
                key={vehicle.chassis_no}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`card p-6 hover:shadow-xl transition-all duration-300 ${
                  getMissingRequiredFields(vehicle).length > 0 
                    ? 'border-2 border-red-300 bg-red-50/30' 
                    : ''
                }`}
              >
                <div className="space-y-4 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-slate-800">
                          {vehicle.maker} {vehicle.model}
                        </h3>
                        {showReservedBadge && reservedChassisNos.has(vehicle.chassis_no) && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold border border-green-300">
                            Reserved
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        Chassis: {vehicle.chassis_no}
                      </p>
                      <p className="text-sm text-slate-600">
                        Year: {vehicle.manufacturer_year} | Mileage: {formatNumber(vehicle.mileage)} km
                      </p>
                      {/* Check if invoice has been generated (has engine_no and other invoice fields) */}
                      {/* Note: Database uses 'colour' but TypeScript interface uses 'color' */}
                      {(() => {
                        const vehicleColor = (vehicle as any).colour || vehicle.color
                        // Convert to strings and check if they're non-empty
                        const engineNo = String(vehicle.engine_no || '').trim()
                        const engineCapacity = String(vehicle.engine_capacity || '').trim()
                        const color = String(vehicleColor || '').trim()
                        const fuelType = String(vehicle.fuel_type || '').trim()
                        const seatingCapacity = String(vehicle.seating_capacity || '').trim()
                        
                        return engineNo !== '' &&
                               engineCapacity !== '' &&
                               color !== '' &&
                               fuelType !== '' &&
                               seatingCapacity !== ''
                      })() && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold border border-green-300">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Invoice Generated
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Missing required fields warning */}
                      {(() => {
                        const missingFields = getMissingRequiredFields(vehicle)
                        if (missingFields.length > 0) {
                          return (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg border border-red-200" title={`Missing required fields: ${missingFields.join(', ')}`}>
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-xs font-semibold">Need to fill: {missingFields.join(', ')}</span>
                            </div>
                          )
                        }
                        return null
                      })()}
                      {/* LKR Buy indicator for Sri Lanka purchases */}
                      {isSriLankaPurchase(vehicle) && (
                        <span className="px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200">
                          🇱🇰 LKR Buy
                        </span>
                      )}
                      {/* Japan Flag indicator when no local costs (excluding LC Commission) - only for Japan purchases */}
                      {!isSriLankaPurchase(vehicle) && !hasLocalCostsEntered(vehicle) && (
                        <div className="w-12 h-8 flex items-center justify-center border-2 border-black" title="No local costs entered (excluding LC Commission)">
                          <svg width="32" height="20" viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                            <rect width="32" height="20" fill="#ffffff"/>
                            <circle cx="16" cy="10" r="5" fill="#bc002d"/>
                          </svg>
                        </div>
                      )}
                      {isAdmin(user) && (
                        <button
                          onClick={() => handleDeleteVehicle(vehicle)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200 hover:border-red-300"
                          title="Delete Vehicle"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isAdmin(user) && (
                    <div className="space-y-2 pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Japan Total (LKR):</span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(vehicle.japan_total_lkr || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Local Total (LKR):</span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(calculateLocalTotal(vehicle))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <span className="font-semibold text-slate-700">Combined Total (LKR):</span>
                        <span className="text-lg font-bold text-blue-700">
                          {formatCurrency(calculateCombinedTotal(vehicle))}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-4">
                    <button
                      onClick={() => {
                        setSelectedVehicle(vehicle)
                        setShowEditCosts(true)
                      }}
                      className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Costs
                    </button>
                    <button
                      onClick={() => {
                        setSelectedVehicle(vehicle)
                        setShowAddAdvance(true)
                      }}
                      className="flex-1 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <DollarSign className="w-4 h-4" />
                      Add Advance
                    </button>
                    <button
                      onClick={() => {
                        setSelectedVehicle(vehicle)
                        setShowMarkSold(true)
                      }}
                      className="flex-1 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark Sold
                    </button>
                    {isAdmin(user) && (
                      <button
                        onClick={() => generateCostBreakdownPDF(vehicle)}
                        className="flex-1 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <Printer className="w-4 h-4" />
                        Print Costs
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {selectedVehicle && (
        <>
          <EditLocalCostsModal
            vehicle={selectedVehicle}
            open={showEditCosts}
            onClose={() => {
              setShowEditCosts(false)
              setSelectedVehicle(null)
            }}
            onSave={loadVehicles}
            isAdmin={isAdmin(user)}
          />
          <AddAdvanceModal
            vehicle={selectedVehicle}
            open={showAddAdvance}
            onClose={() => {
              setShowAddAdvance(false)
              setSelectedVehicle(null)
            }}
            onSave={loadVehicles}
          />
          <MarkSoldModal
            vehicle={selectedVehicle}
            user={user}
            open={showMarkSold}
            onClose={() => {
              setShowMarkSold(false)
              setSelectedVehicle(null)
            }}
            onSave={() => {
              router.push('/sold')
            }}
          />
        </>
      )}

    </>
  )
}

