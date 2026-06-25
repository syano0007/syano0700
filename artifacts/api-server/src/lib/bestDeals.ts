/**
 * Centralized Best Deals utility.
 *
 * A product qualifies as a "Best Deal" only when its discount percentage
 * meets or exceeds BEST_DEALS_THRESHOLD (default: 15%).
 *
 * All product listing/search/home/recommendation endpoints MUST use
 * isBestDeal() — no inline logic allowed.
 */

const raw = parseFloat(process.env.BEST_DEALS_THRESHOLD ?? "15");
export const BEST_DEALS_THRESHOLD: number = Number.isFinite(raw) && raw >= 0 ? raw : 15;

/**
 * Returns true when discountPercent meets the Best Deals threshold.
 * Works with both the stored discountPercent field and computed values.
 */
export function isBestDeal(discountPercent: number | null | undefined): boolean {
  if (discountPercent == null) return false;
  return discountPercent >= BEST_DEALS_THRESHOLD;
}
