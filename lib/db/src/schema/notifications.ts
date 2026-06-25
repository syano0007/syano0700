import { pgTable, serial, integer, text, boolean, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ordersTable } from "./orders";

export const notificationTypeEnum = pgEnum("notification_type", [
  "new_order",
  "order_placed",
  "order_processing",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "order_confirmed",
  "order_preparing",
  "order_ready",
  "order_courier_assigned",
  "order_picked_up",
  "order_out_for_delivery",
  "order_delivery_failed",
  "order_returned",
  "order_cancelled_by_customer",
  "order_refunded",
  "low_stock",
  "seller_applied",
  "seller_approved",
  "seller_rejected",
  "product_submitted",
  "product_approved",
  "product_rejected",
  "new_follower",
  "store_new_product",
  "new_seller_review",
  "new_message",
  "new_user",
  "courier_applied",
  "courier_approved",
  "courier_rejected",
]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  priority: text("priority").notNull().default("normal"),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_notifications_user_id").on(t.userId),
  index("idx_notifications_user_read").on(t.userId, t.isRead),
  index("idx_notifications_user_created").on(t.userId, t.createdAt),
]);

export type Notification = typeof notificationsTable.$inferSelect;
export type NotificationInsert = typeof notificationsTable.$inferInsert;
