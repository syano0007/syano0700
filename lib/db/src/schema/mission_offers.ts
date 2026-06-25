import {
  pgTable, serial, integer, text, timestamp, pgEnum, index,
} from "drizzle-orm/pg-core";
import { deliveryMissionsTable } from "./delivery_missions";
import { couriersTable } from "./couriers";

export const missionOfferStatusEnum = pgEnum("mission_offer_status", [
  "OFFERED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
]);

export const missionOffersTable = pgTable("mission_offers", {
  id:          serial("id").primaryKey(),
  missionId:   integer("mission_id").notNull().references(() => deliveryMissionsTable.id, { onDelete: "cascade" }),
  courierId:   integer("courier_id").notNull().references(() => couriersTable.id, { onDelete: "cascade" }),
  status:      missionOfferStatusEnum("status").notNull().default("OFFERED"),
  round:       integer("round").notNull().default(1),
  offeredAt:   timestamp("offered_at").notNull().defaultNow(),
  expiresAt:   timestamp("expires_at").notNull(),
  respondedAt: timestamp("responded_at"),
}, (t) => [
  index("idx_mission_offers_mission_id").on(t.missionId),
  index("idx_mission_offers_courier_id").on(t.courierId),
  index("idx_mission_offers_status").on(t.status),
  index("idx_mission_offers_expires_at").on(t.expiresAt),
]);

export type MissionOffer = typeof missionOffersTable.$inferSelect;
export type InsertMissionOffer = typeof missionOffersTable.$inferInsert;
