import { pgTable, serial, integer, text, numeric, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "preparing",
  "ready_for_pickup",
  "courier_assigned",
  "shipped",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "delivery_failed",
  "returned",
  "refunded",
]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => usersTable.id),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  shippingAddress: text("shipping_address").notNull(),
  customerPhone: text("customer_phone"),
  city: text("city"),
  deliveryNotes: text("delivery_notes"),
  notes: text("notes"),
  estimatedDelivery: text("estimated_delivery"),
  shippingCompany: text("shipping_company"),
  trackingNumber: text("tracking_number"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }),
  zoneId: integer("zone_id"),
  cancellationReason: text("cancellation_reason"),
  cancelledBy: text("cancelled_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_orders_customer_id").on(t.customerId),
  index("idx_orders_status").on(t.status),
  index("idx_orders_created_at").on(t.createdAt),
  index("idx_orders_status_created").on(t.status, t.createdAt),
  index("idx_orders_customer_created").on(t.customerId, t.createdAt),
  index("idx_orders_updated_at").on(t.updatedAt),
]);

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  sellerId: integer("seller_id").notNull(),
  variantId: integer("variant_id"),
  variantDetails: text("variant_details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_order_items_order_id").on(t.orderId),
  index("idx_order_items_seller_id").on(t.sellerId),
  index("idx_order_items_product_id").on(t.productId),
]);

export const orderStatusHistoryTable = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: integer("changed_by"),
  changedByRole: text("changed_by_role"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_order_status_history_order_id").on(t.orderId),
]);

export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type OrderStatusHistory = typeof orderStatusHistoryTable.$inferSelect;
