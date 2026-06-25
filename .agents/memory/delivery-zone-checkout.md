---
name: Delivery zone checkout flow
description: How delivery zones are integrated into the checkout on web (marketplace) and mobile.
---

## Architecture

- `GET /delivery-zones` returns active zones `{id, nameEn, nameAr, fee}[]` — consumed by `useGetDeliveryZones` hook in `lib/api-client-react/src/delivery-zones.ts`.
- Client sends `zoneId` (optional integer) in `POST /orders` body.
- Server validates zone active/exists **before** the transaction, computes `resolvedZoneFee`, adds it to total. Client fee is never trusted.
- `zoneId` and `deliveryFee` saved in orders table; `buildOrderResponse` fetches `zoneNameEn`/`zoneNameAr` in its parallel Promise.all.

## Marketplace (web) checkout
- City text input **replaced** by Radix `<Select>` zone picker; city auto-set from zone name at submit time.
- Zone validation required before proceeding to step 3.
- Sidebar total shows `cart.total + selectedZone.fee`; shipping row shows actual fee or "Free".
- Step 3 delivery summary shows zone name + fee chip.
- i18n keys: `checkout.zone_label`, `checkout.zone_placeholder`, `checkout.zone_required`, `checkout.zone_required_desc`, `checkout.delivery_fee_label`, `checkout.free_delivery`.

## Mobile checkout
- City `TextInput` removed; replaced by a Pressable button that opens a `<Modal presentationStyle="pageSheet">` with a `FlatList` of zones.
- Zone modal shows zone name (en/ar via `getLocale()`) + fee or "Free delivery" label.
- Grand total = cart total + delivery fee; shown in both the step 2 card and the sticky bottom bar.
- Arabic mobile i18n keys match English keys above (under `checkout.*`).

## Order detail page (web)
- Shows `zoneNameEn`/`zoneNameAr` (from API response) with `Truck` icon above address.
- Falls back to `order.city` text for orders placed before zones existed.
- Delivery fee shown inline as `· $X.XX` suffix on zone name.

**Why:** Fee must be server-resolved (not client-trusted) to prevent manipulation. Zone is required before order submission so every order has a valid delivery area.
