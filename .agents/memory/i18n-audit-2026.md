---
name: i18n audit June 2026
description: Full pass replacing all lang==="ar" ternaries with t() calls; documents what was fixed and the patterns to avoid.
---

## What was fixed

**Files fully cleaned:**
- `Navbar.tsx` — searching…, recent searches, clear all, SYP button `dir="ltr"`, tagline, preferences
- `AdminLayout.tsx` — preferences label, drawer width 80vw→70vw
- `admin/index.tsx` — health score labels (excellent/needs_attention/action_required/loading), metric row `key` prop
- `admin/settings.tsx` — Commission Rate, Hot Deals, Announcement sections
- `admin/logs.tsx` — TARGET_TYPE_LABELS removed, inline t() used
- `orders/index.tsx` — STATUS_TABS module-level constant converted to labelKey+t() inside component
- `products/index.tsx` — price range, load more, all shown, all categories, hot deals, exclusive discounts, clear search, count
- `seller/apply.tsx` — draft saved toast, save failed toast, status banners, categories_selected, save_draft/saving button
- `seller/application-status.tsx` — continue app, withdraw confirm, withdrawing, yes_withdraw, cancel, withdraw

**Keys added to en.json / ar.json (1476 total):**
- `orders.tab_all`, `orders.tab_active`, `orders.empty_filtered`
- `products.price_range`, `products.load_more`, `products.all_shown`, `products.count`, `products.hot_deals`, `products.exclusive_discounts`, `products.clear_search`, `products.all_categories`
- `nav.searching`, `nav.recent_searches`, `nav.clear_all`, `nav.tagline`, `nav.preferences`
- `common.all`, `common.active`, `common.searching`, `common.cancel`
- `seller.draft_label`, `seller.continue_app`, `seller.withdraw_confirm`, `seller.withdrawing`, `seller.yes_withdraw`, `seller.withdraw`, `seller.draft_saved`, `seller.save_failed`, `seller.draft_saved_banner`, `seller.rejected_banner`, `seller.categories_selected`, `seller.saving`, `seller.save_draft`
- `admin.health_*` (6 keys), `admin.commission_*`, `admin.hot_deals_*`, `admin.announcement_*`, `admin.target_*`

## Patterns that are always bugs

1. `{lang === "ar" ? "Arabic" : "English"}` in JSX → always replace with `t("section.key")`
2. Module-level arrays with `label: "English"` hardcoded → move inside component, use `labelKey: "section.key"` + `t(labelKey)` at render
3. `const TABS = [{label: "All"}, ...]` at module level → rename to `TAB_KEYS = [{labelKey: "orders.tab_all"}, ...]`

## Patterns that are intentionally NOT translated

- `lang === "ar" ? "ar-SY" : "en-GB"` — locale code for `toLocaleDateString()`, correct
- `lang === "ar" ? "en" : "ar"` — language code argument to `switchLanguage()`, correct
- `t("key", { defaultValue: lang === "ar" ? "..." : "..." })` — fallback inside t(), acceptable
- SEO meta title/description strings in `useMemo` — English-only meta is acceptable

## RTL/dir fixes

- Currency button in Navbar needs `dir="ltr"` on the `<Button>` so `ل.س SYP` renders correctly in English mode
- Admin sidebar SheetContent: `w-[min(260px,70vw)]` (was 280px/80vw — too wide on small phones)
