'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { X, DollarSign, Receipt, Calendar, Car, FileText, CreditCard, TrendingUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface StaffUserActivityModalProps {
  open: boolean
  onClose: () => void
  userId: string
  userEmail: string
}

interface Expense {
  id: string
  expense_date: string
  description: string
  amount: number
  created_at: string
}

interface AdvancePayment {
  id: string
  chassis_no: string
  paid_date: string
  amount_lkr: number
  bank_transferred: boolean | null
  bank_name: string | null
  created_at: string
}

interface Sale {
  chassis_no: string
  sold_price: number
  sold_currency: string
  sold_date: string
  buyer_name: string
  created_at: string
}

interface LeaseCollection {
  id: string
  chassis_no: string
  due_amount_lkr: number
  due_date: string
  created_at: string
}

interface LeasePaymentTransaction {
  id: string
  lease_collection_id: string
  payment_type: string
  amount: number
  created_at: string
}

interface Vehicle {
  chassis_no: string
  maker: string
  model: string
  status: string
  created_at: string
}

interface Advance {
  chassis_no: string
  customer_name: string
  expected_sell_price_lkr: number
  created_at: string
}

export default function StaffUserActivityModal({
  open,
  onClose,
  userId,
  userEmail,
}: StaffUserActivityModalProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [leaseCollections, setLeaseCollections] = useState<LeaseCollection[]>([])
  const [leaseTransactions, setLeaseTransactions] = useState<LeasePaymentTransaction[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [advances, setAdvances] = useState<Advance[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'expenses' | 'advances' | 'sales' | 'leases' | 'vehicles' | 'advances_created'>('expenses')

  useEffect(() => {
    if (open) {
      loadActivities()
    }
  }, [open, userId])

  async function loadActivities() {
    setLoading(true)
    try {
      // Load expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (expensesError) {
        console.error('Error loading expenses:', expensesError)
      } else {
        setExpenses(expensesData || [])
      }

      // Load advance payments
      const { data: advancesData, error: advancesError } = await supabase
        .from('advance_payments')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (advancesError) {
        console.error('Error loading advance payments:', advancesError)
      } else {
        setAdvancePayments(advancesData || [])
      }

      // Load sales
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (salesError) {
        console.error('Error loading sales:', salesError)
      } else {
        setSales(salesData || [])
      }

      // Load lease collections
      const { data: leaseCollectionsData, error: leaseCollectionsError } = await supabase
        .from('lease_collections')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (leaseCollectionsError) {
        console.error('Error loading lease collections:', leaseCollectionsError)
      } else {
        setLeaseCollections(leaseCollectionsData || [])
      }

      // Load lease payment transactions
      const { data: leaseTransactionsData, error: leaseTransactionsError } = await supabase
        .from('lease_payment_transactions')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (leaseTransactionsError) {
        console.error('Error loading lease transactions:', leaseTransactionsError)
      } else {
        setLeaseTransactions(leaseTransactionsData || [])
      }

      // Load vehicles (created by this user)
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('chassis_no, maker, model, status, created_at')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (vehiclesError) {
        console.error('Error loading vehicles:', vehiclesError)
      } else {
        setVehicles(vehiclesData || [])
      }

      // Load advances (created by this user)
      const { data: advancesCreatedData, error: advancesCreatedError } = await supabase
        .from('advances')
        .select('chassis_no, customer_name, expected_sell_price_lkr, created_at')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (advancesCreatedError) {
        console.error('Error loading advances:', advancesCreatedError)
      } else {
        setAdvances(advancesCreatedData || [])
      }
    } catch (error: any) {
      console.error('Error loading activities:', error)
      alert(`Error loading activities: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
  const totalAdvancePayments = advancePayments.reduce((sum, adv) => sum + (adv.amount_lkr || 0), 0)
  const totalSales = sales.reduce((sum, sale) => {
    const priceLkr = sale.sold_currency === 'JPY' 
      ? (sale.sold_price || 0) * ((sale as any).rate_jpy_to_lkr || 1)
      : (sale.sold_price || 0)
    return sum + priceLkr
  }, 0)
  const totalLeaseCollections = leaseCollections.reduce((sum, lc) => sum + (lc.due_amount_lkr || 0), 0)
  const totalLeaseTransactions = leaseTransactions.reduce((sum, lt) => sum + (lt.amount || 0), 0)

  if (!open) {
    return null
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )
    }

    if (activeTab === 'expenses') {
      return (
        <div className="space-y-4">
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No expenses found for this user.</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-slate-600">Total Expenses</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalExpenses)}</p>
              </div>
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{expense.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(expense.expense_date).toLocaleDateString()}</span>
                          </div>
                          <span>
                            Created: {new Date(expense.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          {formatCurrency(expense.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )
    }

    if (activeTab === 'advances') {
      return (
        <div className="space-y-4">
          {advancePayments.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No advance payments found for this user.</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-slate-600">Total Advance Payments</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalAdvancePayments)}</p>
              </div>
              <div className="space-y-3">
                {advancePayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          Chassis No: {payment.chassis_no}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Paid: {new Date(payment.paid_date).toLocaleDateString()}</span>
                          </div>
                          {payment.bank_transferred && payment.bank_name && (
                            <span className="text-blue-600">
                              Bank: {payment.bank_name}
                            </span>
                          )}
                          <span>
                            Created: {new Date(payment.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          {formatCurrency(payment.amount_lkr)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )
    }

    if (activeTab === 'sales') {
      return (
        <div className="space-y-4">
          {sales.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No sales found for this user.</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-slate-600">Total Sales Value</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalSales)}</p>
              </div>
              <div className="space-y-3">
                {sales.map((sale) => {
                  const priceLkr = sale.sold_currency === 'JPY' 
                    ? (sale.sold_price || 0) * ((sale as any).rate_jpy_to_lkr || 1)
                    : (sale.sold_price || 0)
                  return (
                    <div
                      key={sale.chassis_no}
                      className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">
                            Chassis No: {sale.chassis_no}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">Buyer: {sale.buyer_name}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Sold: {new Date(sale.sold_date).toLocaleDateString()}</span>
                            </div>
                            <span>
                              Created: {new Date(sale.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-slate-900">
                            {formatCurrency(priceLkr)}
                          </p>
                          <p className="text-xs text-slate-500">{sale.sold_currency}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )
    }

    if (activeTab === 'leases') {
      return (
        <div className="space-y-4">
          {leaseTransactions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No lease payments found for this user.</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-slate-600">Total Lease Payments</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalLeaseTransactions)}</p>
              </div>
              <div className="space-y-3">
                {leaseTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          Payment Type: {transaction.payment_type === 'cheque' ? 'Cheque' : 'Personal Loan'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <span>
                            Created: {new Date(transaction.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          {formatCurrency(transaction.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )
    }

    if (activeTab === 'vehicles') {
      return (
        <div className="space-y-4">
          {vehicles.length === 0 ? (
            <div className="text-center py-12">
              <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No vehicles added by this user.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.chassis_no}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        {vehicle.maker} {vehicle.model}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">Chassis No: {vehicle.chassis_no}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                        <span className={`px-2 py-1 rounded text-xs ${
                          vehicle.status === 'sold' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {vehicle.status === 'sold' ? 'Sold' : 'Available'}
                        </span>
                        <span>
                          Added: {new Date(vehicle.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (activeTab === 'advances_created') {
      return (
        <div className="space-y-4">
          {advances.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No advances created by this user.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {advances.map((advance) => (
                <div
                  key={advance.chassis_no}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        Customer: {advance.customer_name}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">Chassis No: {advance.chassis_no}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                        <span>
                          Created: {new Date(advance.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-900">
                        Expected: {formatCurrency(advance.expected_sell_price_lkr)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Staff User Activities</h2>
              <p className="text-sm text-slate-600 mt-1">{userEmail}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'expenses'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Expenses ({expenses.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('advances')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'advances'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Advance Payments ({advancePayments.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'sales'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Sales ({sales.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('leases')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'leases'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Lease Payments ({leaseTransactions.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'vehicles'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4" />
                Vehicles Added ({vehicles.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('advances_created')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'advances_created'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Advances Created ({advances.length})
              </div>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderContent()}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 p-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
