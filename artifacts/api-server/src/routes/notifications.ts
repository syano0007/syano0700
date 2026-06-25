import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { requireAuth, requireActiveAccount } from "../middlewares/auth";
import type { JwtPayload } from "../middlewares/auth";
import { addSseClient, removeSseClient, createNotification } from "../lib/notif";

const router: IRouter = Router();
const JWT_SECRET: string = (() => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET environment variable is required");
  return s;
})();

/* ─── GET /notifications ─────────────────────────────────────── */
router.get("/notifications", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(60);

  res.json(rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })));
});

/* ─── GET /notifications/count ───────────────────────────────── */
router.get("/notifications/count", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [result] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));

  res.json({ unread: result?.count ?? 0 });
});

/* ─── GET /notifications/stream (SSE) ───────────────────────── */
router.get("/notifications/stream", async (req, res): Promise<void> => {
  const token = req.query.token as string;
  if (!token) {
    res.status(401).end();
    return;
  }

  let userId: number;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    userId = payload.userId;
  } catch {
    res.status(401).end();
    return;
  }

  const [userRow] = await db
    .select({ accountStatus: usersTable.accountStatus })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!userRow || userRow.accountStatus !== "active") {
    res.status(403).end();
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  /* Send the connected event so the client can verify it is talking to the
     right user and guard against stale-connection notification injection. */
  res.write(`event: connected\ndata: {"userId":${userId}}\n\n`);

  addSseClient(userId, res);

  const heartbeat = setInterval(() => {
    try { res.write(":heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(userId, res);
  });
});

/* ─── POST /notifications/read-all ──────────────────────────── */
router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));

  res.json({ message: "All notifications marked as read" });
});

/* ─── POST /notifications/:id/read ──────────────────────────── */
router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid notification ID" });
    return;
  }

  const userId = req.user!.userId;

  /* Verify ownership before touching the row. */
  const [notification] = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  /* UPDATE scoped to both id AND userId — defense-in-depth against TOCTOU.
     Without this, a race between the SELECT above and this UPDATE could allow
     a notification that changed ownership (in theory) to be marked read for
     the wrong user. */
  const [updated] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
    .returning();

  if (!updated) {
    /* Should never happen — means the row vanished between SELECT and UPDATE */
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

export default router;
