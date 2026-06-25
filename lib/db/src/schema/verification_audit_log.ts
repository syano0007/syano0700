import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const verificationAuditLogTable = pgTable("verification_audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  event: text("event").notNull(),
  method: text("method"),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type VerificationAuditLog = typeof verificationAuditLogTable.$inferSelect;
