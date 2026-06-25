/* Shared location-related localStorage utilities */
export const ZONE_KEY   = "syano_selected_zone";
export const COORDS_KEY = "syano_location_coords";
export const ADDR_KEY   = "syano_delivery_address";

export interface LocationCoords { lat: number; lng: number }

export function loadSavedCoords(): LocationCoords | null {
  try { return JSON.parse(localStorage.getItem(COORDS_KEY) || "null"); } catch { return null; }
}

export function loadSavedZoneId(): number | null {
  try { return JSON.parse(localStorage.getItem(ZONE_KEY) || "null"); } catch { return null; }
}

/**
 * Purge ALL location-related cache keys from both localStorage and sessionStorage.
 * Called on logout so the next user/guest sees a clean "اختر موقعك..." state.
 */
export function clearLocationStorage(): void {
  const keys = [ZONE_KEY, COORDS_KEY, ADDR_KEY];
  for (const key of keys) {
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(key); } catch {}
  }
}
