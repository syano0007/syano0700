import { pgTable, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const cartItemsTable = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  variantId: integer("variant_id"),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_cart_items_user_id").on(t.userId),
  index("idx_cart_items_product_id").on(t.productId),
]);

export type CartItem = typeof cartItemsTable.$inferSelect;
