import { eq } from "drizzle-orm";
import { db, storeFollowsTable } from "@workspace/db";
import { createNotification } from "./notif";
import type { NotificationInsert } from "@workspace/db";

type FanoutPayload = Omit<NotificationInsert, "id" | "isRead" | "createdAt" | "userId" | "orderId">;

const CHUNK_SIZE = 50;

/**
 * Notify all followers of a store.
 *
 * Isolated so this can be swapped for a job-queue dispatch (e.g. BullMQ,
 * Temporal, pg-boss) without changing business logic — just replace the body
 * of this function with a queue.push(sellerId, payload).
 *
 * Called fire-and-forget: caller should NOT await this.
 */
export async function notifyStoreFollowers(
  sellerId: number,
  payload: FanoutPayload
): Promise<void> {
  try {
    const followers = await db
      .select({ followerId: storeFollowsTable.followerId })
      .from(storeFollowsTable)
      .where(eq(storeFollowsTable.sellerId, sellerId));

    if (!followers.length) return;

    for (let i = 0; i < followers.length; i += CHUNK_SIZE) {
      const chunk = followers.slice(i, i + CHUNK_SIZE);
      await Promise.allSettled(
        chunk.map(({ followerId }: { followerId: number }) =>
          createNotification({ userId: followerId, ...payload })
        )
      );
    }
  } catch (err) {
    console.error("[fanout] notifyStoreFollowers error:", err);
  }
}
