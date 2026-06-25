---
name: Search Intent System
description: Intent modifier groups, parseIntent pitfalls, dialect dict key normalization, effectiveSort chain — audit-verified June 2026.
---

# Search Intent System — Audit-Verified

## INTENT_MODIFIERS groups (5 total)
- `cheap`: رخيص, لقطة, ببلاش, على قد الايد, اقتصادي, حرق, تنزيلات, عروض, كسر, cheap, budget, affordable, discount, sale, offer, bargain
- `premium`: غالي, فخم, فاخر, اصلي, نخب اول, ماركة, براند, ملوكي, ممتاز, وكالة, premium, luxury, branded, original, authentic, high-end, professional
- `used`: مستعمل, شغال, نضيف, نص عمر, بحالة الوكالة, used, second hand
- `rating`: أفضل تقييم (phrase!), best rated (phrase!), recommended, trusted, most popular (phrase!), موثوق, مضمون, أكثر مبيعاً, الأكثر طلباً
- `newest`: جديد, أحدث, حديث, latest, newest, just arrived (phrase!), new arrival (phrase!), 2025, 2026

## effectiveSort chain (order matters)
```
cheap → price_asc
premium → rating
rating (if not premium) → rating
newest → newest
else → sortBy param
```

## parseIntent pitfall — multi-word phrases
`tokens.some(t => normWords.includes(t))` only matches SINGLE tokens.
Multi-word entries like `"أفضل تقييم"` or `"best rated"` NEVER matched.
**Fix**: also check `normWords.some(w => w.includes(" ") && norm.includes(w))`.

## parseIntent pitfall — taa-marbouta dict keys
Dict keys with `ة` (U+0629) fail direct lookup because normalized tokens use `ه` (U+0647).
E.g. dict key `"موبايلة"` → normalized token `"موبايله"` → `SYRIAN_DIALECT_DICTIONARY["موبايله"]` = undefined.
**Fix**: pre-build `DIALECT_NORM_MAP = new Map(Object.entries(SYRIAN_DIALECT_DICTIONARY).map([k,v] => [normalizeArabic(k), v]))` and use `DIALECT_NORM_MAP.get(token)` for single-word lookups.

**Why:** The normalizer (normalizeArabicText) maps ة→ه and أإآ→ا. Dict keys are raw Arabic. Normalized tokens never match raw keys with these chars.

**How to apply:** Any time you add a new entry to SYRIAN_DIALECT_DICTIONARY with ة, إ, أ, آ in the key, it will silently fail the single-token lookup. Use the DIALECT_NORM_MAP pattern.

## DIALECT_NORM_MAP (multi-word keys handled separately)
Multi-word keys (key.includes(" ")) are matched via `norm.includes(normalizeArabic(key))` at lines ~158-165 — this was already correct before the audit. Only single-word taa-marbouta keys were broken.

## Autocomplete intent suggestions (extended)
rating modifier → `addSuggestion("best rated {cat}", "أعلى {cat} تقييماً", "intent", "rating")`
newest modifier → `addSuggestion("newest {cat}", "أحدث {cat}", "intent", "newest")`
(both deduplicated vs premium's "top rated" suggestion)

## Audit performance (June 2026)
- GIN Bitmap Index Scan: 0.893ms ✅ (vs Seq Scan for ILIKE)
- 20 consecutive /suggestions: avg=4ms max=6ms ✅
- 10 concurrent /results: max=48ms 0 errors ✅
- All 21 FTS category queries return results ✅
- processingTimeMs present in 100% of suggestion responses ✅
