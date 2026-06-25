import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { expandSearchQuery, scoreProduct } from "@/lib/search-utils";

export interface SearchProduct {
  id: number;
  sellerId: number;
  sellerName: string;
  name: string;
  description: string;
  price: number;
  discountPercent: number | null;
  finalPrice: number;
  category: string;
  subcategory: string | null;
  stock: number;
  imageUrl: string | null;
  featured: boolean;
  nameAr: string | null;
  createdAt: string;
  score: number;
}

/** A text-phrase search intent (no images, no prices). */
export interface SuggestionItem {
  text: string;
  textAr: string | null;
  /** 'intent' = smart modifier suggestion (cheap/premium), 'product' = name match, 'subcategory' = drill-down */
  type?: "intent" | "product" | "subcategory";
  /** For intent: 'price_asc'|'rating'; for subcategory: product count hint */
  meta?: string;
}

/** A category with bilingual labels. */
export interface CategoryItem {
  slug: string;
  labelEn: string;
  labelAr: string;
}

export interface SuggestionStore {
  userId: number;
  storeName: string;
  storeSlug: string | null;
  storeLogo: string | null;
  city: string | null;
}

export interface TrendingQuery {
  query: string;
  count: number;
}

/** Shape returned by GET /api/search/suggestions (v2) */
export interface SuggestionResult {
  suggestions: SuggestionItem[];
  categories: CategoryItem[];
  stores: SuggestionStore[];
  trending: TrendingQuery[];
  /** Server-side processing time in milliseconds (Step 4 telemetry) */
  processingTimeMs?: number;
}

const EMPTY_SUGGESTIONS: SuggestionResult = {
  suggestions: [],
  categories: [],
  stores: [],
  trending: [],
};

async function fetchSearchTerm(term: string, limit: number): Promise<SearchProduct[]> {
  const url = `/api/search?q=${encodeURIComponent(term)}&limit=${limit}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return [];
  return res.json() as Promise<SearchProduct[]>;
}

/**
 * Multilingual search hook (for search results page — full product list).
 *
 * Flow:
 *   1. expandSearchQuery(rawQuery) → up to 4 terms (original + AR↔EN synonyms)
 *   2. For each unique term ≥ 2 chars → GET /api/search?q=<term>
 *   3. Results are merged, deduplicated, and re-ranked.
 */
export function useSearch(rawQuery: string, { limit = 8 }: { limit?: number } = {}) {
  const terms = useMemo(
    () => (rawQuery.trim().length >= 2 ? expandSearchQuery(rawQuery) : []),
    [rawQuery],
  );

  const term0 = terms[0] ?? "";
  const term1 = terms[1] ?? "";
  const term2 = terms[2] ?? "";

  const q0 = useQuery({
    queryKey: ["search", term0, limit],
    queryFn: () => fetchSearchTerm(term0, limit),
    enabled: term0.length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const q1 = useQuery({
    queryKey: ["search", term1, limit],
    queryFn: () => fetchSearchTerm(term1, limit),
    enabled: term1.length >= 2 && term1 !== term0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const q2 = useQuery({
    queryKey: ["search", term2, limit],
    queryFn: () => fetchSearchTerm(term2, limit),
    enabled: term2.length >= 2 && term2 !== term0 && term2 !== term1,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const results = useMemo(() => {
    const all = [
      ...(q0.data ?? []),
      ...(q1.data ?? []),
      ...(q2.data ?? []),
    ];
    const seen = new Set<number>();
    return all
      .filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .sort(
        (a, b) =>
          (b.score ?? 0) - (a.score ?? 0) ||
          scoreProduct(b, rawQuery) - scoreProduct(a, rawQuery),
      );
  }, [q0.data, q1.data, q2.data, rawQuery]);

  const hasQuery = rawQuery.trim().length >= 2;

  const isLoading =
    (term0.length >= 2 && q0.isFetching) ||
    (term1.length >= 2 && term1 !== term0 && q1.isFetching) ||
    (term2.length >= 2 && term2 !== term0 && term2 !== term1 && q2.isFetching);

  return { results, isLoading, hasQuery };
}

/**
 * Marketplace-grade search suggestion hook for the Navbar overlay.
 *
 * Returns { suggestions, categories, stores, trending } — NO product cards.
 * suggestions = text intent phrases derived from real product names.
 * Implements debounce-friendly staleTime and placeholder data.
 */
export function useSearchSuggestions(rawQuery: string) {
  const dq = rawQuery.trim();
  const { data, isFetching } = useQuery<SuggestionResult>({
    queryKey: ["search/suggestions/v2", dq],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(dq)}`, {
        credentials: "include",
        signal,
      });
      if (!res.ok) return EMPTY_SUGGESTIONS;
      return res.json() as Promise<SuggestionResult>;
    },
    enabled: dq.length >= 1,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  return {
    suggestions: data ?? EMPTY_SUGGESTIONS,
    isLoading: isFetching && !data,
    hasQuery: dq.length >= 2,
  };
}

/**
 * Hook to fetch trending / popular search terms.
 */
export function useSearchTrending() {
  const { data } = useQuery<TrendingQuery[]>({
    queryKey: ["search/trending"],
    queryFn: async () => {
      const res = await fetch("/api/search/trending", { credentials: "include" });
      if (!res.ok) return [];
      return res.json() as Promise<TrendingQuery[]>;
    },
    staleTime: 5 * 60_000,
  });
  return data ?? [];
}

/**
 * Track a suggestion / category / store click for analytics.
 * Fire-and-forget — does not affect UI.
 */
export function trackSearchClick(term: string, type: "suggestion" | "category" | "store") {
  fetch("/api/search/track-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ term, type }),
    credentials: "include",
  }).catch(() => {});
}

/**
 * Record a search result click for CTR analytics.
 * Fire-and-forget — must never await this, must never delay navigation.
 */
export function recordSearchClick(searchLogId: number): void {
  if (!searchLogId) return;
  fetch("/api/search/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchLogId }),
  }).catch(() => {});
}
