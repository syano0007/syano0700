/**
 * Feature flags — centralized on/off switches for features not yet launched.
 *
 * To re-enable returns/refunds:
 *   Set RETURNS_ENABLED = true
 *
 * To re-enable account verification (email / phone OTP):
 *   Set EMAIL_VERIFICATION_ENABLED = true
 *   Set PHONE_VERIFICATION_ENABLED = true
 *   Backend: set env vars ENABLE_EMAIL_VERIFICATION=true / ENABLE_PHONE_VERIFICATION=true
 *
 * All backend logic, APIs, and database structures remain intact.
 */
export const FEATURES = {
  RETURNS_ENABLED: false,
  EMAIL_VERIFICATION_ENABLED: false,
  PHONE_VERIFICATION_ENABLED: false,
} as const;
