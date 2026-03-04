export type VehicleStatus = 'available' | 'sold' | 'not_available'

export interface Vehicle {
  chassis_no: string
  maker: string
  model: string
  manufacturer_year: number
  mileage: number
  status: VehicleStatus
  
  // Vehicle description
  engine_no: string | null
  engine_capacity: string | null
  // DB column is "colour" (historical). Some UI code may still reference "color".
  colour?: string | null
  color?: string | null
  fuel_type: string | null
  seating_capacity: string | null
  registration_no?: string | null
  
  // Japan costs (JPY)
  bid_jpy: number | null
  commission_jpy: number | null
  insurance_jpy: number | null
  inland_transport_jpy: number | null
  other_jpy: number | null
  other_label: string | null
  
  // CIF split
  invoice_amount_jpy: number | null
  invoice_jpy_to_lkr_rate: number | null
  undial_amount_jpy: number | null
  undial_jpy_to_lkr_rate: number | null

  // Undial transfer (optional)
  undial_transfer_has_bank?: boolean | null
  undial_transfer_bank_name?: string | null
  undial_transfer_acc_no?: string | null
  undial_transfer_date?: string | null
  
  // Local costs (LKR)
  tax_lkr: number | null
  clearance_lkr: number | null
  transport_lkr: number | null
  lc_charges_lkr: number | null
  local_extra1_label: string | null
  local_extra1_lkr: number | null
  local_extra2_label: string | null
  local_extra2_lkr: number | null
  local_extra3_label: string | null
  local_extra3_lkr: number | null
  local_extra4_label: string | null
  local_extra4_lkr: number | null
  local_extra5_label: string | null
  local_extra5_lkr: number | null
  
  // Computed totals
  japan_total_lkr: number | null
  final_total_lkr: number | null
  buy_price: number | null // Purchase/buy price (usually same as japan_total_lkr initially)
  buy_currency: 'JPY' | 'LKR' | null // Currency of buy_price
  
  created_at: string
  updated_at: string
}

export interface Advance {
  chassis_no: string
  customer_name: string
  customer_phone: string | null
  customer_address: string | null
  expected_sell_price_lkr: number
  amount_lkr?: number | null // Optional - may exist in some database schemas
  created_at: string
  updated_at: string
}

export interface AdvancePayment {
  id: string
  chassis_no: string
  paid_date: string
  amount_lkr: number
  created_at: string
}

export interface Sale {
  chassis_no: string
  sold_price: number
  sold_currency: 'JPY' | 'LKR'
  rate_jpy_to_lkr: number | null
  profit: number // Database uses 'profit' (in LKR)
  profit_lkr?: number // Alternative name (if both exist)
  sold_date: string
  customer_name: string // Database uses customer_name
  customer_address: string | null
  customer_phone: string | null
  bank_name: string | null
  bank_address: string | null
  created_at: string
}

export interface LeaseCollection {
  id: string
  chassis_no: string
  due_amount_lkr: number
  due_date: string
  collected: boolean
  collected_date: string | null
  lease_company: string | null
  cheque_amount: number | null
  personal_loan_amount: number | null
  cheque_no: string | null
  cheque_deposit_bank_name: string | null
  cheque_deposit_bank_acc_no: string | null
  cheque_deposit_date: string | null
  personal_loan_deposit_bank_name: string | null
  personal_loan_deposit_bank_acc_no: string | null
  personal_loan_deposit_date: string | null
  created_at: string
  updated_at: string
}

export interface TransactionDetail {
  id: string
  chassis_no: string
  sale_id: string
  document_type: 'invoice' | 'transaction' | 'cost-calculation' | 'tax-sheet'
  customer_name: string
  customer_phone: string | null
  customer_address: string | null
  lease_company: string | null
  lease_amount: number | null
  payment_method: 'cash' | 'cheque' | 'both' | null
  cheque1_no: string | null
  cheque1_amount: number | null
  cheque2_no: string | null
  cheque2_amount: number | null
  cash_5000: number
  cash_2000: number
  cash_1000: number
  cash_500: number
  cash_100: number
  registration: number
  valuation: number
  r_licence: number
  customer_signature: string | null
  authorized_signature: string | null
  created_at: string
  updated_at: string
}

export interface LeasePaymentTransaction {
  id: string
  lease_collection_id: string
  payment_type: 'cheque' | 'personal_loan'
  amount: number
  // Cheque fields
  cheque_no: string | null
  cheque_deposit_bank_name: string | null
  cheque_deposit_bank_acc_no: string | null
  cheque_deposit_date: string | null
  // Personal loan fields
  personal_loan_deposit_bank_name: string | null
  personal_loan_deposit_bank_acc_no: string | null
  personal_loan_deposit_date: string | null
  created_at: string
}
