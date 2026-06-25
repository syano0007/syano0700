---
name: AI Customer Service Agent V1
description: Phase 13 — Smart Support system architecture, key files, and design decisions
---

## Architecture

**AI agent is a special system user** bootstrapped on startup:
- email: `ai-support@syano.internal`, role: `admin`, no real password
- bootstrapped via `bootstrapAISupportAgent()` in `bootstrap-test-accounts.ts`
- Called as step 4 of startup sequence in `index.ts`

**Conversations** use existing `conversationsTable`:
- `customerId` = authenticated user
- `sellerId` = AI agent user ID
- `type` = `"ai_support"` (plain TEXT, no enum migration needed)

**Support tickets table** (`support_tickets`) added via `run-migrations.ts` Phase 13 block:
- id, user_id, conversation_id, status, category, priority, subject, notes, assigned_admin_id, resolved_at, created_at, updated_at
- `preferred_language` column also added to `users` table (VARCHAR(5))

## Key files
- `artifacts/api-server/src/services/aiProvider.ts` — AI abstraction interface, FAQProvider, intent classification, FAQ knowledge base (AR/EN), DB lookup helpers
- `artifacts/api-server/src/routes/support.ts` — all 6 support routes
- `artifacts/marketplace/src/pages/customer/support.tsx` — Smart Support chat + tickets page
- `artifacts/marketplace/src/pages/admin/support.tsx` — Admin support ticket dashboard

## Routes
- `GET /api/support/conversation` — get or create AI support conversation (auto-sends welcome message)
- `POST /api/support/message` — send user message + get AI reply synchronously
- `GET /api/support/tickets` — user's own tickets
- `POST /api/support/escalate` — manually escalate
- `GET /api/admin/support/tickets` — admin: all tickets with ?status filter
- `PATCH /api/admin/support/tickets/:id` — admin: update status/assignment/priority
- `GET /api/admin/support/stats` — admin: open/pending/resolved/closed/urgent/unassigned counts

## FAQ intents
11 intents: greeting, order_status, order_cancel, refund, shipping, product_search, seller_info, account_help, trust_verification, escalate, thanks, general

**Critical:** escalate confidence=0.97 (highest) to avoid it being masked by product_search "i want" pattern. Removed "i want" from product_search patterns.

## Frontend entry points
- `/support` — customer chat page (lazy imported in App.tsx, role=customer required)
- `/admin/support` — admin ticket dashboard (lazy imported, role=admin)
- Messages page `/messages` — has Smart Support banner at the top linking to `/support`
- AdminLayout — has "Support Tickets" nav item with open+pending badge count

## V1 limitations
- No external AI API — purely rule-based FAQ + DB lookups
- No real-time streaming (polling every 3s picks up agent replies)
- Language detection is simple Arabic character count ratio
- Future: swap `FAQProvider` for `ClaudeProvider`/`QwenProvider` via `AI_PROVIDER` env var
