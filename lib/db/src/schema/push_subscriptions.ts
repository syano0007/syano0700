import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // pushWebPush(userId) queries WHERE user_id = ? on every notification delivery.
  // Without this index each delivery is a full table scan.
  index("idx_push_subscriptions_user_id").on(t.userId),
]);

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
export type PushSubscriptionInsert = typeof pushSubscriptionsTable.$inferInsert;
