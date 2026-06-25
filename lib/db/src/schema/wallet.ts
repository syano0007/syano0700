import {
  pgTable, serial, integer, text, numeric, timestamp, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { couriersTable } from "./couriers";
import { usersTable } from "./users";

export const courierWalletsTable = pgTable("courier_wallets", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id").notNull().references(() => couriersTable.id, { onDelete: "cascade" }),
  availableBalance: numeric("available_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  pendingBalance: numeric("pending_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  lifetimeEarnings: numeric("lifetime_earnings", { precision: 12, scale: 2 }).notNull().default("0"),
  lifetimePayouts: numeric("lifetime_payouts", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_courier_wallets_courier_id").on(t.courierId),
]);

export const courierPayoutRequestsTable = pgTable("courier_payout_requests", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id").notNull().references(() => couriersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("PENDING"),
  rejectionReason: text("rejection_reason"),
  approvedBy: integer("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_payout_requests_courier_id").on(t.courierId),
  index("idx_payout_requests_status").on(t.status),
]);

export type CourierWallet = typeof courierWalletsTable.$inferSelect;
export type CourierPayoutRequest = typeof courierPayoutRequestsTable.$inferSelect;
