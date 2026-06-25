import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  listProducts,
  getListProductsQueryKey,
  getPublicSettings,
  getGetPublicSettingsQueryKey,
  getBestSellers,
  getGetBestSellersQueryKey,
  getCart,
  getGetCartQueryKey,
} from "@workspace/api-client-react";

/**
 * Silently prefetches both JS chunks and API data during the browser's idle
 * time, so navigation and data rendering both feel instant.
 *
 * Three tiers — all fire via requestIdleCallback so they never compete with
 * the initial render:
 *
 *   Tier 1 (2 s budget) — JS chunks for public routes visited by nearly everyone
 *   Tier 2 (4 s budget) — role-specific JS chunks (read role from localStorage)
 *   Tier 3 (6 s budget) — API data for the hottest queries (products, settings,
 *                          best-sellers, cart). Warms the TanStack Query cache so
 *                          the first render of each page is instant from cache.
 */
export function RoutePreloader() {
  const queryClient = useQueryClient();

  useEffect(() => {
    /* ── Tier 1: public JS chunks ─────────────────────────────────── */
    const tier1 = () => {
      // Home is now eagerly imported in App.tsx — no separate chunk exists.
      void import("@/pages/products");
      void import("@/pages/products/[id]");
      void import("@/pages/login");
      void import("@/pages/register");
    };

    /* ── Tier 2: role-specific JS chunks ──────────────────────────── */
    const tier2 = () => {
      try {
        const userStr =
          localStorage.getItem("user") ?? sessionStorage.getItem("user");
        if (!userStr) return;
        const user = JSON.parse(userStr) as { role?: string };
        const role = user?.role;

        if (role === "customer") {
          void import("@/pages/cart");
          void import("@/pages/checkout");
          void import("@/pages/orders");
          void import("@/pages/customer/dashboard");
        } else if (role === "seller") {
          void import("@/pages/seller/dashboard");
          void import("@/pages/seller/products");
          void import("@/pages/seller/orders");
        } else if (role === "admin") {
          void import("@/pages/admin/index");
          void import("@/pages/admin/users");
          void import("@/pages/admin/products");
          void import("@/pages/admin/orders");
        }
      } catch {
        // ignore parse errors
      }
    };

    /* ── Tier 3: API data prefetch ────────────────────────────────── */
    const tier3 = () => {
      /* Public settings — needed by CurrencyContext and the home page.
         staleTime matches the one in CurrencyProvider (30 min). */
      queryClient.prefetchQuery({
        queryKey: getGetPublicSettingsQueryKey(),
        queryFn:  () => getPublicSettings(),
        staleTime: 30 * 60 * 1000,
      }).catch(() => {});

      /* Products list — powers the home page and products page.
         IMPORTANT: must use getListProductsQueryKey({}) with an explicit empty
         object, not getListProductsQueryKey() with no args. The two produce
         different cache keys (['/api/products', {}] vs ['/api/products']), and
         home.tsx + App.tsx both use the {} form. */
      queryClient.prefetchQuery({
        queryKey: getListProductsQueryKey({}),
        queryFn:  () => listProducts({}),
        staleTime: 3 * 60 * 1000,
      }).catch(() => {});

      /* Best sellers — home page section. */
      queryClient.prefetchQuery({
        queryKey: getGetBestSellersQueryKey(4),
        queryFn:  () => getBestSellers(4),
        staleTime: 5 * 60 * 1000,
      }).catch(() => {});

      /* Cart — only if the user is authenticated (token present).
         getCart returns 401 for guests; prefetchQuery silently ignores errors. */
      const token =
        localStorage.getItem("token") ?? sessionStorage.getItem("token");
      if (token) {
        queryClient.prefetchQuery({
          queryKey: getGetCartQueryKey(),
          queryFn:  () => getCart(),
          staleTime: 60 * 1000,
        }).catch(() => {});
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id1 = requestIdleCallback(tier1, { timeout: 2000 });
      const id2 = requestIdleCallback(tier2, { timeout: 4000 });
      const id3 = requestIdleCallback(tier3, { timeout: 6000 });
      return () => {
        cancelIdleCallback(id1);
        cancelIdleCallback(id2);
        cancelIdleCallback(id3);
      };
    } else {
      const t1 = setTimeout(tier1, 1500);
      const t2 = setTimeout(tier2, 3500);
      const t3 = setTimeout(tier3, 5500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [queryClient]);

  return null;
}
