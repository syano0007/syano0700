---
name: TanStack Query v5 UseQueryOptions partial
description: Generated hooks must use Partial<UseQueryOptions> not UseQueryOptions to avoid requiring queryKey at call sites.
---

**Rule:** In `lib/api-client-react/src/*.ts` hook definitions, the `query` option must be typed as `Partial<UseQueryOptions<T, TError, TData>>`, not `UseQueryOptions<T, TError, TData>`.

**Why:** TanStack Query v5 made `queryKey` required in `UseQueryOptions`. Our hooks internally handle `queryKey` via `queryOptions?.queryKey ?? getDefaultKey()`, so callers shouldn't need to pass it. Using `UseQueryOptions` directly causes TS2741 errors in all consumers (mobile, marketplace) that pass options without a `queryKey`.

**How to apply:**
- Affected files: `lib/api-client-react/src/notifications.ts` (useListNotifications, useGetNotificationCount), `lib/api-client-react/src/sellers.ts` (useGetSellerReviews), and any new hooks added
- Pattern: `options?: { query?: Partial<UseQueryOptions<ReturnType, TError, TData>>; request?: RequestInit }`
- When adding new hooks: always use `Partial<UseQueryOptions>` for the `query` parameter
