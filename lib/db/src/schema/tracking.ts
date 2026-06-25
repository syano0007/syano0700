import { pgTable, serial, integer, boolean, text, timestamp, numeric, bigserial, jsonb, index } from "drizzle-orm/pg-core";

export const trackingSessionsTable = pgTable(
  "tracking_sessions",
  {
    id:             serial("id").primaryKey(),
    missionId:      integer("mission_id").notNull().unique(),
    courierId:      integer("courier_id").notNull(),
    orderId:        integer("order_id").notNull(),
    sellerId:       integer("seller_id").notNull(),
    customerId:     integer("customer_id").notNull(),
    isActive:       boolean("is_active").notNull().default(true),
    startedAt:      timestamp("started_at").notNull().defaultNow(),
    endedAt:        timestamp("ended_at"),
    lastPositionAt: timestamp("last_position_at"),
    endReason:      text("end_reason"),
    positionCount:  integer("position_count").notNull().default(0),
  },
  (t) => ({
    missionIdx: index("idx_tracking_sessions_mission").on(t.missionId),
    courierIdx: index("idx_tracking_sessions_courier").on(t.courierId),
    activeIdx:  index("idx_tracking_sessions_active").on(t.isActive),
  }),
);

export const trackingPositionsTable = pgTable(
  "tracking_positions",
  {
    id:         bigserial("id", { mode: "number" }).primaryKey(),
    sessionId:  integer("session_id").notNull(),
    missionId:  integer("mission_id").notNull(),
    courierId:  integer("courier_id").notNull(),
    lat:        numeric("lat",      { precision: 10, scale: 7 }).notNull(),
    lng:        numeric("lng",      { precision: 10, scale: 7 }).notNull(),
    heading:    numeric("heading",  { precision: 6,  scale: 2 }),
    speed:      numeric("speed",    { precision: 6,  scale: 2 }),
    accuracy:   numeric("accuracy", { precision: 8,  scale: 2 }),
    recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  },
  (t) => ({
    missionTimeIdx: index("idx_tracking_positions_mission_time").on(t.missionId, t.recordedAt),
    sessionIdx:     index("idx_tracking_positions_session").on(t.sessionId),
    courierIdx:     index("idx_tracking_positions_courier").on(t.courierId),
  }),
);

export const trackingEventsTable = pgTable(
  "tracking_events",
  {
    id:         bigserial("id", { mode: "number" }).primaryKey(),
    missionId:  integer("mission_id").notNull(),
    sessionId:  integer("session_id"),
    courierId:  integer("courier_id"),
    eventType:  text("event_type").notNull(),
    payload:    jsonb("payload"),
    actorId:    integer("actor_id"),
    actorRole:  text("actor_role"),
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  },
  (t) => ({
    missionIdx: index("idx_tracking_events_mission").on(t.missionId),
    typeIdx:    index("idx_tracking_events_type").on(t.eventType),
    timeIdx:    index("idx_tracking_events_time").on(t.occurredAt),
  }),
);

export type TrackingSession  = typeof trackingSessionsTable.$inferSelect;
export type InsertTrackingSession = typeof trackingSessionsTable.$inferInsert;
export type TrackingPosition = typeof trackingPositionsTable.$inferSelect;
export type TrackingEvent    = typeof trackingEventsTable.$inferSelect;
