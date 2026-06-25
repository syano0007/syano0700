import {
  pgTable, serial, integer, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { deliveryMissionsTable } from "./delivery_missions";
import { usersTable } from "./users";

export const dispatchAlertsTable = pgTable("dispatch_alerts", {
  id:           serial("id").primaryKey(),
  missionId:    integer("mission_id").notNull().references(() => deliveryMissionsTable.id, { onDelete: "cascade" }),
  type:         text("type").notNull().default("NO_COURIER_FOUND"),
  message:      text("message").notNull(),
  resolvedAt:   timestamp("resolved_at"),
  resolvedById: integer("resolved_by_id").references(() => usersTable.id),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_dispatch_alerts_mission_id").on(t.missionId),
  index("idx_dispatch_alerts_resolved_at").on(t.resolvedAt),
]);

export type DispatchAlert = typeof dispatchAlertsTable.$inferSelect;
export type InsertDispatchAlert = typeof dispatchAlertsTable.$inferInsert;
