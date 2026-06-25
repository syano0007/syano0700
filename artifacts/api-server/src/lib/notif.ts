import type { Response } from "express";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db, notificationsTable, pushSubscriptionsTable } from "@workspace/db";
import type { NotificationInsert } from "@workspace/db";

/* ── VAPID setup ─────────────────────────────────────────────── */
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL   = process.env.VAPID_EMAIL ?? "mailto:admin@syano.online";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

/* ── SSE client registry ─────────────────────────────────────── */
const clients = new Map<number, Set<Response>>();

export function addSseClient(userId: number, res: Response): void {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);
  const tabs = clients.get(userId)!.size;
  console.log(`[sse] connect  uid=${userId} tabs=${tabs} total_users=${clients.size}`);
}

export function removeSseClient(userId: number, res: Response): void {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  const tabs = set.size;
  if (tabs === 0) clients.delete(userId);
  console.log(`[sse] disconnect uid=${userId} tabs=${tabs} total_users=${clients.size}`);
}

/** Returns total active SSE connection count (all users combined). */
export function getSseConnectionCount(): number {
  let total = 0;
  for (const set of clients.values()) total += set.size;
  return total;
}

/**
 * Force-close all SSE connections for a user (e.g. on account suspension).
 * Sends a `suspended` event before closing so the client can redirect.
 */
export function kickSseUser(userId: number): void {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const payload = `event: suspended\ndata: {"reason":"account_suspended"}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
      res.end();
    } catch {}
  }
  clients.delete(userId);
  console.log(`[sse] kicked uid=${userId} (account suspended)`);
}

/* ── Send via SSE ────────────────────────────────────────────── */
function pushSse(userId: number, row: Record<string, unknown>): void {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const payload = `data: ${JSON.stringify(row)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch {}
  }
}

/* ── Send via Web Push ───────────────────────────────────────── */
async function pushWebPush(
  userId: number,
  title: string,
  body: string,
  link?: string | null,
  priority?: string
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  let subs;
  try {
    subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userId, userId));
  } catch {
    return;
  }

  if (!subs.length) return;

  const payload = JSON.stringify({
    title,
    body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { link },
    tag: `syano-${Date.now()}`,
    priority,
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: any) {
        /* 410 Gone — subscription expired, remove it */
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          try {
            await db
              .delete(pushSubscriptionsTable)
              .where(eq(pushSubscriptionsTable.id, sub.id));
          } catch {}
        }
      }
    })
  );
}

/* ── Bilingual text helper ───────────────────────────────────── */
/**
 * Encode a string in both English and Arabic so the frontend can pick
 * the right language at render time without storing duplicate rows.
 * Usage: bi("Hello!", "مرحبًا!")
 */
export function bi(en: string, ar: string): string {
  return JSON.stringify({ en, ar });
}

/* ── Kick SSE connection due to role change ──────────────────── */
export function kickSseRole(userId: number): void {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const payload = `event: role_changed\ndata: {"reason":"role_changed"}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch {}
  }
  console.log(`[sse] role_changed uid=${userId}`);
}

/* ── createNotification ──────────────────────────────────────── */
export async function createNotification(
  data: Omit<NotificationInsert, "id" | "isRead" | "createdAt">
): Promise<void> {
  try {
    const [row] = await db.insert(notificationsTable).values(data).returning();
    const serialized = { ...row, createdAt: row.createdAt.toISOString() };

    /* 1. Push to any open browser tabs via SSE (instant) */
    pushSse(data.userId, serialized);

    /* 2. Push to subscribed devices via Web Push (background) */
    pushWebPush(data.userId, data.title, data.body, data.link, data.priority).catch(() => {});
  } catch (err) {
    console.error("[notif] createNotification error:", err);
  }
}
