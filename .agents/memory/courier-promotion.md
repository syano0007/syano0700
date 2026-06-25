---
name: Courier promotion flow
description: How users apply to become couriers, admin approval path, role promotion mechanics, and notification redirect fix
---

# Courier Promotion Flow

## Role enum
"courier" was added to the `pgEnum("role", ...)` in `lib/db/src/schema/users.ts`.
The DB migration runs `ALTER TYPE role ADD VALUE IF NOT EXISTS 'courier'` in `run-migrations.ts` (outside a transaction block, guarded with try/catch since it requires non-transaction execution).

## Application flow
1. Customer → `/courier/apply` (ProtectedRoute allowedRoles=["customer"])
   - On mount: fetches GET /api/couriers/profile; if profile exists → redirect to /courier/application-status
   - Submits POST /api/couriers/apply; on 409 → redirect to status
2. Customer views `/courier/application-status` (any auth role)
   - Fetches GET /api/couriers/profile, shows pending/approved/rejected/suspended states
   - If status=approved and role≠"courier": calls `refreshAuth()` from AuthContext to reissue JWT, then navigates to /courier/dashboard
   - If status=approved and isCourier already: navigates directly to /courier/dashboard
3. Admin approves via PATCH /api/admin/couriers/:id with status="approved"
   - Server sets `usersTable.role = "courier"` + sends in-app notification WITH `link: "/courier/application-status"`
   - The link field triggers navigation in NotificationCenter.tsx handleClick (checks `(n as any).link`)
   - application-status.tsx auto-runs refreshAuth() + navigate("/courier/dashboard") → feels instant
4. Admin reactivates a suspended courier (same approved PATCH path)
   - Also sends notification WITH `link: "/courier/application-status"`
5. Admin rejects via status="rejected"
   - Server ensures `usersTable.role = "customer"` (no-op for pending) + sends notification (no link)
6. Courier accesses `/courier/dashboard` (ProtectedRoute allowedRoles=["courier","admin"])

## Notification instant-access fix (June 2026)
**Problem:** Approval notification had no `link` field → clicking notification went nowhere useful.
**Fix:** `createNotification()` call in `PATCH /api/admin/couriers/:id` now always sets `link: "/courier/application-status"` for both approval and reactivation notifications.
**How it works:** application-status.tsx useEffect fires immediately on mount; if status=approved and !isCourier → refreshAuth() → navigate("/courier/dashboard"). User clicks notification → instant courier dashboard access. No logout/login needed.

## isCourier in AuthContext
`isCourier = user?.role === "courier"` added to context, memoized. Exported from interface.
Suspended couriers retain role="courier" (they see suspension screen on /courier/dashboard).

## useCourierOnboarding hook
`artifacts/marketplace/src/hooks/useCourierOnboarding.ts` — mirrors useSellerOnboarding pattern.
- Not logged in → /login?redirect=/courier/apply
- isCourier (approved or suspended) → /courier/dashboard
- All other customers → /courier/apply (apply page auto-redirects to status if profile exists)
Used on homepage Become a Courier CTA.

## Homepage Courier CTA (June 2026)
Added a second card to the bottom CTA banner in home.tsx, directly below "Open Your Store".
Same rounded-2xl / bg-card / border / shadow-sm design language. Uses emerald color scheme for Truck icon.
i18n keys: `home.courier_cta_title`, `home.courier_cta_desc`, `home.courier_cta_btn` in en.json + ar.json.

## Customer dashboard CTAs removed (June 2026)
The "Become a Seller" and "Become a Courier" CTA cards were removed from customer/dashboard.tsx.
Stats grid → Recent Orders table, no gap. Removed imports: Store, Truck, AlertTriangle, ChevronRight,
useAuth (isSellerApplicant, token), useQuery, CourierProfile interface.

## Navbar rules
- Cart hidden for couriers: `!isSeller && !isAdmin && !isCourier` guards both mobile and desktop cart button
- Couriers see dashboard link in user dropdown and "My Deliveries" link in desktop nav
- Mobile drawer shows courier dashboard link between seller and customer links
- `courierLinks` useMemo added

## ProtectedRoute canAccess
Sellers inherit customer routes. Couriers do NOT inherit customer routes (separate role).
If access denied: admin→/admin, seller→/seller/dashboard, courier→/courier/dashboard, else→/customer/dashboard.

## Admin delivery page
Pending courier: shows Approve + Reject buttons
Approved courier: shows Suspend button
Suspended courier: shows Approve button

**Why:** Users need distinct JWT role to access courier-gated routes. Token reissue via refreshAuth() avoids log-out-log-in UX friction. Notification link to /courier/application-status is the bridge that triggers this reissue automatically.
