'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import { DollarSign, Plus, Calendar, Download, Trash2 } from 'lucide-react'
import jsPDF from 'jspdf'

interface Expense {
  id: string
  expense_date: string
  description: string
  amount: number
  created_by: string
  created_by_role: 'admin' | 'staff'
  created_at: string
}

interface ExpensesViewProps {
  user: User
}

export default function ExpensesView({ user }: ExpensesViewProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    loadTodayExpenses()
  }, [user])

  async function loadTodayExpenses() {
    try {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0]
      
      let query = supabase
        .from('expenses')
        .select('*')
        .eq('expense_date', today)
        .order('created_at', { ascending: false })

      // Staff can't see admin expenses - RLS should handle this, but we can filter client-side too
      const { data, error } = await query

      if (error) {
        console.error('Error loading expenses:', error)
        alert(`Error loading expenses: ${error.message}`)
        return
      }

      // Filter out admin expenses for staff users
      let filteredData = data || []
      if (!isAdmin(user)) {
        filteredData = filteredData.filter(exp => exp.created_by_role !== 'admin')
      }

      setExpenses(filteredData)
    } catch (error: any) {
      console.error('Error:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm('Are you sure you want to delete this expense?')) return

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadTodayExpenses()
    } catch (error: any) {
      console.error('Error deleting expense:', error)
      alert(`Error deleting expense: ${error.message}`)
    }
  }

  async function handleAddExpense() {
    if (!description.trim() || !amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid description and amount')
      return
    }

    setSaving(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('You must be logged in to add expenses')
        return
      }

      const { error } = await supabase
        .from('expenses')
        .insert({
          expense_date: expenseDate,
          description: description.trim(),
          amount: parseFloat(amount),
          created_by: authUser.id,
          created_by_role: user.role,
        })

      if (error) throw error

      // Reset form
      setDescription('')
      setAmount('')
      setExpenseDate(new Date().toISOString().split('T')[0])
      setShowAddForm(false)

      // Reload expenses
      await loadTodayExpenses()
    } catch (error: any) {
      console.error('Error adding expense:', error)
      alert(`Error adding expense: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function downloadMonthlyExpenses() {
    try {
      // Get start and end dates for selected month/year
      const startDate = new Date(selectedYear, selectedMonth - 1, 1)
      const endDate = new Date(selectedYear, selectedMonth, 0) // Last day of month

      let query = supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .lte('expense_date', endDate.toISOString().split('T')[0])
        .order('expense_date', { ascending: true })

      const { data, error } = await query

      if (error) {
        console.error('Error loading monthly expenses:', error)
        alert(`Error loading expenses: ${error.message}`)
        return
      }

      // Filter out admin expenses for staff users
      let filteredData = data || []
      if (!isAdmin(user)) {
        filteredData = filteredData.filter(exp => exp.created_by_role !== 'admin')
      }

      // Generate PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Company Header
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(24)
      pdf.text('R.S.Enterprises', 105, 20, { align: 'center' })

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('No.164/B,Nittambuwa Road,Paththalagedara,Veyangoda', 105, 28, { align: 'center' })
      pdf.text('Tel: 0773073156,0332245886', 105, 34, { align: 'center' })

      // Title
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December']
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text(`Monthly Expenses Report - ${monthNames[selectedMonth - 1]} ${selectedYear}`, 105, 50, { align: 'center' })

      // Line separator
      pdf.line(20, 55, 190, 55)

      // Table headers
      let currentY = 65
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Date', 20, currentY)
      pdf.text('Description', 50, currentY)
      pdf.text('Amount (LKR)', 160, currentY)
      currentY += 8

      // Table line
      pdf.line(20, currentY - 4, 190, currentY - 4)

      // Expenses data
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      
      let totalAmount = 0
      filteredData.forEach(expense => {
        if (currentY > 270) {
          // New page
          pdf.addPage()
          currentY = 20
        }

        const dateStr = new Date(expense.expense_date).toLocaleDateString()
        pdf.text(dateStr, 20, currentY)
        
        // Wrap description if too long
        const maxWidth = 100
        const descriptionLines = pdf.splitTextToSize(expense.description, maxWidth)
        pdf.text(descriptionLines[0], 50, currentY)
        
        pdf.text(formatCurrency(expense.amount), 160, currentY)
        totalAmount += expense.amount
        
        currentY += 6 * Math.max(1, descriptionLines.length)
      })

      // Total
      currentY += 5
      pdf.line(20, currentY, 190, currentY)
      currentY += 8
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Total Expenses:', 50, currentY)
      pdf.text(formatCurrency(totalAmount), 160, currentY)

      // Save PDF
      const monthStr = String(selectedMonth).padStart(2, '0')
      pdf.save(`Monthly-Expenses-${monthStr}-${selectedYear}.pdf`)
    } catch (error: any) {
      console.error('Error generating monthly expenses PDF:', error)
      alert(`Error generating PDF: ${error.message}`)
    }
  }

  const todayTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const today = new Date().toLocaleDateString()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-stone-900">Expenses</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Add Expense Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <h3 className="text-xl font-bold text-stone-800 mb-4">Add New Expense</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Description *</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                placeholder="Enter expense description"
                required
              />
            </div>
            <div>
              <label className="label">Amount (LKR) *</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field"
                placeholder="0.00"
                required
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAddExpense}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setDescription('')
                setAmount('')
                setExpenseDate(new Date().toISOString().split('T')[0])
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Today's Expenses Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-stone-800">Today's Expenses ({today})</h3>
          <div className="flex items-center gap-2 text-lg font-semibold text-amber-700">
            <DollarSign className="w-5 h-5" />
            Total: {formatCurrency(todayTotal)}
          </div>
        </div>

        {expenses.length === 0 ? (
          <p className="text-stone-600 text-center py-8">No expenses recorded for today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-300">
                  <th className="text-left py-3 px-4 font-semibold text-stone-800">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-stone-800">Description</th>
                  <th className="text-right py-3 px-4 font-semibold text-stone-800">Amount (LKR)</th>
                  <th className="text-center py-3 px-4 font-semibold text-stone-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(expense => (
                  <tr key={expense.id} className="border-b border-stone-200 hover:bg-stone-50">
                    <td className="py-3 px-4">{new Date(expense.expense_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4">{expense.description}</td>
                    <td className="py-3 px-4 text-right font-semibold">{formatCurrency(expense.amount)}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Monthly Expenses Download */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <h3 className="text-xl font-bold text-stone-800 mb-4">Download Monthly Expenses</h3>
        <div className="flex items-center gap-4">
          <div>
            <label className="label">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="input-field"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="input-field"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={downloadMonthlyExpenses}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Monthly Expenses
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
