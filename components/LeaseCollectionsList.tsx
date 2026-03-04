'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { LeaseCollection, Vehicle, LeasePaymentTransaction } from '@/lib/database.types'
import { formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Calendar, DollarSign, X, FileText, Download, Trash2 } from 'lucide-react'
import jsPDF from 'jspdf'

export default function LeaseCollectionsList() {
  const [collections, setCollections] = useState<(LeaseCollection & { vehicle: Vehicle; transactions?: LeasePaymentTransaction[]; totalCollected?: number; remaining?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<(LeaseCollection & { vehicle: Vehicle; transactions?: LeasePaymentTransaction[]; totalCollected?: number; remaining?: number }) | null>(null)
  const [existingTransactions, setExistingTransactions] = useState<LeasePaymentTransaction[]>([])
  
  // Modal form fields for NEW transaction
  const [chequeAmount, setChequeAmount] = useState('')
  const [personalLoanAmount, setPersonalLoanAmount] = useState('')
  const [chequeNo, setChequeNo] = useState('')
  const [chequeDepositBankName, setChequeDepositBankName] = useState('')
  const [chequeDepositBankAccNo, setChequeDepositBankAccNo] = useState('')
  const [chequeDepositDate, setChequeDepositDate] = useState('')
  const [personalLoanDepositBankName, setPersonalLoanDepositBankName] = useState('')
  const [personalLoanDepositBankAccNo, setPersonalLoanDepositBankAccNo] = useState('')
  const [personalLoanDepositDate, setPersonalLoanDepositDate] = useState('')

  // Customer details loaded for the lease (from sales table)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')

  useEffect(() => {
    loadCollections()
  }, [])

  async function loadCollections() {
    const { data: leaseData } = await supabase
      .from('lease_collections')
      .select('*')
      .order('due_date', { ascending: true })

    if (!leaseData) return

    // Only get vehicles that are sold (lease collections are only for sold vehicles)
    const { data: vehiclesData } = await supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'sold')

    // Get all sales to verify vehicles have sale records
    const { data: salesData } = await supabase
      .from('sales')
      .select('chassis_no')

    const soldChassisNos = new Set(salesData?.map(s => s.chassis_no) || [])

    // Load all transactions
    const { data: transactionsData } = await supabase
      .from('lease_payment_transactions')
      .select('*')
      .order('created_at', { ascending: true })

    const vehiclesMap = new Map(vehiclesData?.map(v => [v.chassis_no, v]) || [])
    const transactionsMap = new Map<string, LeasePaymentTransaction[]>()
    
    // Group transactions by lease_collection_id
    transactionsData?.forEach(t => {
      const existing = transactionsMap.get(t.lease_collection_id) || []
      existing.push(t)
      transactionsMap.set(t.lease_collection_id, existing)
    })

    const collectionsWithVehicles = leaseData.map(l => {
      const transactions = transactionsMap.get(l.id) || []
      // Calculate total collected from new transactions
      let totalCollected = transactions.reduce((sum, t) => sum + (t.amount || 0), 0)
      
      // Also include legacy transactions from old DB fields if no new transactions exist
      if (transactions.length === 0) {
        if (l.cheque_amount && l.cheque_amount > 0) {
          totalCollected += l.cheque_amount
        }
        if (l.personal_loan_amount && l.personal_loan_amount > 0) {
          totalCollected += l.personal_loan_amount
        }
      }
      
      const remaining = l.due_amount_lkr - totalCollected
      
      return {
        ...l,
        vehicle: vehiclesMap.get(l.chassis_no),
        transactions,
        totalCollected,
        remaining,
      }
    }).filter(c => c.vehicle) as (LeaseCollection & { vehicle: Vehicle; transactions?: LeasePaymentTransaction[]; totalCollected?: number; remaining?: number })[]

    // Filter: Only show collections that have remaining amount (not fully collected)
    // Also ensure the vehicle is sold, has a sale record, and the collection is not marked as collected
    const filteredCollections = collectionsWithVehicles.filter(c => {
      const remaining = c.remaining ?? c.due_amount_lkr
      // Only show if:
      // 1. There's remaining amount to collect (remaining > 0)
      // 2. Vehicle is sold
      // 3. Vehicle has a sale record
      // 4. Collection is not marked as fully collected
      // 5. Remaining amount is greater than 0 (fully paid leases are automatically removed)
      const shouldShow = remaining > 0 && 
                         c.vehicle.status === 'sold' && 
                         soldChassisNos.has(c.chassis_no) &&
                         !c.collected
      
      // If remaining is 0 or less, automatically mark as collected and don't show
      if (remaining <= 0 && !c.collected) {
        // Auto-update collection status to collected
        supabase
          .from('lease_collections')
          .update({
            collected: true,
            collected_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', c.id)
          .then(() => {
            // Silently update - don't show alert
          })
      }
      
      return shouldShow
    })

    setCollections(filteredCollections)
    setLoading(false)
  }

  async function loadCustomerForCollection(chassisNo: string) {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('customer_name, customer_phone, customer_address')
        .eq('chassis_no', chassisNo)
        .maybeSingle()

      if (error) {
        console.warn('Error loading customer for lease collection:', error)
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
        return
      }

      if (data) {
        setCustomerName(data.customer_name || '')
        setCustomerPhone(data.customer_phone || '')
        setCustomerAddress(data.customer_address || '')
      } else {
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
      }
    } catch (err) {
      console.warn('Unexpected error loading customer for lease collection:', err)
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
    }
  }

  async function openMarkCollectedModal(collection: LeaseCollection & { vehicle: Vehicle }) {
    setSelectedCollection(collection)
    await loadCustomerForCollection(collection.chassis_no)
    
    // Load existing transactions for this collection
    const { data: transactions, error: transactionsError } = await supabase
      .from('lease_payment_transactions')
      .select('*')
      .eq('lease_collection_id', collection.id)
      .order('created_at', { ascending: true })
    
    if (transactionsError) {
      console.error('Error loading transactions:', transactionsError)
    }
    
    // Also check for legacy transactions stored in lease_collections table
    // If there are old cheque_amount or personal_loan_amount but no transactions, create them
    const legacyTransactions: LeasePaymentTransaction[] = []
    
    if ((collection.cheque_amount && collection.cheque_amount > 0) || 
        (collection.personal_loan_amount && collection.personal_loan_amount > 0)) {
      // Check if we already have transactions - if not, these are legacy records
      if (!transactions || transactions.length === 0) {
        if (collection.cheque_amount && collection.cheque_amount > 0) {
          legacyTransactions.push({
            id: `legacy-cheque-${collection.id}`,
            lease_collection_id: collection.id,
            payment_type: 'cheque',
            amount: collection.cheque_amount,
            cheque_no: collection.cheque_no || null,
            cheque_deposit_bank_name: collection.cheque_deposit_bank_name || null,
            cheque_deposit_bank_acc_no: collection.cheque_deposit_bank_acc_no || null,
            cheque_deposit_date: collection.cheque_deposit_date || null,
            personal_loan_deposit_bank_name: null,
            personal_loan_deposit_bank_acc_no: null,
            personal_loan_deposit_date: null,
            created_at: collection.created_at || new Date().toISOString(),
          })
        }
        
        if (collection.personal_loan_amount && collection.personal_loan_amount > 0) {
          legacyTransactions.push({
            id: `legacy-pl-${collection.id}`,
            lease_collection_id: collection.id,
            payment_type: 'personal_loan',
            amount: collection.personal_loan_amount,
            cheque_no: null,
            cheque_deposit_bank_name: null,
            cheque_deposit_bank_acc_no: null,
            cheque_deposit_date: null,
            personal_loan_deposit_bank_name: collection.personal_loan_deposit_bank_name || null,
            personal_loan_deposit_bank_acc_no: collection.personal_loan_deposit_bank_acc_no || null,
            personal_loan_deposit_date: collection.personal_loan_deposit_date || null,
            created_at: collection.created_at || new Date().toISOString(),
          })
        }
      }
    }
    
    // Combine new transactions with legacy transactions
    const allTransactions = [...(transactions || []), ...legacyTransactions]
    setExistingTransactions(allTransactions)
    
    // Reset form fields for new transaction
    setChequeAmount('')
    setPersonalLoanAmount('')
    setChequeNo('')
    setChequeDepositBankName('')
    setChequeDepositBankAccNo('')
    setChequeDepositDate('')
    setPersonalLoanDepositBankName('')
    setPersonalLoanDepositBankAccNo('')
    setPersonalLoanDepositDate('')
    setShowModal(true)
  }

  async function generateAllPendingLeaseReport() {
    try {
      // Get all pending (not collected) lease collections
      const pendingCollections = collections.filter(c => !c.collected)

      if (pendingCollections.length === 0) {
        alert('No pending lease collections to print.')
        return
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      // Title
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('Pending Lease Collections Report', 105, 15, { align: 'center' })

      // Table headers
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      let yPos = 25
      const col1X = 15  // Chassis No
      const col2X = 50  // Maker + Model
      const col3X = 100 // Lease Company
      const col4X = 130 // Remaining Amount
      const col5X = 160 // Due Date
      
      pdf.text('Chassis No', col1X, yPos)
      pdf.text('Maker + Model', col2X, yPos)
      pdf.text('Lease Co.', col3X, yPos)
      pdf.text('Remaining', col4X, yPos)
      pdf.text('Due Date', col5X, yPos)
      
      // Draw header line
      yPos += 3
      pdf.line(15, yPos, 190, yPos)
      yPos += 5

      // Table rows
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      
      // Sort by due date ascending
      const sortedCollections = [...pendingCollections].sort((a, b) => {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })

      sortedCollections.forEach((collection) => {
        // Check if we need a new page
        if (yPos > 270) {
          pdf.addPage()
          yPos = 20
          
          // Redraw headers on new page
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(11)
          pdf.text('Chassis No', col1X, yPos)
          pdf.text('Maker + Model', col2X, yPos)
          pdf.text('Lease Co.', col3X, yPos)
          pdf.text('Remaining', col4X, yPos)
          pdf.text('Due Date', col5X, yPos)
          yPos += 3
          pdf.line(15, yPos, 190, yPos)
          yPos += 5
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
        }

        const chassisNo = collection.vehicle.chassis_no.toString()
        const makerModel = `${collection.vehicle.maker} ${collection.vehicle.model}`
        const leaseCompany = collection.lease_company || 'N/A'
        const remaining = collection.remaining ?? collection.due_amount_lkr
        const remainingAmount = formatCurrency(remaining)
        const dueDate = new Date(collection.due_date).toLocaleDateString()

        // Truncate if too long
        const maxChassisWidth = 30
        const maxMakerModelWidth = 45
        let displayChassis = chassisNo
        let displayMakerModel = makerModel
        let displayLeaseCompany = leaseCompany

        if (pdf.getTextWidth(displayChassis) > maxChassisWidth) {
          displayChassis = displayChassis.substring(0, Math.min(12, displayChassis.length))
        }
        if (pdf.getTextWidth(displayMakerModel) > maxMakerModelWidth) {
          displayMakerModel = displayMakerModel.substring(0, Math.min(25, displayMakerModel.length))
        }
        if (pdf.getTextWidth(displayLeaseCompany) > 25) {
          displayLeaseCompany = displayLeaseCompany.substring(0, Math.min(15, displayLeaseCompany.length))
        }

        pdf.text(displayChassis, col1X, yPos)
        pdf.text(displayMakerModel, col2X, yPos)
        pdf.text(displayLeaseCompany, col3X, yPos)
        pdf.text(remainingAmount, col4X, yPos)
        pdf.text(dueDate, col5X, yPos)
        
        yPos += 6
      })

      // Footer with total count and sum
      yPos += 5
      pdf.line(15, yPos, 190, yPos)
      yPos += 7
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      const grandTotal = sortedCollections.reduce((sum, c) => {
        const remaining = c.remaining ?? c.due_amount_lkr
        return sum + remaining
      }, 0)
      pdf.text(`Total Pending Collections: ${sortedCollections.length}`, col1X, yPos)
      pdf.text(`Grand Total: ${formatCurrency(grandTotal)}`, col4X, yPos)

      // Save PDF
      pdf.save(`Pending-Lease-Collections-Report-${Date.now()}.pdf`)
    } catch (error: any) {
      console.error('Error generating pending lease report:', error)
      alert(`Error generating report: ${error.message}`)
    }
  }

  async function generateLeaseReport(collection: LeaseCollection & { vehicle: Vehicle }, useSavedData: boolean = false) {
    try {
      // Always load customer details directly from database for the report
      let reportCustomerName = 'N/A'
      let reportCustomerPhone = 'N/A'
      let reportCustomerAddress = 'N/A'
      
      try {
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .select('customer_name, customer_phone, customer_address')
          .eq('chassis_no', collection.chassis_no)
          .maybeSingle()

        if (!saleError && saleData) {
          reportCustomerName = saleData.customer_name || 'N/A'
          reportCustomerPhone = saleData.customer_phone || 'N/A'
          reportCustomerAddress = saleData.customer_address || 'N/A'
        }
      } catch (err) {
        console.warn('Error loading customer details for report:', err)
        // Keep default 'N/A' values
      }

      // Always load fresh transactions from database to ensure latest data
      const { data: transactions, error: transactionsError } = await supabase
        .from('lease_payment_transactions')
        .select('*')
        .eq('lease_collection_id', collection.id)
        .order('created_at', { ascending: true })
      
      if (transactionsError) {
        console.error('Error loading transactions for report:', transactionsError)
      }
      
      // Combine new transactions with legacy transactions from old DB fields
      const reportTransactions: LeasePaymentTransaction[] = [...(transactions || [])]
      
      // Add legacy transactions if they exist in old DB fields and no new transactions exist
      if ((!transactions || transactions.length === 0) && 
          ((collection.cheque_amount && collection.cheque_amount > 0) || 
           (collection.personal_loan_amount && collection.personal_loan_amount > 0))) {
        
        if (collection.cheque_amount && collection.cheque_amount > 0) {
          reportTransactions.push({
            id: `legacy-cheque-${collection.id}`,
            lease_collection_id: collection.id,
            payment_type: 'cheque',
            amount: collection.cheque_amount,
            cheque_no: collection.cheque_no || null,
            cheque_deposit_bank_name: collection.cheque_deposit_bank_name || null,
            cheque_deposit_bank_acc_no: collection.cheque_deposit_bank_acc_no || null,
            cheque_deposit_date: collection.cheque_deposit_date || null,
            personal_loan_deposit_bank_name: null,
            personal_loan_deposit_bank_acc_no: null,
            personal_loan_deposit_date: null,
            created_at: collection.created_at || new Date().toISOString(),
          })
        }
        
        if (collection.personal_loan_amount && collection.personal_loan_amount > 0) {
          reportTransactions.push({
            id: `legacy-pl-${collection.id}`,
            lease_collection_id: collection.id,
            payment_type: 'personal_loan',
            amount: collection.personal_loan_amount,
            cheque_no: null,
            cheque_deposit_bank_name: null,
            cheque_deposit_bank_acc_no: null,
            cheque_deposit_date: null,
            personal_loan_deposit_bank_name: collection.personal_loan_deposit_bank_name || null,
            personal_loan_deposit_bank_acc_no: collection.personal_loan_deposit_bank_acc_no || null,
            personal_loan_deposit_date: collection.personal_loan_deposit_date || null,
            created_at: collection.created_at || new Date().toISOString(),
          })
        }
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      // Title
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('LEASE REPORT', 105, 20, { align: 'center' })

      // Line under title
      pdf.setDrawColor(0, 0, 0)
      pdf.line(20, 25, 190, 25)

      let currentY = 35

      // Vehicle details section
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Vehicle Details', 20, currentY)
      currentY += 6

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Maker      : ${collection.vehicle.maker}`, 20, currentY)
      currentY += 5
      pdf.text(`Model      : ${collection.vehicle.model}`, 20, currentY)
      currentY += 5
      pdf.text(`Chassis No : ${collection.vehicle.chassis_no}`, 20, currentY)
      currentY += 5
      pdf.text(`Due Amount : ${formatCurrency(collection.due_amount_lkr)}`, 20, currentY)
      currentY += 5
      pdf.text(
        `Due Date   : ${new Date(collection.due_date).toLocaleDateString()}`,
        20,
        currentY
      )
      currentY += 10

      // Line
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Customer details section
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Customer Details', 20, currentY)
      currentY += 6

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Name    : ${reportCustomerName || 'N/A'}`, 20, currentY)
      currentY += 5
      pdf.text(`Phone   : ${reportCustomerPhone || 'N/A'}`, 20, currentY)
      currentY += 5
      pdf.text(`Address : ${reportCustomerAddress || 'N/A'}`, 20, currentY)
      currentY += 10

      // Line
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Collection / payment details
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Collection Details', 20, currentY)
      currentY += 6

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)

      // Display all transactions (filter out zero-amount transactions for both cheque and personal loan)
      const validTransactions = reportTransactions.filter(t => {
        // Skip transactions with amount 0 (both cheque and personal loan)
        if (!t.amount || t.amount === 0) {
          return false
        }
        return true
      })

      if (validTransactions.length > 0) {
        let transactionIndex = 0
        validTransactions.forEach((transaction: LeasePaymentTransaction) => {
          if (transactionIndex > 0) {
            currentY += 5
            pdf.line(20, currentY, 190, currentY)
            currentY += 5
          }

          pdf.setFont('helvetica', 'bold')
          pdf.text(
            `Transaction ${transactionIndex + 1}: ${transaction.payment_type === 'cheque' ? 'Cheque' : 'Personal Loan'}`,
            20,
            currentY
          )
          currentY += 5

          pdf.setFont('helvetica', 'normal')
          pdf.text(`Amount: ${formatCurrency(transaction.amount)}`, 20, currentY)
          currentY += 5

          if (transaction.payment_type === 'cheque') {
            // Only show cheque details if amount > 0 (already filtered, but double-check)
            if (transaction.amount && transaction.amount > 0) {
              pdf.text(`Cheque No: ${transaction.cheque_no || 'N/A'}`, 20, currentY)
              currentY += 5
              pdf.text(`Deposit Bank Name: ${transaction.cheque_deposit_bank_name || 'N/A'}`, 20, currentY)
              currentY += 5
              pdf.text(`Deposit Bank Acc No: ${transaction.cheque_deposit_bank_acc_no || 'N/A'}`, 20, currentY)
              currentY += 5
              pdf.text(
                `Deposit Date: ${
                  transaction.cheque_deposit_date
                    ? new Date(transaction.cheque_deposit_date).toLocaleDateString()
                    : 'N/A'
                }`,
                20,
                currentY
              )
              currentY += 5
            }
          } else {
            // Only show personal loan details if amount > 0 (already filtered, but double-check)
            if (transaction.amount && transaction.amount > 0) {
              pdf.text(`Deposit Bank Name: ${transaction.personal_loan_deposit_bank_name || 'N/A'}`, 20, currentY)
              currentY += 5
              pdf.text(`Deposit Bank Acc No: ${transaction.personal_loan_deposit_bank_acc_no || 'N/A'}`, 20, currentY)
              currentY += 5
              pdf.text(
                `Deposit Date: ${
                  transaction.personal_loan_deposit_date
                    ? new Date(transaction.personal_loan_deposit_date).toLocaleDateString()
                    : 'N/A'
                }`,
                20,
                currentY
              )
              currentY += 5
            }
          }
          
          transactionIndex++
        })
      } else {
        pdf.text('No transactions recorded', 20, currentY)
        currentY += 5
      }

      currentY += 7

      pdf.text(`Lease Company        : ${collection.lease_company || 'N/A'}`, 20, currentY)
      currentY += 5
      pdf.text(
        `Collected Date       : ${
          collection.collected_date
            ? new Date(collection.collected_date).toLocaleDateString()
            : 'N/A'
        }`,
        20,
        currentY
      )
      currentY += 7

      const totalCollected = reportTransactions.reduce((sum: number, t: LeasePaymentTransaction) => sum + (t.amount || 0), 0)
      const remaining = collection.due_amount_lkr - totalCollected

      pdf.text(`Total Collected      : ${formatCurrency(totalCollected)}`, 20, currentY)
      currentY += 5
      pdf.text(`Balance Due            : ${formatCurrency(remaining)}`, 20, currentY)

      // Save PDF
      pdf.save(
        `Lease-Report-${collection.vehicle.chassis_no}-${Date.now()}.pdf`
      )
    } catch (err: any) {
      console.error('Error generating lease report:', err)
      alert(`Error generating lease report: ${err.message || err}`)
    }
  }

  async function handleSaveCollection() {
    if (!selectedCollection) return

    const chequeAmt = parseFloat(chequeAmount) || 0
    const personalLoanAmt = parseFloat(personalLoanAmount) || 0
    
    if (chequeAmt === 0 && personalLoanAmt === 0) {
      alert('Please enter at least one payment method (Cheque or Personal Loan)')
      return
    }

    // Calculate total collected from existing transactions + new amounts
    const existingTotal = existingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    const totalCollected = existingTotal + chequeAmt + personalLoanAmt
    const remainingAmount = selectedCollection.due_amount_lkr - totalCollected

    if (remainingAmount < 0) {
      alert(`Total collected amount (${formatCurrency(totalCollected)}) exceeds due amount (${formatCurrency(selectedCollection.due_amount_lkr)})`)
      return
    }

    // Validate cheque fields if cheque amount is entered
    if (chequeAmt > 0) {
      if (!chequeNo) {
        alert('Please enter cheque number')
        return
      }
      if (!chequeDepositBankName || !chequeDepositBankAccNo || !chequeDepositDate) {
        alert('Please fill in all cheque deposit details (Bank Name, Account Number, Deposit Date)')
        return
      }
    }

    // Validate personal loan fields if personal loan amount is entered
    if (personalLoanAmt > 0) {
      if (!personalLoanDepositBankName || !personalLoanDepositBankAccNo || !personalLoanDepositDate) {
        alert('Please fill in all personal loan deposit details (Bank Name, Account Number, Deposit Date)')
        return
      }
    }

    // Check if fully collected
    const isFullyCollected = remainingAmount === 0

    try {
      const transactionsToInsert: any[] = []

      // Insert cheque transaction if amount entered
      if (chequeAmt > 0) {
        transactionsToInsert.push({
          lease_collection_id: selectedCollection.id,
          payment_type: 'cheque',
          amount: chequeAmt,
          cheque_no: chequeNo,
          cheque_deposit_bank_name: chequeDepositBankName,
          cheque_deposit_bank_acc_no: chequeDepositBankAccNo,
          cheque_deposit_date: chequeDepositDate,
        })
      }

      // Insert personal loan transaction if amount entered
      if (personalLoanAmt > 0) {
        transactionsToInsert.push({
          lease_collection_id: selectedCollection.id,
          payment_type: 'personal_loan',
          amount: personalLoanAmt,
          personal_loan_deposit_bank_name: personalLoanDepositBankName,
          personal_loan_deposit_bank_acc_no: personalLoanDepositBankAccNo,
          personal_loan_deposit_date: personalLoanDepositDate,
        })
      }

      // Get current user for tracking
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const userRole = (currentUser?.user_metadata?.role as 'admin' | 'staff') || 'staff'

      // Add user tracking to transactions
      const transactionsWithUser = transactionsToInsert.map(t => ({
        ...t,
        created_by: currentUser?.id || null,
        created_by_role: userRole,
      }))

      // Insert all transactions
      if (transactionsWithUser.length > 0) {
        const { error: transactionError } = await supabase
          .from('lease_payment_transactions')
          .insert(transactionsWithUser)

        if (transactionError) {
          alert(`Error saving transaction: ${transactionError.message}`)
          return
        }
      }

      // Reload transactions in the modal
      const { data: updatedTransactions } = await supabase
        .from('lease_payment_transactions')
        .select('*')
        .eq('lease_collection_id', selectedCollection.id)
        .order('created_at', { ascending: true })
      
      setExistingTransactions(updatedTransactions || [])
      
      // Reload the selected collection to get latest data
      const { data: updatedCollectionData } = await supabase
        .from('lease_collections')
        .select('*')
        .eq('id', selectedCollection.id)
        .single()
      
      if (updatedCollectionData) {
        const updatedCollection = {
          ...updatedCollectionData,
          vehicle: selectedCollection.vehicle,
          transactions: updatedTransactions || [],
        }
        
        setSelectedCollection(updatedCollection as any)
        
        // Auto-download report after each update
        try {
          await generateLeaseReport(updatedCollection as any, true)
        } catch (reportError) {
          console.error('Error generating report:', reportError)
        }
      }
      
      // Update collection status if fully collected
      if (isFullyCollected) {
        const { error: updateError } = await supabase
          .from('lease_collections')
          .update({
            collected: true,
            collected_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', selectedCollection.id)

        if (updateError) {
          console.error('Error updating collection status:', updateError)
        }
        
        // Auto-download final report when fully collected
        try {
          await generateLeaseReport(updatedCollectionData ? {
            ...updatedCollectionData,
            vehicle: selectedCollection.vehicle,
            transactions: updatedTransactions || [],
          } as any : selectedCollection, true)
        } catch (reportError) {
          console.error('Error generating final report:', reportError)
        }
        
        alert('Transaction(s) saved successfully. Lease fully collected! Final report downloaded. Collection removed from pending list.')
        setShowModal(false)
      } else {
        alert('Transaction(s) saved successfully. Report downloaded.')
      }
      
      // Reload collections to update the display (this will remove fully collected items)
      await loadCollections()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    if (!confirm('Are you sure you want to delete this transaction?')) return

    // Check if this is a legacy transaction (stored in lease_collections table)
    if (transactionId.startsWith('legacy-')) {
      alert('This is a legacy transaction stored in the old format. Please contact support to migrate it to the new system.')
      return
    }

    try {
      const { error } = await supabase
        .from('lease_payment_transactions')
        .delete()
        .eq('id', transactionId)

      if (error) {
        alert(`Error deleting transaction: ${error.message}`)
        return
      }

      // Reload transactions
      if (selectedCollection) {
        const { data: transactions } = await supabase
          .from('lease_payment_transactions')
          .select('*')
          .eq('lease_collection_id', selectedCollection.id)
          .order('created_at', { ascending: true })
        
        // Also check for legacy transactions
        const legacyTransactions: LeasePaymentTransaction[] = []
        if ((selectedCollection.cheque_amount && selectedCollection.cheque_amount > 0) || 
            (selectedCollection.personal_loan_amount && selectedCollection.personal_loan_amount > 0)) {
          if (!transactions || transactions.length === 0) {
            if (selectedCollection.cheque_amount && selectedCollection.cheque_amount > 0) {
              legacyTransactions.push({
                id: `legacy-cheque-${selectedCollection.id}`,
                lease_collection_id: selectedCollection.id,
                payment_type: 'cheque',
                amount: selectedCollection.cheque_amount,
                cheque_no: selectedCollection.cheque_no || null,
                cheque_deposit_bank_name: selectedCollection.cheque_deposit_bank_name || null,
                cheque_deposit_bank_acc_no: selectedCollection.cheque_deposit_bank_acc_no || null,
                cheque_deposit_date: selectedCollection.cheque_deposit_date || null,
                personal_loan_deposit_bank_name: null,
                personal_loan_deposit_bank_acc_no: null,
                personal_loan_deposit_date: null,
                created_at: selectedCollection.created_at || new Date().toISOString(),
              })
            }
            
            if (selectedCollection.personal_loan_amount && selectedCollection.personal_loan_amount > 0) {
              legacyTransactions.push({
                id: `legacy-pl-${selectedCollection.id}`,
                lease_collection_id: selectedCollection.id,
                payment_type: 'personal_loan',
                amount: selectedCollection.personal_loan_amount,
                cheque_no: null,
                cheque_deposit_bank_name: null,
                cheque_deposit_bank_acc_no: null,
                cheque_deposit_date: null,
                personal_loan_deposit_bank_name: selectedCollection.personal_loan_deposit_bank_name || null,
                personal_loan_deposit_bank_acc_no: selectedCollection.personal_loan_deposit_bank_acc_no || null,
                personal_loan_deposit_date: selectedCollection.personal_loan_deposit_date || null,
                created_at: selectedCollection.created_at || new Date().toISOString(),
              })
            }
          }
        }
        
        const allTransactions = [...(transactions || []), ...legacyTransactions]
        setExistingTransactions(allTransactions)
        
        // Check if still fully collected
        const totalCollected = allTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
        const remaining = selectedCollection.due_amount_lkr - totalCollected
        
        if (remaining > 0) {
          // Update collection to not collected if there's remaining amount
          await supabase
            .from('lease_collections')
            .update({
              collected: false,
              collected_date: null,
            })
            .eq('id', selectedCollection.id)
        }
      }

      loadCollections()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
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
            <h1 className="text-3xl font-semibold text-slate-900 mb-1">Lease</h1>
            <p className="text-slate-600 text-sm">Track pending lease payments</p>
          </div>
          {collections.filter(c => !c.collected).length > 0 && (
            <button
              onClick={generateAllPendingLeaseReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              Download Pending Report
            </button>
          )}
        </div>

        {collections.length === 0 ? (
          <div className="card p-12 text-center">
            <DollarSign className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Pending Collections</h3>
            <p className="text-slate-600">All lease payments have been collected</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {collections.map((collection, index) => {
              const transactions = (collection as any).transactions || []
              
              // Calculate total collected from transactions
              let totalCollected = transactions.reduce((sum: number, t: LeasePaymentTransaction) => sum + (t.amount || 0), 0)
              
              // Also check for legacy transactions in old DB fields if no new transactions
              if (transactions.length === 0) {
                if (collection.cheque_amount && collection.cheque_amount > 0) {
                  totalCollected += collection.cheque_amount
                }
                if (collection.personal_loan_amount && collection.personal_loan_amount > 0) {
                  totalCollected += collection.personal_loan_amount
                }
              }
              
              const remainingAmount = collection.due_amount_lkr - totalCollected
              const isPartiallyCollected = totalCollected > 0 && remainingAmount > 0

              return (
                <motion.div
                  key={collection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="card p-6 hover:shadow-xl transition-all duration-300"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">
                          {collection.vehicle.maker} {collection.vehicle.model}
                        </h3>
                        <p className="text-sm text-slate-600">
                          Chassis: {collection.vehicle.chassis_no}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-slate-200">
                      {collection.lease_company && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Lease Company:</span>
                          <span className="font-semibold text-slate-800">
                            {collection.lease_company}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Remaining:
                        </span>
                        <span className={`font-bold text-lg ${
                          remainingAmount === 0 
                            ? 'text-green-700' 
                            : remainingAmount > 0 
                            ? 'text-orange-700' 
                            : 'text-red-700'
                        }`}>
                          {formatCurrency(remainingAmount)}
                        </span>
                      </div>
                      {isPartiallyCollected && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Collected:</span>
                          <span className="font-semibold text-green-700">
                            {formatCurrency(totalCollected)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Due Date:
                        </span>
                        <span className={`font-semibold ${
                          new Date(collection.due_date) < new Date() 
                            ? 'text-red-600' 
                            : 'text-slate-800'
                        }`}>
                          {new Date(collection.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={async () => {
                          await loadCustomerForCollection(collection.chassis_no)
                          await generateLeaseReport(collection, true)
                        }}
                        className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <FileText className="w-4 h-4" />
                        Download Report
                      </button>
                      <button
                        onClick={() => openMarkCollectedModal(collection)}
                        className="flex-1 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {isPartiallyCollected ? 'Update Collection' : 'Mark as Collected'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Mark Collected Modal */}
      <AnimatePresence>
        {showModal && selectedCollection && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
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
                  <h2 className="text-2xl font-bold text-slate-800">Mark as Collected</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="text-sm text-slate-600 mb-1">Due Amount:</div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatCurrency(selectedCollection.due_amount_lkr)}
                    </div>
                  </div>

                  {/* Existing Transactions */}
                  {existingTransactions.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-slate-800">Existing Transactions:</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {existingTransactions.map((transaction) => {
                          return (
                            <div key={transaction.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                      transaction.payment_type === 'cheque' 
                                        ? 'bg-blue-100 text-blue-700' 
                                        : 'bg-purple-100 text-purple-700'
                                    }`}>
                                      {transaction.payment_type === 'cheque' ? 'Cheque' : 'Personal Loan'}
                                    </span>
                                    <span className="font-bold text-slate-800">
                                      {formatCurrency(transaction.amount)}
                                    </span>
                                  </div>
                                  {transaction.payment_type === 'cheque' && transaction.cheque_no && (
                                    <div className="text-xs text-slate-600">
                                      Cheque No: {transaction.cheque_no}
                                    </div>
                                  )}
                                  <div className="text-xs text-slate-600">
                                    {transaction.payment_type === 'cheque' 
                                      ? `Bank: ${transaction.cheque_deposit_bank_name || 'N/A'} | Acc: ${transaction.cheque_deposit_bank_acc_no || 'N/A'}`
                                      : `Bank: ${transaction.personal_loan_deposit_bank_name || 'N/A'} | Acc: ${transaction.personal_loan_deposit_bank_acc_no || 'N/A'}`
                                    }
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Date: {transaction.payment_type === 'cheque' 
                                      ? (transaction.cheque_deposit_date ? new Date(transaction.cheque_deposit_date).toLocaleDateString() : 'N/A')
                                      : (transaction.personal_loan_deposit_date ? new Date(transaction.personal_loan_deposit_date).toLocaleDateString() : 'N/A')
                                    }
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteTransaction(transaction.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete transaction"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add New Transaction */}
                  <div className="border-t border-slate-200 pt-4">
                    <h3 className="font-semibold text-slate-800 mb-4">Add New Transaction:</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="label">Cheque Amount (LKR)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={chequeAmount}
                          onChange={(e) => setChequeAmount(e.target.value)}
                          className="input-field"
                          placeholder="Enter cheque amount"
                        />
                      </div>
                      <div>
                        <label className="label">Personal Loan Amount (LKR)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={personalLoanAmount}
                          onChange={(e) => setPersonalLoanAmount(e.target.value)}
                          className="input-field"
                          placeholder="Enter personal loan amount"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cheque Details */}
                  {parseFloat(chequeAmount) > 0 && (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-slate-800">Cheque Details</h3>
                      <div>
                        <label className="label">Cheque Number *</label>
                        <input
                          type="text"
                          value={chequeNo}
                          onChange={(e) => setChequeNo(e.target.value)}
                          className="input-field"
                          placeholder="Enter cheque number"
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Bank Name *</label>
                        <input
                          type="text"
                          value={chequeDepositBankName}
                          onChange={(e) => setChequeDepositBankName(e.target.value)}
                          className="input-field"
                          placeholder="Enter bank name"
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Bank Account Number *</label>
                        <input
                          type="text"
                          value={chequeDepositBankAccNo}
                          onChange={(e) => setChequeDepositBankAccNo(e.target.value)}
                          className="input-field"
                          placeholder="Enter account number"
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Date *</label>
                        <input
                          type="date"
                          value={chequeDepositDate}
                          onChange={(e) => setChequeDepositDate(e.target.value)}
                          className="input-field"
                        />
                      </div>
                    </div>
                  )}

                  {/* Personal Loan Details */}
                  {parseFloat(personalLoanAmount) > 0 && (
                    <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h3 className="font-semibold text-slate-800">Personal Loan Details</h3>
                      <div>
                        <label className="label">Deposit Bank Name *</label>
                        <input
                          type="text"
                          value={personalLoanDepositBankName}
                          onChange={(e) => setPersonalLoanDepositBankName(e.target.value)}
                          className="input-field"
                          placeholder="Enter bank name"
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Bank Account Number *</label>
                        <input
                          type="text"
                          value={personalLoanDepositBankAccNo}
                          onChange={(e) => setPersonalLoanDepositBankAccNo(e.target.value)}
                          className="input-field"
                          placeholder="Enter account number"
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Date *</label>
                        <input
                          type="date"
                          value={personalLoanDepositDate}
                          onChange={(e) => setPersonalLoanDepositDate(e.target.value)}
                          className="input-field"
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-sm text-slate-600 mb-2">Summary:</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Due Amount:</span>
                        <span className="font-semibold">{formatCurrency(selectedCollection.due_amount_lkr)}</span>
                      </div>
                      {existingTransactions.length > 0 && (
                        <>
                          <div className="flex justify-between pt-2 border-t border-amber-300">
                            <span className="text-slate-500 italic">Previously Collected:</span>
                            <span className="text-slate-600">
                              {formatCurrency(existingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0))}
                            </span>
                          </div>
                          {existingTransactions.filter(t => t.payment_type === 'cheque').length > 0 && (
                            <div className="flex justify-between pl-4 text-xs text-slate-500">
                              <span>• Cheque ({existingTransactions.filter(t => t.payment_type === 'cheque').length}):</span>
                              <span>{formatCurrency(existingTransactions.filter(t => t.payment_type === 'cheque').reduce((sum, t) => sum + (t.amount || 0), 0))}</span>
                            </div>
                          )}
                          {existingTransactions.filter(t => t.payment_type === 'personal_loan').length > 0 && (
                            <div className="flex justify-between pl-4 text-xs text-slate-500">
                              <span>• Personal Loan ({existingTransactions.filter(t => t.payment_type === 'personal_loan').length}):</span>
                              <span>{formatCurrency(existingTransactions.filter(t => t.payment_type === 'personal_loan').reduce((sum, t) => sum + (t.amount || 0), 0))}</span>
                            </div>
                          )}
                        </>
                      )}
                      {((parseFloat(chequeAmount) || 0) > 0 || (parseFloat(personalLoanAmount) || 0) > 0) && (
                        <>
                          <div className="flex justify-between pt-2 border-t border-amber-300">
                            <span className="text-blue-700 font-semibold">New Payment:</span>
                            <span className="text-blue-700 font-semibold">
                              {formatCurrency((parseFloat(chequeAmount) || 0) + (parseFloat(personalLoanAmount) || 0))}
                            </span>
                          </div>
                          {(parseFloat(chequeAmount) || 0) > 0 && (
                            <div className="flex justify-between pl-4 text-xs text-blue-600">
                              <span>• Cheque:</span>
                              <span>{formatCurrency(parseFloat(chequeAmount) || 0)}</span>
                            </div>
                          )}
                          {(parseFloat(personalLoanAmount) || 0) > 0 && (
                            <div className="flex justify-between pl-4 text-xs text-blue-600">
                              <span>• Personal Loan:</span>
                              <span>{formatCurrency(parseFloat(personalLoanAmount) || 0)}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between pt-2 border-t-2 border-amber-400 font-semibold">
                        <span>Total Collected (After Save):</span>
                        <span className="text-lg">
                          {formatCurrency(
                            existingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0) + 
                            (parseFloat(chequeAmount) || 0) + 
                            (parseFloat(personalLoanAmount) || 0)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span>Remaining:</span>
                        <span className={`font-bold text-lg ${
                          (selectedCollection.due_amount_lkr - (
                            existingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0) + 
                            (parseFloat(chequeAmount) || 0) + 
                            (parseFloat(personalLoanAmount) || 0)
                          )) === 0
                            ? 'text-green-700'
                            : 'text-orange-700'
                        }`}>
                          {formatCurrency(
                            selectedCollection.due_amount_lkr - (
                              existingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0) + 
                              (parseFloat(chequeAmount) || 0) + 
                              (parseFloat(personalLoanAmount) || 0)
                            )
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCollection}
                    className="btn-primary"
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
