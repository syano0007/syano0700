import {
  pgTable, serial, integer, text, numeric, timestamp, pgEnum, index, boolean,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ordersTable } from "./orders";
import { couriersTable } from "./couriers";

export const deliveryMissionStatusEnum = pgEnum("delivery_mission_status", [
  "PENDING",
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
  "RESCHEDULE_REQUIRED",
]);

export const deliverySizeEnum = pgEnum("delivery_size", [
  "SMALL",
  "MEDIUM",
  "LARGE",
]);

export const deliveryMissionsTable = pgTable("delivery_missions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().unique().references(() => ordersTable.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  customerId: integer("customer_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  courierId: integer("courier_id").references(() => couriersTable.id, { onDelete: "set null" }),
  status: deliveryMissionStatusEnum("status").notNull().default("PENDING"),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }),
  deliverySize: deliverySizeEnum("delivery_size").notNull().default("MEDIUM"),
  pickupAddress: text("pickup_address").notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  pickupLat: numeric("pickup_lat", { precision: 10, scale: 7 }),
  pickupLng: numeric("pickup_lng", { precision: 10, scale: 7 }),
  dropoffLat: numeric("dropoff_lat", { precision: 10, scale: 7 }),
  dropoffLng: numeric("dropoff_lng", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  pickedUpAt: timestamp("picked_up_at"),
  deliveredAt: timestamp("delivered_at"),
  cancelledAt: timestamp("cancelled_at"),
  failedAt: timestamp("failed_at"),
  // V3.3 A8 — Delivery proof
  proofImageUrl: text("proof_image_url"),
  confirmedByCourier: boolean("confirmed_by_courier").notNull().default(false),
  // V3.3 A8 — Failure reporting
  failureType: text("failure_type"),
  failureReason: text("failure_reason"),
  // V3.3 A8 — Reschedule workflow
  rescheduleRequestedAt: timestamp("reschedule_requested_at"),
  rescheduleReason: text("reschedule_reason"),
  rescheduleRequestedBy: integer("reschedule_requested_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [
  index("idx_delivery_missions_order_id").on(t.orderId),
  index("idx_delivery_missions_seller_id").on(t.sellerId),
  index("idx_delivery_missions_customer_id").on(t.customerId),
  index("idx_delivery_missions_courier_id").on(t.courierId),
  index("idx_delivery_missions_status").on(t.status),
  index("idx_delivery_missions_created_at").on(t.createdAt),
]);

export type DeliveryMission = typeof deliveryMissionsTable.$inferSelect;
export type InsertDeliveryMission = typeof deliveryMissionsTable.$inferInsert;
