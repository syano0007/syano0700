import { pgTable, serial, integer, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const reviewsTable = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("reviews_product_user_unique").on(t.productId, t.userId),
    index("idx_reviews_product_id").on(t.productId),
    index("idx_reviews_user_id").on(t.userId),
    index("idx_reviews_product_created").on(t.productId, t.createdAt),
    index("idx_reviews_rating").on(t.rating),
  ]
);

export type Review = typeof reviewsTable.$inferSelect;
