---
name: Courier operations UX audit
description: Backend enrichment + full page rewrites for admin/delivery.tsx and courier/dashboard.tsx — what changed, key decisions, i18n pattern.
---

# Courier Operations UX Audit

## Backend changes (couriers.ts)

**GET /couriers/assignments** — enriched: customerName, sellerName/storeName/sellerPhone (from sellerApplicationsTable joined on userId=order_items.sellerId), products[] (from order_items), orderDate. Status filter expanded to include `assigned`, `picked_up`, `out_for_delivery`.

**GET /admin/delivery/ready-orders** — enriched: sellerName, storeName, sellerPhone, products[].

**GET /admin/delivery/active** — fixed customerName bug (was storing customerId integer), added customerPhone, storeName, products[], courierPhone. Status filter expanded.

**GET /admin/couriers** — added `activeAssignments` count per courier (subquery on courier_assignments where status IN assigned/picked_up/out_for_delivery).

**PATCH /couriers/assignments/:id/fail-delivery** — accepts `failureReason` in request body, stores in `notes` column of courier_assignments. Sends seller notification with failure reason in body.

## Frontend rewrites

### admin/delivery.tsx
- Rich 2-column order cards (customer + seller/pickup sections) with product chip rows (ProductList component)
- CourierPickerCard: shows capacity badge (Available / N Active / Overloaded ≥5), completed deliveries, rating, online dot
- AssignCourierPanel: inline panel replacing old `<select>` dropdown; sorts by activeAssignments asc
- Active deliveries: 3-column layout (customer / seller / courier sections)
- All 4 tabs retain their own refetchInterval

### courier/dashboard.tsx
- DeliveryCard: pickup section (store/seller name, phone, product chips), delivery section (customer name/phone/address/notes), order meta (date + COD label)
- `your_cut` = deliveryFee × 0.8 displayed as courier earnings preview
- FailureReasonModal: 5 preset reasons (unavailable/wrong address/rejected/unreachable/other) — replaces browser `confirm()`; sends selected reason as `failureReason` to fail-delivery endpoint
- Earnings tab: uses `refetchInterval:30_000`; shows per-transaction rows

## i18n keys added

**delivery section**: `section_customer`, `section_seller`, `section_courier`, `product_count`, `courier_available`, `courier_overloaded`, `courier_active_n` (with {{n}}), `active_now`

**courier section**: `pickup_section`, `delivery_section`, `cod_label`, `your_cut`, `failure_modal_title`, `failure_modal_desc` (with {{id}}), `failure_confirm_btn`, `failure_unavailable`, `failure_wrong_address`, `failure_rejected`, `failure_unreachable`, `failure_other`

## Why
- Admin needed full context (who/where/what) without opening a separate order page
- Courier needed seller pickup info + customer delivery info on one card
- Browser `confirm()` for failure reporting was blocking/ugly and gave no structured data
- Capacity badge prevents admin from over-assigning to a busy courier

## How to apply
- Any new courier-facing card: always show both pickup (seller) and delivery (customer) sections
- Failure reasons stored in `courier_assignments.notes`; no schema change needed
- COD is always true for Syano (no online payment); always show COD label on courier cards
- `your_cut` is 80% of deliveryFee (courier's share); hardcoded ratio, not yet in DB
