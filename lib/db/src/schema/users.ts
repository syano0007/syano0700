import { pgTable, serial, text, timestamp, pgEnum, boolean, integer, index, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["customer", "seller", "admin", "courier"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("customer"),
  sellerStatus: text("seller_status"),
  trustLevel: text("trust_level"),
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedAt: timestamp("verified_at"),
  verificationMethod: text("verification_method"),
  verificationLevel: text("verification_level"),
  verifiedBy: integer("verified_by"),
  trustScore: integer("trust_score"),
  trustScoreUpdatedAt: timestamp("trust_score_updated_at"),
  otpHash: text("otp_hash"),
  otpExpiresAt: timestamp("otp_expires_at"),
  otpAttempts: integer("otp_attempts").notNull().default(0),
  otpLockedUntil: timestamp("otp_locked_until"),
  otpRequestCount: integer("otp_request_count").notNull().default(0),
  otpRequestWindowStart: timestamp("otp_request_window_start"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  accountStatus: text("account_status").notNull().default("active"),
  suspendedReason: text("suspended_reason"),
  suspendedBy: integer("suspended_by"),
  suspendedAt: timestamp("suspended_at"),
  resetOtpHash: text("reset_otp_hash"),
  resetOtpExpiresAt: timestamp("reset_otp_expires_at"),
  resetOtpAttempts: integer("reset_otp_attempts").notNull().default(0),
  resetOtpLockedUntil: timestamp("reset_otp_locked_until"),
  googleId: text("google_id").unique(),
  facebookId: text("facebook_id").unique(),
  authProvider: text("auth_provider").notNull().default("local"),
  avatarUrl: text("avatar_url"),
  deliveryLat: doublePrecision("delivery_lat"),
  deliveryLng: doublePrecision("delivery_lng"),
  deliveryZoneId: integer("delivery_zone_id"),
}, (t) => [
  index("idx_users_role").on(t.role),
  index("idx_users_created_at").on(t.createdAt),
  index("idx_users_account_status").on(t.accountStatus),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
