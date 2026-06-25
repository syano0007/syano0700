---
name: requireActiveAccount coverage
description: All routes that must have requireActiveAccount — suspended users cannot read or write any of these
---

## Rule
Every route that reads or writes user-sensitive data must include `requireActiveAccount` after `requireAuth`. The middleware returns 403 if `accountStatus !== 'active'`.

## Complete coverage (as of June 2026)
**orders.ts:** All 5 routes — GET /orders, POST /orders, GET /orders/:id, GET /orders/:id/history, PATCH /orders/:id/status.

**notifications.ts:** GET /notifications, GET /notifications/count.

**messaging.ts:** GET /conversations, GET /conversations/:id/messages.

**seller-applications.ts:** PATCH /draft, DELETE /my, POST / (submit).

**sellers.ts:** POST /follow, DELETE /follow, POST /reviews, PATCH /store/branding.

**Public-read routes that intentionally omit it:** GET /sellers/:id (store page), GET /sellers/:id/follow-status, GET /me/following-stores — these are read-only public-facing.

**Why:** Suspended accounts were able to read orders, messages, notifications. The requireActiveAccount middleware must be present on all write operations and any data that reveals platform-sensitive information.
