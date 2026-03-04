import { getCompanySettings } from './settings'

/**
 * Gets the company name for footer text
 */
export async function getCompanyNameForFooter(): Promise<string> {
  try {
    const settings = await getCompanySettings()
    return settings.company_name
  } catch (error) {
    console.error('Error loading company name for footer:', error)
    return 'R.S.Enterprises' // Fallback
  }
}
