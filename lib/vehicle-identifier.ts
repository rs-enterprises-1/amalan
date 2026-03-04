import { Vehicle } from './database.types'
import { getCompanySettings } from './settings'

/**
 * Gets the display identifier for a vehicle.
 * If Sri Lanka purchase is enabled and buy_currency is 'LKR', returns registration_no.
 * Otherwise, returns chassis_no.
 */
export async function getVehicleIdentifier(vehicle: Vehicle): Promise<string> {
  const settings = await getCompanySettings()
  
  if (settings.enable_sri_lanka_purchase && vehicle.buy_currency === 'LKR') {
    // For Sri Lanka purchases, use registration_no if available, otherwise fallback to chassis_no
    return (vehicle as any).registration_no || vehicle.chassis_no
  }
  
  return vehicle.chassis_no
}

/**
 * Gets the display label for the vehicle identifier.
 * Returns "Registration No" for LKR purchases, "Chassis Number" otherwise.
 */
export async function getVehicleIdentifierLabel(vehicle: Vehicle): Promise<string> {
  const settings = await getCompanySettings()
  
  if (settings.enable_sri_lanka_purchase && vehicle.buy_currency === 'LKR') {
    return 'Registration No'
  }
  
  return 'Chassis Number'
}

/**
 * Synchronous version that uses cached settings.
 * Use this in components that already have settings loaded.
 */
export function getVehicleIdentifierSync(vehicle: Vehicle, enableSriLankaPurchase: boolean): string {
  if (enableSriLankaPurchase && vehicle.buy_currency === 'LKR') {
    return (vehicle as any).registration_no || vehicle.chassis_no
  }
  
  return vehicle.chassis_no
}

/**
 * Synchronous version for label.
 */
export function getVehicleIdentifierLabelSync(vehicle: Vehicle, enableSriLankaPurchase: boolean): string {
  if (enableSriLankaPurchase && vehicle.buy_currency === 'LKR') {
    return 'Registration No'
  }
  
  return 'Chassis Number'
}
