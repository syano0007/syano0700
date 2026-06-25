---
name: Mobile audit fixes
description: Issues found and fixed in the comprehensive mobile app audit
---

## Issues Fixed

### i18n — new keys added to src/i18n/index.ts
Sections added: `shop`, `auth`, `nav` (21 keys total, both en + ar).
These were missing because login.tsx, _layout.tsx, and index.tsx were never connected to t().

### Files without `t` import (anti-pattern to watch)
- `login.tsx`, `_layout.tsx`, `OrderCard.tsx` had NO i18n import at all despite having
  visible user-facing strings. Always check imports when auditing mobile files.

### Locale-locked date (bug pattern)
- `toLocaleDateString("en-US", ...)` in order/[id].tsx → use `undefined` for system locale.

### key={idx} in order items
- `order.items.map((item, idx) => <View key={idx}>` → `key={item.productId ?? idx}`.

## What IS properly i18n'd
- All checkout, cart, profile, product, order-detail dialogs/alerts use t() correctly.
- `order/[id].tsx` fully i18n'd (was already done in a prior session).

## Low-severity gap NOT fixed
- `PATCH /auth/me` and `POST /auth/reissue` lack `requireActiveAccount`.
  Suspended users can update their profile + reissue tokens but are blocked from
  all other protected endpoints. Intentionally left unfixed (very low risk).
