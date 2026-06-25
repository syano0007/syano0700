import { pgTable, serial, integer, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ordersTable } from "./orders";

export const sellerReviewsTable = pgTable(
  "seller_reviews",
  {
    id: serial("id").primaryKey(),
    sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    customerId: integer("customer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
    communicationRating: integer("communication_rating").notNull(),
    shippingRating: integer("shipping_rating").notNull(),
    professionalismRating: integer("professionalism_rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    sellerReply: text("seller_reply"),
    sellerReplyAt: timestamp("seller_reply_at"),
    sellerReplyUpdatedAt: timestamp("seller_reply_updated_at"),
  },
  (t) => [
    unique("seller_reviews_unique").on(t.sellerId, t.customerId),
    index("idx_seller_reviews_seller_id").on(t.sellerId),
    index("idx_seller_reviews_customer_id").on(t.customerId),
  ]
);

export type SellerReview = typeof sellerReviewsTable.$inferSelect;
