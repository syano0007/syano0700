import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const adminAuditLogTable = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminAuditLog = typeof adminAuditLogTable.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLogTable.$inferInsert;
