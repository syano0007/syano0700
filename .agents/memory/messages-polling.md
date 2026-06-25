---
name: Messages polling pattern
description: Polling intervals for conversation list and message thread as SSE fallback; must include background throttle
---

## Rule
Both the customer messages page and the seller messages page poll for updates. SSE handles instantaneous pushes; polling covers SSE reconnect gaps. Always set `refetchIntervalInBackground: false` to prevent 429s on background tabs.

## How to apply
- `useGetConversations({ query: { refetchInterval: 5000, refetchIntervalInBackground: false } })` — on both `messages/index.tsx` and `seller/messages.tsx`.
- `useGetMessages(conv.id, { query: { refetchInterval: 3000, refetchIntervalInBackground: false } })` — on both `MessageThread` components.
- SSE `new_message` events also invalidate these queries immediately (see sse-realtime-invalidation.md).

**Why:** Without `refetchIntervalInBackground: false`, open background tabs continuously ping the server → 429 rate limit errors in production. The flag is required alongside any `refetchInterval`.
