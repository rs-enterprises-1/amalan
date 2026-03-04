import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: 'JPY' | 'LKR' = 'LKR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'JPY' ? 'JPY' : 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Fetches JPY to LKR exchange rate
 * Uses ExchangeRate-API (free, reliable) which tracks official rates
 * Reference: https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/jpy-lkr-indicative-rate-chart
 */
export async function fetchJPYToLKRRate(): Promise<number> {
  try {
    // Method 1: Try ExchangeRate-API (free tier, reliable, no CORS issues)
    // This API provides rates that align with official sources
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const erResponse = await fetch(
      'https://api.exchangerate-api.com/v4/latest/JPY',
      { 
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      }
    )
    
    clearTimeout(timeoutId)
    
    if (erResponse.ok) {
      const data = await erResponse.json()
      if (data.rates && data.rates.LKR) {
        const rate = parseFloat(data.rates.LKR.toString())
        if (rate > 0 && rate < 10) { // Sanity check: rate should be between 0 and 10
          return rate
        }
      }
    }
  } catch (erError) {
    console.log('ExchangeRate-API not available, using fallback rate...')
  }

  // Fallback: Use current approximate rate
  // As of late 2024/early 2025, typical rate is around 1.95-2.00 LKR per JPY
  // This should be updated periodically
  // Reference: https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/jpy-lkr-indicative-rate-chart
  console.warn('Using fallback JPY to LKR rate. Consider setting up a reliable exchange rate API.')
  return 1.9775 // Approximate rate as of late 2024/early 2025
}

/**
 * Get next sequential invoice number from database
 * Returns format: INV-0001, INV-0002, etc.
 */
export async function getNextInvoiceNumber(): Promise<string> {
  try {
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.rpc('get_next_invoice_number')
    if (error) {
      console.error('Error getting invoice number:', error)
      // Fallback: use timestamp-based number
      return `INV-${Date.now().toString().slice(-6)}`
    }
    return `INV-${data}`
  } catch (err) {
    console.error('Error getting invoice number:', err)
    // Fallback: use timestamp-based number
    return `INV-${Date.now().toString().slice(-6)}`
  }
}

