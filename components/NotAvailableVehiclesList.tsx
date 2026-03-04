'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { Vehicle } from '@/lib/database.types'
import { fetchJPYToLKRRate, formatCurrency, formatNumber } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Edit, Search, FileText } from 'lucide-react'
import jsPDF from 'jspdf'

interface NotAvailableVehiclesListProps {
  user: User
}

type EditState = {
  bidJpy: string
  commissionJpy: string
  insuranceJpy: string
  inlandTransportJpy: string
  otherJpy: string
  otherLabel: string
  invoiceAmountJpy: string
  invoiceRate: string
  undialAmountJpy: string
  undialRate: string
  hasBank: boolean
  bankName: string
  bankAccNo: string
  bankDate: string
}

export default function NotAvailableVehiclesList({ user }: NotAvailableVehiclesListProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [edit, setEdit] = useState<EditState | null>(null)

  useEffect(() => {
    loadVehicles()
  }, [])

  async function loadVehicles() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'not_available')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading not available vehicles:', error)
      setVehicles([])
      setLoading(false)
      return
    }

    setVehicles(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return vehicles
    return vehicles.filter(v =>
      (v.chassis_no || '').toLowerCase().includes(q) ||
      (v.maker || '').toLowerCase().includes(q) ||
      (v.model || '').toLowerCase().includes(q)
    )
  }, [vehicles, searchQuery])

  function openEdit(vehicle: Vehicle) {
    setSelectedVehicle(vehicle)
    setEdit({
      bidJpy: vehicle.bid_jpy?.toString() || '',
      commissionJpy: vehicle.commission_jpy?.toString() || '',
      insuranceJpy: vehicle.insurance_jpy?.toString() || '',
      inlandTransportJpy: vehicle.inland_transport_jpy?.toString() || '',
      otherJpy: vehicle.other_jpy?.toString() || '',
      otherLabel: vehicle.other_label || '',
      invoiceAmountJpy: vehicle.invoice_amount_jpy?.toString() || '',
      invoiceRate: vehicle.invoice_jpy_to_lkr_rate?.toString() || '',
      undialAmountJpy: vehicle.undial_amount_jpy?.toString() || '',
      undialRate: vehicle.undial_jpy_to_lkr_rate?.toString() || '',
      hasBank: !!vehicle.undial_transfer_has_bank,
      bankName: vehicle.undial_transfer_bank_name || '',
      bankAccNo: vehicle.undial_transfer_acc_no || '',
      bankDate: vehicle.undial_transfer_date || '',
    })
    setShowEdit(true)
  }

  function calcCifTotal(e: EditState): number {
    const bid = parseFloat(e.bidJpy) || 0
    const comm = parseFloat(e.commissionJpy) || 0
    const ins = parseFloat(e.insuranceJpy) || 0
    const inland = parseFloat(e.inlandTransportJpy) || 0
    const other = parseFloat(e.otherJpy) || 0
    return bid + comm + ins + inland + other
  }

  function calcJapanTotalLkr(e: EditState): number {
    const invoiceJpy = parseFloat(e.invoiceAmountJpy) || 0
    const invoiceRate = parseFloat(e.invoiceRate) || 0
    const undialJpy = parseFloat(e.undialAmountJpy) || 0
    const undialRate = parseFloat(e.undialRate) || 0
    return (invoiceJpy * invoiceRate) + (undialJpy * undialRate)
  }

  function canMoveToAvailable(e: EditState): boolean {
    const invoiceJpy = parseFloat(e.invoiceAmountJpy) || 0
    const invoiceRate = parseFloat(e.invoiceRate) || 0
    if (invoiceJpy <= 0 || invoiceRate <= 0) return false
    const undialJpy = parseFloat(e.undialAmountJpy) || 0
    if (undialJpy > 0 && (parseFloat(e.undialRate) || 0) <= 0) return false
    return true
  }

  async function ensureInvoiceRateFilled() {
    if (!edit) return
    if ((parseFloat(edit.invoiceRate) || 0) > 0) return
    try {
      const rate = await fetchJPYToLKRRate()
      setEdit({ ...edit, invoiceRate: rate.toString() })
    } catch (err) {
      // keep as-is; user can type
    }
  }

  async function saveUpdates(vehicle: Vehicle, moveToAvailable: boolean) {
    if (!edit) return
    setSaving(true)
    try {
      const cif = calcCifTotal(edit)
      const japanTotal = calcJapanTotalLkr(edit)

      const undialJpy = parseFloat(edit.undialAmountJpy) || 0
      const undialRate = undialJpy > 0 ? (parseFloat(edit.undialRate) || 0) : 0
      if (moveToAvailable && !canMoveToAvailable(edit)) {
        alert('Please complete Invoice Amount + Invoice Rate (and Undial Rate if Undial Amount > 0) before moving to Available.')
        return
      }

      const updatePayload: any = {
        bid_jpy: edit.bidJpy ? parseFloat(edit.bidJpy) : null,
        commission_jpy: edit.commissionJpy ? parseFloat(edit.commissionJpy) : null,
        insurance_jpy: edit.insuranceJpy ? parseFloat(edit.insuranceJpy) : null,
        inland_transport_jpy: edit.inlandTransportJpy ? parseFloat(edit.inlandTransportJpy) : null,
        other_jpy: edit.otherJpy ? parseFloat(edit.otherJpy) : null,
        other_label: edit.otherLabel?.trim() || null,

        invoice_amount_jpy: edit.invoiceAmountJpy ? parseFloat(edit.invoiceAmountJpy) : null,
        invoice_jpy_to_lkr_rate: edit.invoiceRate ? parseFloat(edit.invoiceRate) : null,
        undial_amount_jpy: edit.undialAmountJpy ? parseFloat(edit.undialAmountJpy) : null,
        undial_jpy_to_lkr_rate: undialJpy > 0 ? undialRate : null,

        // totals (local costs are still empty here)
        japan_total_lkr: japanTotal || 0,
        final_total_lkr: japanTotal || 0,
        buy_price: japanTotal || 0,
        buy_currency: 'LKR',

        // optional undial transfer details
        undial_transfer_has_bank: edit.hasBank,
        undial_transfer_bank_name: edit.hasBank ? (edit.bankName?.trim() || null) : null,
        undial_transfer_acc_no: edit.hasBank ? (edit.bankAccNo?.trim() || null) : null,
        undial_transfer_date: edit.hasBank ? (edit.bankDate || null) : null,
      }

      if (moveToAvailable) {
        updatePayload.status = 'available'
      }

      const { error } = await supabase
        .from('vehicles')
        .update(updatePayload)
        .eq('chassis_no', vehicle.chassis_no)

      if (error) throw error

      alert(moveToAvailable ? 'Vehicle moved to Available.' : 'Vehicle updated.')
      setShowEdit(false)
      setSelectedVehicle(null)
      setEdit(null)
      await loadVehicles()
    } catch (err: any) {
      console.error('Error updating not available vehicle:', err)
      alert(`Error: ${err.message || err}`)
    } finally {
      setSaving(false)
    }
  }

  function printUndialTransferReport(vehicle: Vehicle, e: EditState) {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const cifJpy = calcCifTotal(e)
    const invoiceJpy = parseFloat(e.invoiceAmountJpy) || 0
    const invoiceRate = parseFloat(e.invoiceRate) || 0
    const undialJpy = parseFloat(e.undialAmountJpy) || 0
    const undialRate = parseFloat(e.undialRate) || 0
    const undialLkr = undialJpy * undialRate

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text('Undial Transfer Report', 105, 18, { align: 'center' })

    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')

    let y = 30
    pdf.text(`Chassis: ${vehicle.chassis_no}`, 20, y); y += 6
    pdf.text(`Maker: ${vehicle.maker}`, 20, y); y += 6
    pdf.text(`Model: ${vehicle.model}`, 20, y); y += 6
    pdf.text(`Year: ${vehicle.manufacturer_year}`, 20, y); y += 6
    pdf.text(`Mileage: ${formatNumber(vehicle.mileage)} km`, 20, y); y += 10

    pdf.setFont('helvetica', 'bold')
    pdf.text('Amounts', 20, y); y += 7
    pdf.setFont('helvetica', 'normal')

    pdf.text(`Total JPY Price (CIF): ${formatNumber(cifJpy)} JPY`, 20, y); y += 6
    pdf.text(`Invoice Price: ${formatNumber(invoiceJpy)} JPY`, 20, y); y += 6
    pdf.text(`Invoice Rate: ${invoiceRate.toFixed(4)}`, 20, y); y += 6
    pdf.text(`Undial Price: ${formatNumber(undialJpy)} JPY`, 20, y); y += 6
    pdf.text(`Undial Rate: ${undialRate.toFixed(4)}`, 20, y); y += 6
    pdf.text(`Undial Price (LKR): ${formatCurrency(undialLkr)}`, 20, y); y += 10

    if (e.hasBank) {
      pdf.setFont('helvetica', 'bold')
      pdf.text('Bank Details', 20, y); y += 7
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Bank Name: ${e.bankName || '-'}`, 20, y); y += 6
      pdf.text(`Account No: ${e.bankAccNo || '-'}`, 20, y); y += 6
      pdf.text(`Date: ${e.bankDate || '-'}`, 20, y); y += 10
    }

    pdf.setFont('helvetica', 'bold')
    pdf.text('Authorized Signature:', 20, 270)
    pdf.line(70, 270, 190, 270)

    pdf.save(`Undial-Transfer-Report-${vehicle.chassis_no}.pdf`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Not Available</h1>
          <p className="text-slate-600">Save basic details first, complete costs later, then move to Available.</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by chassis / maker / model"
            className="input-field pl-9"
          />
        </div>
      </div>

      <div className="card p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-600">No not-available vehicles found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((v) => (
              <div key={v.chassis_no} className="p-4 border border-slate-200 rounded-lg flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">{v.maker} {v.model}</div>
                  <div className="text-sm text-slate-600">Chassis: {v.chassis_no} • Year: {v.manufacturer_year} • Mileage: {formatNumber(v.mileage)} km</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(v)} className="btn-secondary flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    Edit / Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showEdit && selectedVehicle && edit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !saving && setShowEdit(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-xl w-full max-w-3xl p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Complete Vehicle Details</h2>
                  <p className="text-sm text-slate-600">{selectedVehicle.chassis_no} • {selectedVehicle.maker} {selectedVehicle.model}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="font-semibold text-slate-800">Japan Costs (JPY)</div>
                  <input className="input-field" placeholder="Bid (JPY)" value={edit.bidJpy} onChange={(e) => setEdit({ ...edit, bidJpy: e.target.value })} />
                  <input className="input-field" placeholder="Commission (JPY)" value={edit.commissionJpy} onChange={(e) => setEdit({ ...edit, commissionJpy: e.target.value })} />
                  <input className="input-field" placeholder="Insurance (JPY)" value={edit.insuranceJpy} onChange={(e) => setEdit({ ...edit, insuranceJpy: e.target.value })} />
                  <input className="input-field" placeholder="Inland Transport (JPY)" value={edit.inlandTransportJpy} onChange={(e) => setEdit({ ...edit, inlandTransportJpy: e.target.value })} />
                  <input className="input-field" placeholder="Other (JPY)" value={edit.otherJpy} onChange={(e) => setEdit({ ...edit, otherJpy: e.target.value })} />
                  <input className="input-field" placeholder="Other Label" value={edit.otherLabel} onChange={(e) => setEdit({ ...edit, otherLabel: e.target.value })} />

                  <div className="text-sm text-slate-700">
                    <span className="font-semibold">Total CIF:</span> {formatNumber(calcCifTotal(edit))} JPY
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="font-semibold text-slate-800">CIF Split & Rates</div>
                  <input 
                    className="input-field" 
                    placeholder="Invoice Amount (JPY)" 
                    value={edit.invoiceAmountJpy} 
                    onChange={(e) => {
                      const newInvoiceAmount = e.target.value
                      const cifTotal = calcCifTotal(edit)
                      const invoiceAmountNum = parseFloat(newInvoiceAmount) || 0
                      const autoUndial = cifTotal > 0 && invoiceAmountNum > 0 ? (cifTotal - invoiceAmountNum) : 0
                      setEdit({ 
                        ...edit, 
                        invoiceAmountJpy: newInvoiceAmount,
                        undialAmountJpy: autoUndial > 0 ? autoUndial.toString() : edit.undialAmountJpy
                      })
                    }} 
                  />
                  <input
                    className="input-field"
                    placeholder="Invoice Rate (JPY→LKR)"
                    value={edit.invoiceRate}
                    onFocus={ensureInvoiceRateFilled}
                    onChange={(e) => setEdit({ ...edit, invoiceRate: e.target.value })}
                  />
                  <input 
                    className="input-field" 
                    placeholder="Undial Amount (JPY)" 
                    value={edit.undialAmountJpy} 
                    onChange={(e) => setEdit({ ...edit, undialAmountJpy: e.target.value })} 
                  />
                  <input className="input-field" placeholder="Undial Rate (JPY→LKR)" value={edit.undialRate} onChange={(e) => setEdit({ ...edit, undialRate: e.target.value })} />

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      checked={edit.hasBank}
                      onChange={(e) => setEdit({ ...edit, hasBank: e.target.checked })}
                    />
                    <span className="text-sm text-slate-700">Has Bank (for Undial transfer)</span>
                  </div>

                  {edit.hasBank && (
                    <div className="space-y-2">
                      <input className="input-field" placeholder="Bank Name" value={edit.bankName} onChange={(e) => setEdit({ ...edit, bankName: e.target.value })} />
                      <input className="input-field" placeholder="Account No" value={edit.bankAccNo} onChange={(e) => setEdit({ ...edit, bankAccNo: e.target.value })} />
                      <input className="input-field" type="date" value={edit.bankDate} onChange={(e) => setEdit({ ...edit, bankDate: e.target.value })} />
                    </div>
                  )}

                  <div className="text-sm text-slate-700">
                    <span className="font-semibold">Japan Total (LKR):</span> {formatCurrency(calcJapanTotalLkr(edit))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 mt-6">
                <button
                  className="btn-secondary flex items-center gap-2"
                  disabled={saving}
                  onClick={() => printUndialTransferReport(selectedVehicle, edit)}
                >
                  <FileText className="w-4 h-4" />
                  Print Undial Transfer Report
                </button>
                <button
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() => saveUpdates(selectedVehicle, false)}
                >
                  {saving ? 'Saving...' : 'Save Updates'}
                </button>
                <button
                  className="btn-primary flex items-center gap-2"
                  disabled={saving || !canMoveToAvailable(edit)}
                  onClick={() => saveUpdates(selectedVehicle, true)}
                >
                  <CheckCircle className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Add to Available'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

