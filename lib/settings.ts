import { supabase } from './supabase'

export interface CompanySettings {
  company_name: string
  company_address: string | null
  company_email: string | null
  company_telephone: string | null
  company_logo_url: string | null
  enable_sri_lanka_purchase: boolean
  enable_profit_intelligence: boolean
}

const DEFAULT_SETTINGS: CompanySettings = {
  company_name: 'R.S.Enterprises',
  company_address: null,
  company_email: null,
  company_telephone: null,
  company_logo_url: null,
  enable_sri_lanka_purchase: false,
  enable_profit_intelligence: false,
}

let cachedSettings: CompanySettings | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

export async function getCompanySettings(): Promise<CompanySettings> {
  // Return cached settings if available and not expired
  const now = Date.now()
  if (cachedSettings && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedSettings
  }

  try {
    // Try to load from database (assuming a 'settings' table with a single row)
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading settings:', error)
      return DEFAULT_SETTINGS
    }

    if (data) {
      cachedSettings = {
        company_name: data.company_name || DEFAULT_SETTINGS.company_name,
        company_address: data.company_address || null,
        company_email: data.company_email || null,
        company_telephone: data.company_telephone || null,
        company_logo_url: data.company_logo_url || null,
        enable_sri_lanka_purchase: data.enable_sri_lanka_purchase ?? DEFAULT_SETTINGS.enable_sri_lanka_purchase,
        enable_profit_intelligence: data.enable_profit_intelligence ?? DEFAULT_SETTINGS.enable_profit_intelligence,
      }
      cacheTimestamp = now
      return cachedSettings
    }

    return DEFAULT_SETTINGS
  } catch (error) {
    console.error('Error loading settings:', error)
    return DEFAULT_SETTINGS
  }
}

export async function saveCompanySettings(settings: Partial<CompanySettings>): Promise<void> {
  try {
    // Upsert settings (assuming a 'settings' table with a single row)
    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 1, // Assuming single row with id=1
        ...settings,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Error saving settings:', error)
      throw error
    }

    // Clear cache to force reload
    cachedSettings = null
  } catch (error) {
    console.error('Error saving settings:', error)
    throw error
  }
}

export function clearSettingsCache() {
  cachedSettings = null
  cacheTimestamp = 0
}
