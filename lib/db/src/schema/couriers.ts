import {
  pgTable, serial, integer, text, numeric, timestamp, boolean, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const couriersTable = pgTable("couriers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  active: boolean("active").notNull().default(false),
  city: text("city").notNull().default("Aleppo"),
  district: text("district"),
  phone: text("phone").notNull(),
  vehicleType: text("vehicle_type").notNull().default("motorcycle"),
  rating: numeric("rating", { precision: 3, scale: 2 }),
  completedDeliveries: integer("completed_deliveries").notNull().default(0),
  notes: text("notes"),
  // V3.2 — Availability system
  availabilityStatus: text("availability_status").default("OFFLINE"),
  isAcceptingDeliveries: boolean("is_accepting_deliveries").notNull().default(false),
  lastAvailabilityChangeAt: timestamp("last_availability_change_at"),
  // V3.3 — Location (current GPS position for nearest-courier sorting)
  currentLat: numeric("current_lat", { precision: 10, scale: 7 }),
  currentLng: numeric("current_lng", { precision: 10, scale: 7 }),
  // V3.3 A3 — Extended GPS telemetry
  currentHeading: numeric("current_heading", { precision: 6, scale: 2 }),
  currentSpeed: numeric("current_speed", { precision: 8, scale: 3 }),
  currentAccuracy: numeric("current_accuracy", { precision: 8, scale: 3 }),
  lastLocationUpdateAt: timestamp("last_location_update_at"),
  locationSource: text("location_source"),
  // V3.3 A8 — Navigation preference
  navigationPreference: text("navigation_preference").default("google"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_couriers_user_id").on(t.userId),
  index("idx_couriers_status").on(t.status),
  index("idx_couriers_availability").on(t.availabilityStatus),
  index("idx_couriers_location").on(t.currentLat, t.currentLng),
]);

export type Courier = typeof couriersTable.$inferSelect;
export type InsertCourier = typeof couriersTable.$inferInsert;
