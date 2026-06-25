import { pgTable, serial, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const storeFollowsTable = pgTable(
  "store_follows",
  {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("store_follows_unique").on(t.followerId, t.sellerId),
    index("idx_store_follows_seller_id").on(t.sellerId),
    index("idx_store_follows_follower_id").on(t.followerId),
  ]
);

export type StoreFollow = typeof storeFollowsTable.$inferSelect;
