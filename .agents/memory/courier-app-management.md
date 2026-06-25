---
  name: Courier application management system
  description: Architecture decisions for the admin courier management UI and API changes made in June 2026 upgrade.
  ---

  ## What was built
  - `/admin/courier-applications` — 4-tab (Pending/Approved/Rejected/Suspended) list page with inline approve/reject/suspend/reactivate actions
  - `/admin/courier-applications/:id` — detail page with user info, courier info, status, admin actions  
  - Both pages live in `artifacts/marketplace/src/pages/admin/courier-application-detail.tsx` and `courier-applications.tsx`

  ## API changes (couriers.ts)
  - Added `GET /api/admin/couriers/:id` — joins couriers+users, returns userName/userEmail/userCreatedAt + all courier fields  
  - Fixed `PATCH /api/admin/couriers/:id` — now fetches previousStatus before updating to distinguish initial approval vs reactivation
  - Added suspension notification (was missing)
  - Added reactivation notification (previousStatus === "suspended" + new status === "approved")
  - Fixed approval notification body: removed "Log out and back in" text

  **Why:** The auto-refresh already happens in application-status.tsx via refreshAuth(); the notification just needs to say "dashboard is ready."

  ## Admin sidebar (AdminLayout.tsx)
  - Added `{ href: "/admin/courier-applications", icon: User, labelKey: "courier_applications.nav", badgeKey: "couriers" }`
  - Added 3rd fetch in badges query to GET /admin/couriers and count pending ones for sidebar badge
  - `User` (singular from lucide) added to imports (was only Users plural)

  ## Customer dashboard dynamic CTA
  - Customer dashboard now fetches `GET /api/couriers/profile` (staleTime 30s) to show status-aware courier CTA
  - pending → "Application Under Review" card (amber) → /courier/application-status
  - rejected → "Application Not Approved" card (red) → /courier/application-status
  - suspended → "Account Suspended" card (orange) → /courier/application-status
  - null/no app → "Become a Courier" (green) → /courier/apply
  - approved state not shown (role becomes courier, they leave customer dashboard)

  ## Delivery zones expansion (run-migrations.ts)
  - Used CTE + WHERE NOT EXISTS pattern (no unique constraint needed): idempotent per-zone insertion
  - Total zones: 40 (16 original + 24 new Aleppo districts)
  - Pattern: `WITH new_zones AS (VALUES ...) INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name_en = nz.name_en)`

  ## i18n additions
  - New top-level `courier_applications` section (40 keys, EN + AR)
  - Added `courier.status_pending/approved/rejected/suspended` keys
  - Added `courier.notif_suspended_title/body` and `courier.notif_reactivated_title/body`
  - Added `delivery.reactivate`, `delivery.courier_reactivated`, `delivery.status_rejected`
  - Added `customer_dashboard.courier_pending_desc`, `courier_rejected_desc`, `courier_suspended_desc`, `courier_account_suspended`, etc.
  