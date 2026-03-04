'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Search, Printer, Trash2, List } from 'lucide-react'
import jsPDF from 'jspdf'

interface Vehicle {
  chassis_no: string
  maker: string
  model: string
  status: 'available' | 'sold'
  final_total_lkr: number | null
  japan_total_lkr: number | null
  undial_amount_jpy: number | null
  undial_jpy_to_lkr_rate: number | null
  tax_lkr: number | null
  clearance_lkr: number | null
  transport_lkr: number | null
  local_extra1_lkr: number | null
  local_extra2_lkr: number | null
  local_extra3_lkr: number | null
}

interface TaxDetail {
  id: string
  chassis_no: string
  total_cost_lkr: number
  undial_amount_lkr: number
  total_cost_without_undial: number
  expected_profit: number
  cost_with_profit: number
  sscl: number
  cost_with_profit_sscl: number
  vat_to_be_paid: number
  paid_vat: number
  vat_difference: number
  sold_price: number
}

interface TaxViewProps {
  user: User
}

export default function TaxView({ user }: TaxViewProps) {
  const [searchChassis, setSearchChassis] = useState('')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [taxDetail, setTaxDetail] = useState<TaxDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingAvailable, setLoadingAvailable] = useState(false)

  // Tax calculation fields
  const [totalCostLkr, setTotalCostLkr] = useState('')
  const [undialAmountLkr, setUndialAmountLkr] = useState('')
  const [totalCostWithoutUndial, setTotalCostWithoutUndial] = useState('')
  const [expectedProfit, setExpectedProfit] = useState('')
  const [paidVat, setPaidVat] = useState('')

  // Calculated values
  const [costWithProfit, setCostWithProfit] = useState(0)
  const [sscl, setSscl] = useState(0)
  const [costWithProfitSscl, setCostWithProfitSscl] = useState(0)
  const [vatToBePaid, setVatToBePaid] = useState(0)
  const [vatDifference, setVatDifference] = useState(0)
  const [soldPrice, setSoldPrice] = useState(0)

  useEffect(() => {
    if (totalCostWithoutUndial && expectedProfit) {
      // Round all values to whole numbers (no cents)
      const costWithProfitVal = Math.round(parseFloat(totalCostWithoutUndial) + parseFloat(expectedProfit))
      setCostWithProfit(costWithProfitVal)

      const ssclVal = Math.round(costWithProfitVal * 0.0125)
      setSscl(ssclVal)

      const costWithProfitSsclVal = Math.round(costWithProfitVal + ssclVal)
      setCostWithProfitSscl(costWithProfitSsclVal)

      const vatToBePaidVal = Math.round((costWithProfitSsclVal * 18) / 118)
      setVatToBePaid(vatToBePaidVal)

      const paidVatVal = Math.round(parseFloat(paidVat) || 0)
      const vatDiffVal = Math.round(vatToBePaidVal - paidVatVal)
      setVatDifference(vatDiffVal)

      const soldPriceVal = Math.round(costWithProfitSsclVal + vatDiffVal)
      setSoldPrice(soldPriceVal)
    }
  }, [totalCostWithoutUndial, expectedProfit, paidVat])

  async function searchVehicles() {
    if (!searchChassis.trim()) {
      alert('Please enter a chassis number')
      return
    }

    setLoading(true)
    try {
      // Search both available and sold vehicles
      const { data, error } = await supabase
        .from('vehicles')
        .select('chassis_no, maker, model, status, final_total_lkr, japan_total_lkr, undial_amount_jpy, undial_jpy_to_lkr_rate, tax_lkr, clearance_lkr, transport_lkr, local_extra1_lkr, local_extra2_lkr, local_extra3_lkr')
        .ilike('chassis_no', `%${searchChassis.trim()}%`)

      if (error) throw error

      // Check which vehicles have tax details
      const chassisNos = (data || []).map(v => v.chassis_no)
      const { data: taxDetails } = await supabase
        .from('tax_details')
        .select('chassis_no')
        .in('chassis_no', chassisNos)

      const taxChassisNos = new Set(taxDetails?.map(t => t.chassis_no) || [])

      // Mark vehicles with tax details
      const vehiclesWithTaxStatus = (data || []).map(v => ({
        ...v,
        hasTaxDetail: taxChassisNos.has(v.chassis_no)
      }))

      setVehicles(vehiclesWithTaxStatus as any)
    } catch (error: any) {
      console.error('Error searching vehicles:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadAvailableVehicles() {
    setLoadingAvailable(true)
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('chassis_no, maker, model, status, final_total_lkr, japan_total_lkr, undial_amount_jpy, undial_jpy_to_lkr_rate, tax_lkr, clearance_lkr, transport_lkr, local_extra1_lkr, local_extra2_lkr, local_extra3_lkr')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const chassisNos = (data || []).map(v => v.chassis_no)
      const { data: taxDetails } = await supabase
        .from('tax_details')
        .select('chassis_no')
        .in('chassis_no', chassisNos)

      const taxChassisNos = new Set(taxDetails?.map(t => t.chassis_no) || [])
      const vehiclesWithTaxStatus = (data || []).map(v => ({
        ...v,
        hasTaxDetail: taxChassisNos.has(v.chassis_no)
      }))

      setVehicles(vehiclesWithTaxStatus as any)
    } catch (error: any) {
      console.error('Error loading available vehicles:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoadingAvailable(false)
    }
  }

  async function selectVehicle(vehicle: Vehicle) {
    setSelectedVehicle(vehicle)

    // Calculate total cost (japan_total + local costs)
    const japanTotal = vehicle.japan_total_lkr || 0
    const localTotal = (vehicle.tax_lkr || 0) + 
                      (vehicle.clearance_lkr || 0) + 
                      (vehicle.transport_lkr || 0) + 
                      (vehicle.local_extra1_lkr || 0) + 
                      (vehicle.local_extra2_lkr || 0) + 
                      (vehicle.local_extra3_lkr || 0)
    const totalCost = vehicle.final_total_lkr || (japanTotal + localTotal)

    // Calculate undial amount in LKR
    const undialLkr = vehicle.undial_amount_jpy && vehicle.undial_jpy_to_lkr_rate
      ? vehicle.undial_amount_jpy * vehicle.undial_jpy_to_lkr_rate
      : 0

    setTotalCostLkr(totalCost.toString())
    setUndialAmountLkr(undialLkr.toString())
    
    const costWithoutUndial = totalCost - undialLkr
    setTotalCostWithoutUndial(costWithoutUndial.toString())

    // Load existing tax details if any
    const { data: existingTax } = await supabase
      .from('tax_details')
      .select('*')
      .eq('chassis_no', vehicle.chassis_no)
      .maybeSingle()

    if (existingTax) {
      setTaxDetail(existingTax)
      setExpectedProfit(existingTax.expected_profit.toString())
      setPaidVat(existingTax.paid_vat.toString())
    } else {
      setTaxDetail(null)
      setExpectedProfit('')
      setPaidVat('')
    }
  }

  async function saveTaxDetails() {
    if (!selectedVehicle || !totalCostWithoutUndial || !expectedProfit) {
      alert('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const taxData = {
        chassis_no: selectedVehicle.chassis_no,
        total_cost_lkr: parseFloat(totalCostLkr),
        undial_amount_lkr: parseFloat(undialAmountLkr),
        total_cost_without_undial: parseFloat(totalCostWithoutUndial),
        expected_profit: parseFloat(expectedProfit),
        cost_with_profit: costWithProfit,
        sscl: sscl,
        cost_with_profit_sscl: costWithProfitSscl,
        vat_to_be_paid: vatToBePaid,
        paid_vat: parseFloat(paidVat) || 0,
        vat_difference: vatDifference,
        sold_price: soldPrice,
      }

      const { error } = await supabase
        .from('tax_details')
        .upsert(taxData, { onConflict: 'chassis_no' })

      if (error) throw error

      setTaxDetail(taxData as any)
      // Reload to update hasTaxDetail status
      await searchVehicles()
      alert('Tax details saved successfully!')
    } catch (error: any) {
      console.error('Error saving tax details:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function deleteTaxDetails() {
    if (!selectedVehicle || !confirm('Are you sure you want to delete tax details for this vehicle?')) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('tax_details')
        .delete()
        .eq('chassis_no', selectedVehicle.chassis_no)

      if (error) throw error

      setTaxDetail(null)
      setExpectedProfit('')
      setPaidVat('')
      await searchVehicles()
      alert('Tax details deleted successfully!')
    } catch (error: any) {
      console.error('Error deleting tax details:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function printTaxInvoice() {
    if (!selectedVehicle || !taxDetail) {
      alert('Please save tax details before printing')
      return
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Title only
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('Tax Payment', 105, 30, { align: 'center' })

      // Line separator
      pdf.line(20, 35, 190, 35)

      // Vehicle Details
      let currentY = 45
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text(`${selectedVehicle.maker} ${selectedVehicle.model}`, 20, currentY)
      currentY += 6
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Chassis No: ${selectedVehicle.chassis_no}`, 20, currentY)
      currentY += 10

      // Line separator
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Calculations
      const labelStartX = 20
      const colonX = 130
      const valueStartX = 135

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)

      pdf.text('Total Cost (LKR)', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(Math.round(parseFloat(totalCostLkr))), valueStartX, currentY)
      currentY += 6

      pdf.text('Undial Amount (LKR)', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(Math.round(parseFloat(undialAmountLkr))), valueStartX, currentY)
      currentY += 6

      pdf.text('Total Cost Without Undial', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(Math.round(parseFloat(totalCostWithoutUndial))), valueStartX, currentY)
      currentY += 6

      pdf.text('Expected Profit', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(Math.round(parseFloat(expectedProfit))), valueStartX, currentY)
      currentY += 6

      pdf.text('Cost with Profit', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(costWithProfit), valueStartX, currentY)
      currentY += 6

      pdf.text('SSCL (1.25%)', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(sscl), valueStartX, currentY)
      currentY += 6

      pdf.text('Cost with Profit + SSCL', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(costWithProfitSscl), valueStartX, currentY)
      currentY += 6

      pdf.text('VAT to be Paid (18/118)', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(vatToBePaid), valueStartX, currentY)
      currentY += 6

      pdf.text('Paid VAT', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(Math.round(parseFloat(paidVat) || 0)), valueStartX, currentY)
      currentY += 6

      pdf.text('VAT Difference', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(vatDifference), valueStartX, currentY)
      currentY += 8

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Sold Price', labelStartX, currentY)
      pdf.text(':', colonX, currentY)
      pdf.text(formatCurrency(soldPrice), valueStartX, currentY)
      currentY += 20

      // Authorized Signature at bottom
      const pageHeight = pdf.internal.pageSize.getHeight()
      currentY = pageHeight - 30
      
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('..............................', 20, currentY)
      currentY += 8
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Authorized Signature', 20, currentY)

      // Save PDF
      pdf.save(`Tax-Invoice-${selectedVehicle.chassis_no}-${Date.now()}.pdf`)
    } catch (error: any) {
      console.error('Error generating tax invoice:', error)
      alert(`Error generating PDF: ${error.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-stone-900">Tax</h1>

      {/* Search */}
      <div className="card p-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="label">Search by Chassis Number</label>
            <input
              type="text"
              value={searchChassis}
              onChange={(e) => setSearchChassis(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchVehicles()}
              className="input-field"
              placeholder="Enter chassis number"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={searchVehicles}
              disabled={loading}
              className="btn-primary flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadAvailableVehicles}
              disabled={loadingAvailable}
              className="btn-secondary flex items-center gap-2"
              title="Show available vehicles"
            >
              <List className="w-4 h-4" />
              {loadingAvailable ? 'Loading...' : 'Available'}
            </button>
          </div>
        </div>

        {/* Search Results */}
        {vehicles.length > 0 && (
          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.chassis_no}
                onClick={() => selectVehicle(vehicle)}
                className={`p-3 border rounded-lg cursor-pointer hover:bg-stone-50 transition-colors ${
                  selectedVehicle?.chassis_no === vehicle.chassis_no ? 'border-amber-500 bg-amber-50' : 'border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{vehicle.maker} {vehicle.model}</p>
                    <p className="text-sm text-stone-600">Chassis: {vehicle.chassis_no}</p>
                    <p className="text-sm text-stone-600">Status: {vehicle.status === 'available' ? 'Available' : 'Sold'}</p>
                  </div>
                  {(vehicle as any).hasTaxDetail && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Tax invoice was generated</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tax Calculation Form */}
      {selectedVehicle && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 space-y-4"
        >
          <h3 className="text-xl font-bold text-stone-800">
            {selectedVehicle.maker} {selectedVehicle.model} - {selectedVehicle.chassis_no}
          </h3>

          {/* Read-only fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Total Cost (LKR)</label>
              <input
                type="number"
                step="0.01"
                value={totalCostLkr}
                readOnly
                className="input-field bg-stone-100"
              />
            </div>
            <div>
              <label className="label">Undial Amount (LKR)</label>
              <input
                type="number"
                step="0.01"
                value={undialAmountLkr}
                readOnly
                className="input-field bg-stone-100"
              />
            </div>
            <div>
              <label className="label">Total Cost Without Undial</label>
              <input
                type="number"
                step="0.01"
                value={totalCostWithoutUndial}
                readOnly
                className="input-field bg-stone-100"
              />
            </div>
          </div>

          {/* Input fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Expected Profit *</label>
              <input
                type="number"
                step="0.01"
                value={expectedProfit}
                onChange={(e) => setExpectedProfit(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Paid VAT</label>
              <input
                type="number"
                step="0.01"
                value={paidVat}
                onChange={(e) => setPaidVat(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Calculated values */}
          <div className="mt-4 p-4 bg-stone-50 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Cost with Profit:</span>
              <span className="font-semibold">{formatCurrency(costWithProfit)}</span>
            </div>
            <div className="flex justify-between">
              <span>SSCL (1.25%):</span>
              <span className="font-semibold">{formatCurrency(sscl)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cost with Profit + SSCL:</span>
              <span className="font-semibold">{formatCurrency(costWithProfitSscl)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT to be Paid (18/118):</span>
              <span className="font-semibold">{formatCurrency(vatToBePaid)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT Difference:</span>
              <span className="font-semibold">{formatCurrency(vatDifference)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-stone-300">
              <span className="font-bold">Sold Price:</span>
              <span className="font-bold text-lg text-amber-700">{formatCurrency(soldPrice)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={saveTaxDetails}
              disabled={loading || !expectedProfit}
              className="btn-primary"
            >
              Save Tax Details
            </button>
            {taxDetail && (
              <>
                <button
                  onClick={printTaxInvoice}
                  className="btn-primary flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Again
                </button>
                <button
                  onClick={deleteTaxDetails}
                  disabled={loading}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Tax Details
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
