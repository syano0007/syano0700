---
name: Store Settings V3 + Trust Consistency
description: V3 upgrades — icon card nav, completion engine, trust consistency, public Contact/Policies tabs, fake delivery metric fix.
---

## Nav redesign
- Desktop: 4-column icon card grid (`grid-cols-2 sm:grid-cols-4`), each card has icon + label
- Mobile: horizontal chip scroll (`flex overflow-x-auto gap-2 scrollbar-none`), same sections

## Store Completion engine
- `computeCompletion(app)` returns `{ pct, missing[] }` based on 10 weighted fields
- Banner shown above nav with progress bar when `pct < 100`
- i18n keys: `store_settings.completion_title/subtitle`

## Weighted Health score
- `computeHealth(data)` accumulates `passedPts` from items each worth 1–20 pts; total=100
- Each `HealthItem` has `pts` field shown as `+N pts` gain
- Trust tab maps `data.liveBreakdown?.total` (NOT `data.trustScore` cached)

## Trust metric fix
- `trustScore.ts`: `deliverySuccessPts` was `? 10` (always true), fixed to `? 0` for brand-new sellers with no delivery history

## Public store Contact + Policies tabs
- `store/[slug].tsx` Tab type extended: `"contact" | "policies"`
- `hasContact` / `hasPolicies` booleans derived from `storeExt`; tabs only appear when truthy
- `ContactTab`: links for phone/email/website/whatsapp/telegram/facebook/instagram
- `PoliciesTab`: accordion-style cards for shipping/return/warranty/privacy policies
- `AboutTab`: removed hardcoded policy text section (now lives in dedicated tab)

## API
- `GET /sellers/store/:slug` SELECTs and returns: `contactPhone, contactEmail, whatsapp, telegram, facebook, instagram, shippingPolicy, returnPolicy, warrantyPolicy, privacyPolicy`

## Recovery check additions (checkStorePages)
- Verifies all 6 contact fields and 4 policy fields present in store profile response
- Failures (not warnings) if missing

## Recovery check additions (checkStoreSettings)
- Verifies `liveBreakdown` usage, completion engine, weighted health (`passedPts`)
- Verifies `ContactTab` and `PoliciesTab` exist in `[slug].tsx`
- Roadmap entry: `Store Settings V3 + Trust Consistency Audit`

## i18n
- 18 new keys in both en.json and ar.json; perfectly balanced at 2468 keys each
- New namespaces: `store_settings.completion_*`, `store.tab_contact`, `store.tab_policies`, `store.contact_*`, `store.policy_label_*`, `store.no_contact_info`, `store.no_policies`
