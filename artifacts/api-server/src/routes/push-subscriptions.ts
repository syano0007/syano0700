import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

/* ─── GET /push-subscriptions/vapid-public-key ──────────────── */
router.get("/push-subscriptions/vapid-public-key", (_req, res): void => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    res.status(503).json({ error: "Push notifications not configured" });
    return;
  }
  res.json({ publicKey: key });
});

/* ─── POST /push-subscriptions ──────────────────────────────── */
router.post("/push-subscriptions", requireAuth, async (req, res): Promise<void> => {
  const { endpoint, keys, userAgent } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid subscription data" });
    return;
  }

  const userId = req.user!.userId;

  await db
    .insert(pushSubscriptionsTable)
    .values({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? req.headers["user-agent"] ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

  res.json({ success: true });
});

/* ─── DELETE /push-subscriptions ────────────────────────────── */
router.delete("/push-subscriptions", requireAuth, async (req, res): Promise<void> => {
  const { endpoint } = req.body as { endpoint?: string };
  const userId = req.user!.userId;

  if (endpoint) {
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.endpoint, endpoint),
          eq(pushSubscriptionsTable.userId, userId)
        )
      );
  } else {
    await db
      .delete(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userId, userId));
  }

  res.json({ success: true });
});

export default router;
