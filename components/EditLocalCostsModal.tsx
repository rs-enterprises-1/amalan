'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Vehicle } from '@/lib/database.types'
import { formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface EditLocalCostsModalProps {
  vehicle: Vehicle
  open: boolean
  onClose: () => void
  onSave: () => void
  isAdmin?: boolean
}

export default function EditLocalCostsModal({
  vehicle,
  open,
  onClose,
  onSave,
  isAdmin = true,
}: EditLocalCostsModalProps) {
  // Detect if this is a Sri Lanka purchase
  const isSriLankaPurchase = (() => {
    const hasNoJapanCosts = !vehicle.bid_jpy && !vehicle.commission_jpy && !vehicle.insurance_jpy && 
                             !vehicle.inland_transport_jpy && !vehicle.other_jpy
    const rateIsOne = vehicle.invoice_jpy_to_lkr_rate === 1 || vehicle.invoice_jpy_to_lkr_rate === null
    return hasNoJapanCosts && rateIsOne
  })()

  const [lcCommission, setLcCommission] = useState('')
  const [lcCommissionAutoCalculated, setLcCommissionAutoCalculated] = useState(true)
  const [lcCharges, setLcCharges] = useState(() => {
    if (vehicle.lc_charges_lkr) {
      return vehicle.lc_charges_lkr.toString()
    } else if (vehicle.local_extra2_lkr) {
      const extra2LabelUpper = (vehicle.local_extra2_label || '').toUpperCase().trim()
      const isLcCharges = 
        extra2LabelUpper === 'LC CHARGES' ||
        extra2LabelUpper === 'L/C CHGS' ||
        extra2LabelUpper === 'LC CHGS' ||
        extra2LabelUpper === 'L.C. CHGS' ||
        (extra2LabelUpper.includes('LC') && extra2LabelUpper.includes('CHARGES')) ||
        (extra2LabelUpper.includes('L/C') && extra2LabelUpper.includes('CHGS')) ||
        (extra2LabelUpper.includes('L.C.') && extra2LabelUpper.includes('CHGS'))
      
      if (isLcCharges) {
        return vehicle.local_extra2_lkr.toString()
      }
    }
    return ''
  })
  const [tax, setTax] = useState(vehicle.tax_lkr?.toString() || '')
  const [clearance, setClearance] = useState(vehicle.clearance_lkr?.toString() || '')
  const [transport, setTransport] = useState(vehicle.transport_lkr?.toString() || '')
  const [extra1Label, setExtra1Label] = useState(vehicle.local_extra1_label || '')
  const [extra1Amount, setExtra1Amount] = useState(vehicle.local_extra1_lkr?.toString() || '')
  const [extra2Label, setExtra2Label] = useState(vehicle.local_extra2_label || '')
  const [extra2Amount, setExtra2Amount] = useState(vehicle.local_extra2_lkr?.toString() || '')
  const [extra3Label, setExtra3Label] = useState(vehicle.local_extra3_label || '')
  const [extra3Amount, setExtra3Amount] = useState(vehicle.local_extra3_lkr?.toString() || '')
  const [extra4Label, setExtra4Label] = useState(vehicle.local_extra4_label || '')
  const [extra4Amount, setExtra4Amount] = useState(vehicle.local_extra4_lkr?.toString() || '')
  const [extra5Label, setExtra5Label] = useState(vehicle.local_extra5_label || '')
  const [extra5Amount, setExtra5Amount] = useState(vehicle.local_extra5_lkr?.toString() || '')
  const [loading, setLoading] = useState(false)

  const base = vehicle.japan_total_lkr || 0

  // Calculate invoice LKR value
  const invoiceLkrValue = (vehicle.invoice_amount_jpy || 0) * (vehicle.invoice_jpy_to_lkr_rate || 0)

  // Auto-calculate LC Commission on mount and when invoice values change
  useEffect(() => {
    if (lcCommissionAutoCalculated) {
      const calculated = invoiceLkrValue * 0.0035
      // Round to whole number (remove cents)
      const rounded = Math.round(calculated)
      setLcCommission(rounded > 0 ? rounded.toString() : '')
    }
  }, [invoiceLkrValue, lcCommissionAutoCalculated])

  // Load existing LC Commission from local_extra1 if it's labeled as LC Commission
  useEffect(() => {
    if (vehicle.local_extra1_label === 'LC Commission' || vehicle.local_extra1_label === '') {
      if (vehicle.local_extra1_lkr) {
        // Round to whole number (remove cents)
        const rounded = Math.round(vehicle.local_extra1_lkr)
        setLcCommission(rounded.toString())
        setLcCommissionAutoCalculated(false)
      }
    }
    // Load LC Charges from lc_charges_lkr field (new) or from local_extra2 (old, for backward compatibility)
    // Also check for variations like "L/C CHGS", "LC CHGS", etc.
    if (vehicle.lc_charges_lkr) {
      setLcCharges(vehicle.lc_charges_lkr.toString())
    } else if (vehicle.local_extra2_lkr) {
      const extra2LabelUpper = (vehicle.local_extra2_label || '').toUpperCase().trim()
      const isLcCharges = 
        extra2LabelUpper === 'LC CHARGES' ||
        extra2LabelUpper === 'L/C CHGS' ||
        extra2LabelUpper === 'LC CHGS' ||
        extra2LabelUpper === 'L.C. CHGS' ||
        extra2LabelUpper.includes('LC') && extra2LabelUpper.includes('CHARGES') ||
        extra2LabelUpper.includes('L/C') && extra2LabelUpper.includes('CHGS') ||
        extra2LabelUpper.includes('L.C.') && extra2LabelUpper.includes('CHGS')
      
      if (isLcCharges) {
        // Legacy: Load from old location
        setLcCharges(vehicle.local_extra2_lkr.toString())
      }
    }
  }, [vehicle.local_extra1_label, vehicle.local_extra1_lkr, vehicle.local_extra2_label, vehicle.local_extra2_lkr])

  function calculateRunningTotal(field: string): number {
    let total = base
    
    if (isSriLankaPurchase) {
      // For Sri Lanka purchases, only include Extra 1, 2, 3
      const extra3Val = parseFloat(extra3Amount) || 0
      const extra4Val = parseFloat(extra4Amount) || 0
      const extra5Val = parseFloat(extra5Amount) || 0

      if (field === 'extra3') {
        total += extra3Val
      } else if (field === 'extra4') {
        total += extra3Val + extra4Val
      } else if (field === 'extra5') {
        total += extra3Val + extra4Val + extra5Val
      }
      return total
    }
    
    // For Japan purchases (existing logic)
    // Round LC Commission to whole number (remove cents)
    const lcComm = Math.round(parseFloat(lcCommission) || 0)
    const lcChargesVal = parseFloat(lcCharges) || 0
    const taxVal = parseFloat(tax) || 0
    const clearanceVal = parseFloat(clearance) || 0
    const transportVal = parseFloat(transport) || 0
    // Only include extra1 if it's NOT being used for LC Commission
    const extra1Val = (extra1Label && extra1Label !== 'LC Commission') ? (parseFloat(extra1Amount) || 0) : 0
    // Only include extra2 if it's NOT being used for LC Charges
    const extra2Val = (extra2Label && extra2Label !== 'LC Charges') ? (parseFloat(extra2Amount) || 0) : 0
    const extra3Val = parseFloat(extra3Amount) || 0
    const extra4Val = parseFloat(extra4Amount) || 0
    const extra5Val = parseFloat(extra5Amount) || 0

    if (field === 'lcCommission') {
      total += lcComm
    } else if (field === 'lcCharges') {
      total += lcComm + lcChargesVal
    } else if (field === 'tax') {
      total += lcComm + lcChargesVal + taxVal
    } else if (field === 'clearance') {
      total += lcComm + lcChargesVal + taxVal + clearanceVal
    } else if (field === 'transport') {
      total += lcComm + lcChargesVal + taxVal + clearanceVal + transportVal
    } else if (field === 'extra1') {
      total += lcComm + lcChargesVal + taxVal + clearanceVal + transportVal + extra1Val
    } else if (field === 'extra2') {
      total += lcComm + lcChargesVal + taxVal + clearanceVal + transportVal + extra1Val + extra2Val
    } else if (field === 'extra3') {
      total += lcComm + lcChargesVal + taxVal + clearanceVal + transportVal + extra1Val + extra2Val + extra3Val
    } else if (field === 'extra4') {
      total += lcComm + lcChargesVal + taxVal + clearanceVal + transportVal + extra1Val + extra2Val + extra3Val + extra4Val
    } else if (field === 'extra5') {
      total += lcComm + lcChargesVal + taxVal + clearanceVal + transportVal + extra1Val + extra2Val + extra3Val + extra4Val + extra5Val
    }
    return total
  }

  async function handleSave() {
    setLoading(true)
    try {
      // Verify user is logged in
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('You must be logged in to save costs')
        return
      }

      let localTotal: number
      let finalTotal: number
      let updateData: any
      let oldExtra3: number
      let oldExtra4: number
      let oldExtra5: number
      let newExtra3: number
      let newExtra4: number
      let newExtra5: number

      if (isSriLankaPurchase) {
        // For Sri Lanka purchases, only calculate Extra 1, 2, 3
        localTotal = 
          (parseFloat(extra3Amount) || 0) +
          (parseFloat(extra4Amount) || 0) +
          (parseFloat(extra5Amount) || 0)
        finalTotal = base + localTotal

        oldExtra3 = vehicle.local_extra3_lkr || 0
        oldExtra4 = vehicle.local_extra4_lkr || 0
        oldExtra5 = vehicle.local_extra5_lkr || 0

        newExtra3 = parseFloat(extra3Amount) || 0
        newExtra4 = parseFloat(extra4Amount) || 0
        newExtra5 = parseFloat(extra5Amount) || 0

        updateData = {
          tax_lkr: null,
          clearance_lkr: null,
          transport_lkr: null,
          lc_charges_lkr: null,
          local_extra1_label: null,
          local_extra1_lkr: null,
          local_extra2_label: null,
          local_extra2_lkr: null,
          local_extra3_label: extra3Label || null,
          local_extra3_lkr: parseFloat(extra3Amount) || null,
          local_extra4_label: extra4Label || null,
          local_extra4_lkr: parseFloat(extra4Amount) || null,
          local_extra5_label: extra5Label || null,
          local_extra5_lkr: parseFloat(extra5Amount) || null,
          final_total_lkr: finalTotal,
        }
      } else {
        // For Japan purchases (existing logic)
        // Calculate local total - don't double-count LC Commission if it's in extra1
        // Round LC Commission to whole number (remove cents)
        const lcCommVal = Math.round(parseFloat(lcCommission) || 0)
        const lcChargesVal = parseFloat(lcCharges) || 0
        const extra1Val = (extra1Label && extra1Label !== 'LC Commission') ? (parseFloat(extra1Amount) || 0) : 0
        const extra2Val = (extra2Label && extra2Label !== 'LC Charges') ? (parseFloat(extra2Amount) || 0) : 0
        
        localTotal = 
          lcCommVal +
          lcChargesVal +
          (parseFloat(tax) || 0) +
          (parseFloat(clearance) || 0) +
          (parseFloat(transport) || 0) +
          extra1Val +
          extra2Val +
          (parseFloat(extra3Amount) || 0) +
          (parseFloat(extra4Amount) || 0) +
          (parseFloat(extra5Amount) || 0)

        finalTotal = base + localTotal

        // Save LC Commission to local_extra1 if it's empty or already labeled as LC Commission
        // Check original vehicle value, not state (in case user hasn't changed it)
        const originalExtra1Label = vehicle.local_extra1_label || ''
        const shouldSaveLcCommission = !originalExtra1Label || originalExtra1Label === 'LC Commission'
        // Round LC Commission to whole number (remove cents)
        const lcCommValue = Math.round(parseFloat(lcCommission) || 0)

        // Save LC Charges to dedicated lc_charges_lkr field
        // Also clear old LC Charges from local_extra2 if it exists there
        const originalExtra2Label = vehicle.local_extra2_label || ''
        const originalExtra2LabelUpper = originalExtra2Label.toUpperCase().trim()
        const shouldClearOldLcCharges = 
          originalExtra2LabelUpper === 'LC CHARGES' ||
          originalExtra2LabelUpper === 'L/C CHGS' ||
          originalExtra2LabelUpper === 'LC CHGS' ||
          originalExtra2LabelUpper === 'L.C. CHGS' ||
          (originalExtra2LabelUpper.includes('LC') && originalExtra2LabelUpper.includes('CHARGES')) ||
          (originalExtra2LabelUpper.includes('L/C') && originalExtra2LabelUpper.includes('CHGS')) ||
          (originalExtra2LabelUpper.includes('L.C.') && originalExtra2LabelUpper.includes('CHGS'))
        const lcChargesValue = parseFloat(lcCharges) || 0

        // Get old values for comparison
        const oldTax = vehicle.tax_lkr || 0
        const oldClearance = vehicle.clearance_lkr || 0
        const oldTransport = vehicle.transport_lkr || 0
        // Check if local_extra2 contains LC Charges (with variations)
        const extra2LabelUpper = (vehicle.local_extra2_label || '').toUpperCase().trim()
        const isLcChargesInExtra2 = 
          extra2LabelUpper === 'LC CHARGES' ||
          extra2LabelUpper === 'L/C CHGS' ||
          extra2LabelUpper === 'LC CHGS' ||
          extra2LabelUpper === 'L.C. CHGS' ||
          (extra2LabelUpper.includes('LC') && extra2LabelUpper.includes('CHARGES')) ||
          (extra2LabelUpper.includes('L/C') && extra2LabelUpper.includes('CHGS')) ||
          (extra2LabelUpper.includes('L.C.') && extra2LabelUpper.includes('CHGS'))
        
        const oldLcCharges = vehicle.lc_charges_lkr || (isLcChargesInExtra2 ? (vehicle.local_extra2_lkr || 0) : 0)
        const oldExtra1 = (vehicle.local_extra1_label && vehicle.local_extra1_label !== 'LC Commission') ? (vehicle.local_extra1_lkr || 0) : 0
        const oldExtra2 = (vehicle.local_extra2_label && !isLcChargesInExtra2) ? (vehicle.local_extra2_lkr || 0) : 0
        oldExtra3 = vehicle.local_extra3_lkr || 0
        oldExtra4 = vehicle.local_extra4_lkr || 0
        oldExtra5 = vehicle.local_extra5_lkr || 0

        // Get new values
        const newTax = parseFloat(tax) || 0
        const newClearance = parseFloat(clearance) || 0
        const newTransport = parseFloat(transport) || 0
        const newLcCharges = lcChargesValue
        const newExtra1 = extra1Val
        const newExtra2 = extra2Val
        newExtra3 = parseFloat(extra3Amount) || 0
        newExtra4 = parseFloat(extra4Amount) || 0
        newExtra5 = parseFloat(extra5Amount) || 0

        updateData = {
          tax_lkr: newTax || null,
          clearance_lkr: newClearance || null,
          transport_lkr: newTransport || null,
          lc_charges_lkr: lcChargesValue > 0 ? lcChargesValue : null,
          local_extra1_label: shouldSaveLcCommission ? 'LC Commission' : (extra1Label || null),
          local_extra1_lkr: shouldSaveLcCommission ? (lcCommValue > 0 ? lcCommValue : null) : (parseFloat(extra1Amount) || null),
          local_extra2_label: extra2Label || null,
          local_extra2_lkr: parseFloat(extra2Amount) || null,
          local_extra3_label: extra3Label || null,
          local_extra3_lkr: parseFloat(extra3Amount) || null,
          local_extra4_label: extra4Label || null,
          local_extra4_lkr: parseFloat(extra4Amount) || null,
          local_extra5_label: extra5Label || null,
          local_extra5_lkr: parseFloat(extra5Amount) || null,
          final_total_lkr: finalTotal,
        }

        // Clear old LC Charges from local_extra2 if it was there
        if (shouldClearOldLcCharges) {
          updateData.local_extra2_label = null
          updateData.local_extra2_lkr = null
        }
      }

      const { error } = await supabase
        .from('vehicles')
        .update(updateData)
        .eq('chassis_no', vehicle.chassis_no)

      if (error) throw error

      onSave()
      onClose()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
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
                <h2 className="text-2xl font-bold text-slate-800">Edit Local Costs</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {isAdmin && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm text-blue-700 mb-1">Base (Japan Total LKR):</div>
                    <div className="text-2xl font-bold text-blue-900">{formatCurrency(base)}</div>
                  </div>
                )}

                {!isSriLankaPurchase && (
                  <>
                    <div>
                      <label className="label">LC Commission (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={lcCommission}
                        onChange={(e) => {
                          setLcCommission(e.target.value)
                          setLcCommissionAutoCalculated(false)
                        }}
                        onFocus={() => {
                          // Allow manual editing
                          setLcCommissionAutoCalculated(false)
                        }}
                        className="input-field"
                        placeholder="Auto-calculated: Invoice LKR × 0.0035 (rounded to whole number)"
                      />
                      {isAdmin && (
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="font-semibold">TOTAL + LC Commission = </span>
                          <span className="text-lg font-bold text-blue-700">
                            {formatCurrency(calculateRunningTotal('lcCommission'))}
                          </span>
                        </div>
                      )}
                      {lcCommissionAutoCalculated && (
                        <p className="mt-1 text-xs text-slate-500">
                          Auto-calculated: {formatCurrency(invoiceLkrValue)} × 0.0035 = {formatCurrency(Math.round(invoiceLkrValue * 0.0035))} (rounded)
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="label">LC Charges (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={lcCharges}
                        onChange={(e) => setLcCharges(e.target.value)}
                        className="input-field"
                        placeholder="Enter LC charges amount"
                      />
                      {isAdmin && (
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="font-semibold">TOTAL + LC Commission + LC Charges = </span>
                          <span className="text-lg font-bold text-blue-700">
                            {formatCurrency(calculateRunningTotal('lcCharges'))}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="label">Tax (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={tax}
                        onChange={(e) => setTax(e.target.value)}
                        className="input-field"
                        placeholder="Enter tax amount"
                      />
                      {isAdmin && (
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="font-semibold">TOTAL + LC Commission + LC Charges + Tax = </span>
                          <span className="text-lg font-bold text-blue-700">
                            {formatCurrency(calculateRunningTotal('tax'))}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="label">Clearance (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={clearance}
                        onChange={(e) => setClearance(e.target.value)}
                        className="input-field"
                        placeholder="Enter clearance amount"
                      />
                      {isAdmin && (
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="font-semibold">TOTAL = </span>
                          <span className="text-lg font-bold text-blue-700">
                            {formatCurrency(calculateRunningTotal('clearance'))}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="label">Transport (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={transport}
                        onChange={(e) => setTransport(e.target.value)}
                        className="input-field"
                        placeholder="Enter transport amount"
                      />
                      {isAdmin && (
                        <div className="mt-2 text-sm text-slate-600">
                          <span className="font-semibold">TOTAL = </span>
                          <span className="text-lg font-bold text-blue-700">
                            {formatCurrency(calculateRunningTotal('transport'))}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Only show Extra Cost 1 if it's not being used for LC Commission */}
                    {extra1Label && extra1Label !== 'LC Commission' && extra1Label !== 'LC Charges' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">Extra Cost 1 - Name</label>
                          <input
                            type="text"
                            value={extra1Label}
                            onChange={(e) => setExtra1Label(e.target.value)}
                            className="input-field"
                            placeholder="Custom name"
                          />
                        </div>
                        <div>
                          <label className="label">Extra Cost 1 - Amount (LKR)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={extra1Amount}
                            onChange={(e) => setExtra1Amount(e.target.value)}
                            className="input-field"
                            placeholder="Enter amount"
                          />
                          {isAdmin && (
                            <div className="mt-2 text-sm text-slate-600">
                              <span className="font-semibold">TOTAL = </span>
                              <span className="text-lg font-bold text-blue-700">
                                {formatCurrency(calculateRunningTotal('extra1'))}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Only show Extra Cost 2 if it's not being used for LC Charges */}
                    {extra2Label && extra2Label !== 'LC Charges' && extra2Label !== 'LC Commission' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">Extra Cost 2 - Name</label>
                          <input
                            type="text"
                            value={extra2Label}
                            onChange={(e) => setExtra2Label(e.target.value)}
                            className="input-field"
                            placeholder="Custom name"
                          />
                        </div>
                        <div>
                          <label className="label">Extra Cost 2 - Amount (LKR)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={extra2Amount}
                            onChange={(e) => setExtra2Amount(e.target.value)}
                            className="input-field"
                            placeholder="Enter amount"
                          />
                          {isAdmin && (
                            <div className="mt-2 text-sm text-slate-600">
                              <span className="font-semibold">TOTAL = </span>
                              <span className="text-lg font-bold text-blue-700">
                                {formatCurrency(calculateRunningTotal('extra2'))}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Extra 1 - Name</label>
                    <input
                      type="text"
                      value={extra3Label}
                      onChange={(e) => setExtra3Label(e.target.value)}
                      className="input-field"
                      placeholder="Custom name"
                    />
                  </div>
                  <div>
                    <label className="label">Extra 1 - Amount (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={extra3Amount}
                      onChange={(e) => setExtra3Amount(e.target.value)}
                      className="input-field"
                      placeholder="Enter amount"
                    />
                    {isAdmin && (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-semibold">TOTAL = </span>
                        <span className="text-lg font-bold text-blue-700">
                          {formatCurrency(calculateRunningTotal('extra3'))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Extra 2 - Name</label>
                    <input
                      type="text"
                      value={extra4Label}
                      onChange={(e) => setExtra4Label(e.target.value)}
                      className="input-field"
                      placeholder="Custom name"
                    />
                  </div>
                  <div>
                    <label className="label">Extra 2 - Amount (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={extra4Amount}
                      onChange={(e) => setExtra4Amount(e.target.value)}
                      className="input-field"
                      placeholder="Enter amount"
                    />
                    {isAdmin && (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-semibold">TOTAL = </span>
                        <span className="text-lg font-bold text-blue-700">
                          {formatCurrency(calculateRunningTotal('extra4'))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Extra 3 - Name</label>
                    <input
                      type="text"
                      value={extra5Label}
                      onChange={(e) => setExtra5Label(e.target.value)}
                      className="input-field"
                      placeholder="Custom name"
                    />
                  </div>
                  <div>
                    <label className="label">Extra 3 - Amount (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={extra5Amount}
                      onChange={(e) => setExtra5Amount(e.target.value)}
                      className="input-field"
                      placeholder="Enter amount"
                    />
                    {isAdmin && (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-semibold">TOTAL = </span>
                        <span className="text-lg font-bold text-blue-700">
                          {formatCurrency(calculateRunningTotal('extra5'))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-4 border-t border-slate-200">
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">Final Combined Total (LKR):</span>
                        <span className="text-2xl font-bold text-green-700">
                          {formatCurrency(calculateRunningTotal('extra5'))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}


