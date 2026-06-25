---
name: Seller application redirect race condition
description: Why the status page bounced users back to the apply form after a successful submission, and the pattern used to fix it.
---

## The Rule

After any mutation that navigates away and the destination page shares the same query key, **seed the cache before navigating** AND **guard redirects with `!isFetching`**.

## What Happened

`apply.tsx` → `POST /seller-applications` → success:
1. `invalidateQueries(["seller-application","my"])` — marks cache stale but keeps old value (`null`)
2. `navigate("/seller/application-status")`

`application-status.tsx` mounts:
- Cache value = `null` (stale), `isLoading=false`, `isFetching=true`
- Guard: `if (!isLoading && application === null)` → **true** → bounced back to `/seller/apply`

React Query `isLoading` is only `true` on the very first fetch (status=`pending`). During a background refetch, `isLoading=false` even though data is stale.

## The Fix (applied June 2026)

**`apply.tsx` `onSuccess`:**
```js
onSuccess: (newApp) => {
  queryClient.setQueryData(["seller-application", "my"], newApp); // seed first
  queryClient.invalidateQueries({ queryKey: ["seller-application", "my"] });
  navigate("/seller/application-status");
}
```

**`apply.tsx` post-success guard:**
```js
if (submitMutation.isSuccess) return <Layout><Skeleton /></Layout>;
```

**`application-status.tsx` redirect guard:**
```js
const { data: application, isLoading, isFetching, refetch } = useQuery(...);
useEffect(() => {
  if (!isLoading && !isFetching && application === null) navigate("/seller/apply");
}, [application, isLoading, isFetching]);
```

**`application-status.tsx` skeleton guard:**
```js
if (isLoading || application === undefined || (isFetching && application === null)) {
  return <Skeleton />;
}
```

**Why:** `isFetching` is true during any background refetch. Without this guard, a stale `null` in the cache while the real data is loading causes an immediate redirect.

**How to apply:** Any time a page has a "redirect if data is null" guard AND that data can be invalidated by a prior page, check both `isLoading` and `isFetching` before redirecting. Always seed the cache from the mutation response before invalidating.
