---
name: Search Autocomplete Engine
description: Phase 8 Step 4 implementation — real-time autocomplete with intent detection, ARIA, query_logs, and keyboard nav in Navbar.tsx.
---

## Architecture

### API side (search.ts Route 2 + search-startup.ts Phase 3)
- `query_logs` table: `id SERIAL, query TEXT, lang TEXT, result_count INT, clicked BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ`. Created in `search-startup.ts` Phase 3.
- Each `GET /api/search/suggestions?q=&lang=` call logs to `query_logs` (non-blocking, fire-and-forget async).
- Each suggestion item has: `text`, `textAr?`, `type: "suggestion" | "intent" | "subcategory"`, `meta?`.
- Intent modifiers: `cheap`/`رخيص` → price_asc intent; `best`/`أفضل` → rating intent.
- Response also includes `processingTimeMs` (measured with `Date.now()`).

### Hook side (use-search.ts)
- `SuggestionItem`: extended with `type?` and `meta?` optional fields.
- `SuggestionResult`: extended with `processingTimeMs?: number`.
- `queryFn` passes `{ signal }` (AbortController) to the fetch so stale requests abort on query change.

### Navbar.tsx hook ordering rule (CRITICAL)
The sync-items `useEffect` references both `suggestions` (from `useSearchSuggestions`) and `handleSuggestionTextClick`. Both must be declared BEFORE the useEffect in the component body.

**Correct order:**
1. State declarations (highlightedIndex, flatItemsRef, debouncedSearch, etc.)
2. `saveRecentSearch` / `clearRecentSearches` / `removeRecentSearch` callbacks
3. Reset-highlight useEffect (depends only on `debouncedSearch`)
4. Scroll-into-view useEffect (depends only on `highlightedIndex`)
5. `handleSearchKeyDown` (depends on `searchOpen`, `highlightedIndex`)
6. Data hooks: `useGetCart`, `useGetUnreadCount`, `useSearchSuggestions`, `useSearchTrending`
7. `handleSearchSubmit`, `handleSuggestionTextClick`
8. **Sync-items useEffect** ← MUST be here, after step 6 and 7

**Why:** `const` declarations are in the temporal dead zone until their line executes. If the useEffect function body or dependency array references `suggestions` before line 196 (where `useSearchSuggestions` is destructured), the browser throws `ReferenceError: Cannot access 'suggestions' before initialization` at runtime even though TypeScript compiles fine.

### Navbar.tsx ARIA + UX features
- `role="combobox"` + `aria-expanded` + `aria-autocomplete="list"` + `aria-controls="nav-search-listbox"` + `aria-activedescendant` on the `<input>`.
- Dropdown `div` has `id="nav-search-listbox"` + `role="listbox"`.
- Each row: `role="option"` + `aria-selected` + highlighted background when `highlightedIndex` matches.
- 200ms debounce on `searchQuery` → `debouncedSearch`.
- Skeleton: 3 animated `h-9` rows while `searchLoading` is true.
- Intent suggestions show amber badge label.
- Subcategory suggestions show `meta` text (e.g. "3 products") as muted secondary text.
