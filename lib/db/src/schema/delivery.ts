import {
  pgTable, serial, integer, text, numeric, timestamp, boolean, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ordersTable } from "./orders";
import { couriersTable } from "./couriers";
import { deliveryMissionsTable } from "./delivery_missions";

export const deliveryZonesTable = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  fee: numeric("fee", { precision: 10, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const courierAssignmentsTable = pgTable("courier_assignments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().unique().references(() => ordersTable.id, { onDelete: "cascade" }),
  courierId: integer("courier_id").notNull().references(() => couriersTable.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("assigned"),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  pickedUpAt: timestamp("picked_up_at"),
  deliveredAt: timestamp("delivered_at"),
  notes: text("notes"),
  adminId: integer("admin_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_courier_assignments_order_id").on(t.orderId),
  index("idx_courier_assignments_courier_id").on(t.courierId),
  index("idx_courier_assignments_status").on(t.status),
]);

export const courierWalletTransactionsTable = pgTable("courier_wallet_transactions", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id").notNull().references(() => couriersTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_courier_wallet_courier_id").on(t.courierId),
]);

// ── V3.3 A8 — Courier Ratings ─────────────────────────────────────────────────
export const courierRatingsTable = pgTable("courier_ratings", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id").notNull().references(() => deliveryMissionsTable.id, { onDelete: "cascade" }),
  courierId: integer("courier_id").notNull().references(() => couriersTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_courier_ratings_courier_id").on(t.courierId),
  index("idx_courier_ratings_mission_id").on(t.missionId),
  uniqueIndex("uq_courier_ratings_mission_customer").on(t.missionId, t.customerId),
]);

// ── V3.3 A8 — Mission Safety Events ───────────────────────────────────────────
export const missionSafetyEventsTable = pgTable("mission_safety_events", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id").notNull(),
  courierId: integer("courier_id").notNull().references(() => couriersTable.id, { onDelete: "cascade" }),
  incidentType: text("incident_type").notNull(),
  note: text("note"),
  notifiedAdmin: boolean("notified_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_safety_events_mission_id").on(t.missionId),
  index("idx_safety_events_courier_id").on(t.courierId),
]);

export type DeliveryZone = typeof deliveryZonesTable.$inferSelect;
export type InsertDeliveryZone = typeof deliveryZonesTable.$inferInsert;
export type CourierAssignment = typeof courierAssignmentsTable.$inferSelect;
export type InsertCourierAssignment = typeof courierAssignmentsTable.$inferInsert;
export type CourierWalletTransaction = typeof courierWalletTransactionsTable.$inferSelect;
export type CourierRating = typeof courierRatingsTable.$inferSelect;
export type MissionSafetyEvent = typeof missionSafetyEventsTable.$inferSelect;
