---
name: Store Settings V4 + Store Page Consistency
description: V4 upgrades — mobile 2-col card grid, desktop card descriptions, completion banner redesign, health Fix-Now buttons, select.tsx RTL fix, storeSettingsV4 recovery module (weight=0).
---

## Nav redesign (V4)
- **Mobile**: replaced horizontal chip scroll → `grid grid-cols-2 gap-2 sm:hidden` — each card has icon (7×7) + title + description (`tab_desc_*` key), min-h-[76px], badge in top-end corner
- **Desktop**: 4-col grid unchanged structure but now has description subtitle (`tab_desc_*` key) below each card title; added `group-hover` icon color + `hover:bg-muted/20`; `transition-all duration-200` animations; `active:scale-[0.98]`

## TABS type
- Added `descKey: string` field to each tab in the `TABS` array
- 8 new i18n keys: `store_settings.tab_desc_{general|branding|contact|policies|trust|seo|health|advanced}`

## Completion banner (V4)
- Left side: uppercase label `completion_title`, giant `{score}% Complete` (`text-3xl font-black`), `h-2.5` progress bar
- Right side: `sm:min-w-[210px]`, "Missing:" header, up to 4 missing items as `button` rows (CheckCircle2 + label + `+Npts` badge) each clicking into that tab; full-width `bg-primary` "Complete Now" button at bottom
- New i18n keys: `completion_complete`, `completion_missing`, `completion_cta`

## Health tab (V4)
- Completed items show green ✓ on right instead of nothing
- Incomplete items show: `+Npts` pill (hidden on mobile) + `bg-primary/10` "Complete Now" button with ChevronRight; clicking navigates to that tab via `setActiveTab(item.tab)`
- Row hover: `hover:bg-muted/30` transition
- Summary line in score card: `X/Y completed · score/100 pts`

## RTL fix (select.tsx)
- `pl-2 → ps-2`, `pr-8 → pe-8`, `right-2 → end-2` in SelectItem className

## Recovery module (storeSettingsV4)
- `checkStoreSettingsV4()` function — weight=0 (no score deduction)
- 9 data points checked: settingsPageExists, mobileCardGrid, desktopDescriptions, completionCtaPresent, cardAnimations, healthFixNowButton, selectRtlFixed, trustHowToImprove, i18nV4KeysPresent
- All 9 pass → ok=true, 0 warnings in production
- Module runs in parallel with other 16 checks → total 17/17 modules, score stays 100/100
- Roadmap entry: `"Store Settings V4 + Store Page Consistency": "✅ COMPLETE + VALIDATED"`

## i18n (V4 additions)
- `tab_desc_general/branding/contact/policies/trust/seo/health/advanced` + `completion_complete/missing/cta`
- Added to both `en.json` and `ar.json` in the `store_settings` block after existing tab_* keys
