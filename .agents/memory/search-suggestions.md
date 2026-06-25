---
name: Search & Discovery Engine V2
description: Syrian Dialect Dictionary + Intent Modifiers + 4-tier scoring. Covers all three search endpoints and common DB schema pitfalls.
---

## Rule
`GET /api/search/suggestions?q=<term>` returns `{ suggestions[], categories[], stores[], trending[] }` — never product images or prices.
`GET /api/search/results?q=<term>` is the full paginated, tier-weighted, intent-aware endpoint.

**Why:** UX spec: text-intent phrases only in dropdown (Amazon/Noon behavior). Product results with scoring live on `/api/search/results`.

## How to apply

### DB schema pitfalls (critical, not obvious from code)
- `users.account_status = 'active'` — NOT `u.status`. Column is `account_status` (text, default 'active').
- `products` table has NO `is_best_deal` column — compute from `discount_percent >= 20`.
- `products.search_tokens` (text) — exists and is GIN-indexed for trgm (`products_tokens_trgm`).
- `product_variants` table: `product_id`, `sku`, `price_adjustment`, `stock`, `active`. No `name`/`attributes` columns.
- `reviews` table: `product_id`, `user_id`, `rating`, `comment`. NOT `reviewer_id`.

### Null parameter type inference (PostgreSQL)
PostgreSQL cannot infer type of NULL params in raw SQL. Always cast nullable params with `::text`:
```sql
-- WRONG (fails with "could not determine data type of parameter $N")
WHERE $3 IS NOT NULL AND lower(p.category) = $3

-- CORRECT
WHERE $3::text IS NOT NULL AND lower(p.category) = $3::text
```
This applies to ALL nullable params passed to `pool.query()` including dialect-mapped category.

### Intent pipeline (parseIntent)
```ts
parseIntent(rawQuery) → { modifiers, mappedCategory, expandedTerms, baseTokens, expandedQuery }
```
- SYRIAN_DIALECT_DICTIONARY: 55+ entries; keys are Syrian colloquial Arabic words; values have `category` (exact DB slug) + `keywords[]` (expansion terms)
- DB category slugs: "Fashion", "Electronics", "Home & Kitchen", "Beauty & Personal Care", "Supermarket & Grocery" etc.
- INTENT_MODIFIERS: cheap/premium/used. cheap → sort price_asc. premium → sort rating DESC. used → adds LIKE '%مستعمل%' WHERE clause.
- `makeParamBuilder()` — positional `$N` parameter builder: `const pb = makeParamBuilder(); const p1 = pb.add(val); pool.query(sql, pb.values)`

### 4-Tier Scoring (GET /api/search/results)
```sql
GREATEST(
  -- Tier A (1.0): Dialect-mapped category exact match
  CASE WHEN $cat::text IS NOT NULL AND lower(p.category) = $cat::text THEN 1.00 ELSE 0 END,
  -- Tier B (0.6): title/title_ar fuzzy match via pg_trgm
  word_similarity($term, lower(p.name)) * 0.60,
  CASE WHEN lower(p.name) LIKE $like THEN 0.75 ELSE 0 END,
  -- Tier C (0.3): search_tokens / expanded dialect keywords
  word_similarity($expanded, lower(COALESCE(p.search_tokens,''))) * 0.30,
  -- Tier D (0.1): description
  word_similarity($term, lower(p.description)) * 0.10
) AS score
```
Strict seller gate: `INNER JOIN users u ON u.id=p.seller_id AND u.account_status='active'` + `INNER JOIN seller_applications sa ON sa.user_id=p.seller_id AND sa.status='approved'`.

### Frontend hook (use-search.ts)
- `useSearchSuggestions(rawQuery)` → `{ suggestions: SuggestionResult, isLoading, hasQuery }`
- `SuggestionResult` = `{ suggestions: SuggestionItem[], categories: CategoryItem[], stores: SuggestionStore[], trending: TrendingQuery[] }`
- Query key: `["search/suggestions/v2", dq]` — v2 suffix avoids stale cache from old shape
- `trackSearchClick(term, type)` — exported from use-search.ts, fire-and-forget

### GET /api/search/results response shape
```ts
{
  results: ProductResult[],  // paginated
  total: number,
  page: number,
  limit: number,
  totalPages: number,
  intent: { modifiers: string[], mappedCategory: string|null, expandedTerms: string[] }
}
```
Query params: `q`, `page` (def 1), `limit` (def 20 max 50), `category`, `priceMin`, `priceMax`, `sortBy` (relevance|price_asc|price_desc|newest|rating).

### Navbar guard pattern (HMR-safe)
Every access to `suggestions.*` uses null-coalescing:
```tsx
(suggestions.suggestions?.length ?? 0) > 0
(suggestions.suggestions ?? []).slice(0, 6).map(...)
```
**Why:** HMR can leave stale TanStack Query data with old shape. `// @refresh reset` in Navbar.tsx but is insufficient alone.

### Test results (June 2026)
- `?q=سماعات` → count:10, score:1, Sony headphones first ✓
- `?q=موبايل` suggestions → 6 phrases, cats:[إلكترونيات], first: هواتف ذكية ✓ (dialect expansion)
- `/results?q=بواط` → total:22, 2 pages, intent.mappedCategory:"Fashion", expandedTerms:[أحذية,...] ✓
- `/results?q=رخيص موبايل` → modifiers:['cheap'], prices sorted ASC ✓ (intent modifier overrides sort)
- `/results?q=laptop&sortBy=rating` → ratings:[5,5,4] sorted DESC, hasVariants+isBestDeal fields present ✓
- Pagination: total:26, limit:3, totalPages:9 ✓
