---
name: Messaging V2 Architecture
description: Production-grade messaging system — schema, API, frontend components, and key patterns.
---

## Schema (lib/db/src/schema/conversations.ts)
- `conversationsTable`: added `type` (text, default 'customer_seller'), `muted` (boolean), `order_id` (integer nullable)
- `messagesTable`: added `attachment_id` (integer nullable), `deleted_at` (timestamp nullable)
- `messageAttachmentsTable`: new table — stores base64 attachment data; columns: id, conversation_id, filename, mime_type, size, data (TEXT base64), created_at

## Migration (run-migrations.ts)
- All V2 columns added in the additive SQL block (ALTER TABLE IF NOT EXISTS, CREATE TABLE IF NOT EXISTS)
- Migration logs: "messaging-v2 columns ready"

## API Routes (artifacts/api-server/src/routes/messaging.ts)
- In-memory typing store: Map<convId, Map<userId, {name, expiresAt}>>; expire 4s; no DB write
- `type` field on conversations: 'customer_seller' | 'customer_admin' | 'seller_admin' | 'courier_admin'
- Admin convs: adminId goes in `sellerId`, target user in `customerId` (repurposes seller_id column)
- Archive uses `status='archived'` (not a separate column)
- Attachments: base64 stored in message_attachments table; served via GET /conversations/:id/attachments/:attachId with correct Content-Type header
- Soft-delete: sets deleted_at timestamp; deleted messages return as placeholders

## API Client (lib/api-client-react/src/messaging.ts)
- New hooks: useGetUnreadCount (refetch 10s), useArchiveConversation, useMuteConversation, useDeleteMessage, useUploadAttachment, useGetTyping (refetch 2s), useGetAdminConversations, useStartAdminConversation, useBlockConversation, useSearchConversations
- sendTyping() is a plain async function (not a hook) for debounced call from keystroke handlers

## Frontend Components
- `src/components/MessagingPanel.tsx`: shared two-panel chat UI used by customer (/messages) and seller (/seller/messages) pages
  - ConvSidebar: search + filter tabs (all/unread/archived) + hover archive/mute buttons
  - MessageThread: full message UX with typing indicator, read receipts (✓/✓✓), soft-delete dropdown, attachment upload (file input + paste + drag-drop)
  - AttachmentPreview: before-send preview strip
- `src/pages/messages/index.tsx`: thin customer wrapper (full-screen, no Layout footer)
- `src/pages/seller/messages.tsx`: thin seller wrapper (includes SellerNav)
- `src/pages/admin/messages.tsx`: admin inbox with type filter, block/archive per conversation, name-based search

## Navbar Integration
- `useGetUnreadCount` called in Navbar (enabled: isAuthenticated, refetchInterval: 15000)
- Desktop: MessageCircle icon with blue badge → routes to correct page by role
- Mobile slide-out: customer+seller both get badge-enhanced link (not MobileNavLink, inline JSX)
- Route: /admin/messages, /seller/messages, /messages

## i18n
- 75 keys in `messages.*` namespace in both en.json and ar.json
- Key patterns: `messages.user_typing` uses {{name}} interpolation; `messages.order_context` uses {{id}}

**Why:** Separate admin page avoids role-mixing in the shared panel; in-memory typing store avoids DB write-on-keystroke latency.
