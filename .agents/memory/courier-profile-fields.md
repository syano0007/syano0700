---
name: Courier profile fields
description: /couriers/profile must return successRate, activeAssignments, walletBalance — these are computed on-the-fly, not stored columns
---

# Courier Profile Fields

**Rule:** `GET /couriers/profile` must return these three computed fields in addition to the couriers table row. The courier dashboard UI (courier/dashboard.tsx) reads all three to render stats cards.

| Field | How Computed |
|---|---|
| `successRate` | `completed / (completed + failed) * 100` — from courier_assignments WHERE courierId=X |
| `activeAssignments` | COUNT of assignments with status IN ('assigned', 'picked_up', 'out_for_delivery') |
| `walletBalance` | SUM of courier_wallet_transactions.amount WHERE courierId=X |

**Why:** These fields were not in the original profile endpoint. The frontend crashed silently showing `undefined` in stats cards. They must be batch-queried (2 extra queries) but are fast since courier assignment counts are small.

**How to apply:** Any refactor of the /couriers/profile handler must preserve all three computed fields. They are not stored columns on the couriers table.

**Validated value (E2E test):** successRate=50, walletBalance=0.80, activeAssignments=0 — matches 2 orders (1 delivered, 1 failed) and $1.00 fee × 80% cut.
