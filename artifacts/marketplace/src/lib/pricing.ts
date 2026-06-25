/**
 * Shared pricing utilities — single source of truth for all consumer-facing
 * discount percentage calculations across the marketplace.
 *
 * Rule: every UI that shows a "% off" badge MUST use calculateDiscountPercent().
 * Never use product.discountPercent directly in consumer-facing discount badges.
 */

/**
 * Calculate discount percentage from original and sale price.
 * Returns an integer (Math.round). Returns 0 if no discount or invalid input.
 *
 * @example calculateDiscountPercent(1131, 1078.97) → 5
 */
export function calculateDiscountPercent(
  originalPrice: number | null | undefined,
  salePrice: number | null | undefined
): number {
  if (!originalPrice || !salePrice || originalPrice <= 0 || salePrice >= originalPrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}
