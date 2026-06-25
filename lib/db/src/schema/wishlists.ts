import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const wishlistsTable = pgTable(
  "wishlists",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    productId: integer("product_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("wishlists_user_product_unique").on(table.userId, table.productId)]
);

export type Wishlist = typeof wishlistsTable.$inferSelect;
