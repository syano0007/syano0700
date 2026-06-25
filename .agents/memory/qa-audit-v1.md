---
name: QA Audit V1 patterns
description: 7 bugs found and fixed during the delivery system QA audit; recurring anti-patterns to watch for in future work.
---

## Anti-patterns found in delivery system rollout

### Pattern 1: New status values not propagated everywhere

When the delivery system added 9 new order statuses, multiple places only updated partially:
- `GET /api/orders` list mapper didn't include new fields (BUG-001)
- `GET /api/admin/orders` list mapper didn't include new fields (BUG-002)
- Customer orders "Active" tab filter only listed old statuses (BUG-003)
- `getStatusBadge()` switch had no cases for new statuses (BUG-004)
- `PATCH /admin/orders/:id/status` validated against old 6-status list (BUG-006)
- Seller dashboard `ordersByStatus` computed counts for only 5 old statuses (BUG-007)

**Rule:** When adding new enum values (order statuses, notification types, etc.), always grep for every place the old list appears and update ALL of them. Key locations: API mappers, frontend status filters, frontend badge renders, admin status update endpoints, dashboard stat queries.

### Pattern 2: Role-specific access control gaps in shared routes

`GET /orders/:id` served customer, seller, admin, and courier roles through one handler but only had ownership checks for customer and seller. Courier was implicitly allowed to read any order. (BUG-005)

**Rule:** Every shared route that handles multiple roles must have an explicit ownership/assignment check for EVERY role. Couriers need to be checked against `courierAssignmentsTable`. Don't rely on "only assigned couriers will call this" — enforce it.

### Pattern 3: Admin status endpoints left with stale transition tables

The general orders route (`/orders/:id/status`) was updated for V1 delivery flow, but the admin-specific override route (`/admin/orders/:id/status`) kept the old 6-status hardcoded table and strict forward-only transitions. (BUG-006)

**Rule:** Admin override routes should accept ANY valid status (admins fix stuck orders), with only terminal-state guards (e.g., can't change from `refunded`). Never copy seller/courier strict transitions into admin routes.

### Pattern 4: TypeScript `never[]` from conditional Promise.resolve([])

`Promise.resolve([])` infers `Promise<never[]>` which breaks array type union. (Fixed in admin.ts)

**Fix pattern:** Use `Promise.resolve([] as SpecificType[])` or declare `type T = ...$inferSelect; ... Promise.resolve([] as T[])`.

### Pattern 5: notifMap type errors with notification enum

When building a `Record<string, { type: ... }>` notification map, the `type` field needs to match the exact literal union from the DB enum. Use:
```typescript
type NotifType = Parameters<typeof createNotification>[0]["type"];
const notifMap: Record<string, { type: NotifType; ... }> = { ... };
```

## Verified-safe areas (no bugs found)

- Admin router protection: `router.use("/admin", requireAuth, requireRole("admin"))` at line 74 covers ALL admin routes correctly
- Password hash exposure: none — `usersTable` selects never include `passwordHash`
- Messaging access control: properly checks `conv.customerId !== userId && conv.sellerId !== userId`
- Notification endpoints: POST /notifications/read-all and POST /notifications/:id/read both correct
- Search SQL injection: uses parameterized Drizzle queries — safe
- Product detail/list: imageUrls, hasVariants, isBestDeal all correctly returned
- Customer cross-order access: correctly blocked by `eq(ordersTable.customerId, userId)` filter
- Admin can read any order by design (no bug)
- Mobile i18n: all 15 order status keys present in en + ar bundles
- Mobile cancel policy: matches API (allows up to ready_for_pickup, blocks at courier_assigned+)
- Seller data isolation: `GET /orders?role=seller` correctly filters by seller's product items only
- Public /settings: only returns exchangeRate + flashSaleEnd — no sensitive data
