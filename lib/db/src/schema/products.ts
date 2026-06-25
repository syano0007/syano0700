import { pgTable, serial, text, integer, numeric, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  stock: integer("stock").notNull().default(0),
  imageUrl: text("image_url"),
  imageUrls: text("image_urls").array(),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  nameAr: text("name_ar"),
  searchTokens: text("search_tokens"),
  viewCount: integer("view_count").notNull().default(0),
  salesCount: integer("sales_count").notNull().default(0),
  embeddingModel: text("embedding_model"),
  embeddedAt: timestamp("embedded_at"),
}, (t) => [
  index("products_category_idx").on(t.category),
  index("products_seller_id_idx").on(t.sellerId),
  index("products_featured_idx").on(t.featured),
  index("products_created_at_idx").on(t.createdAt),
  index("products_stock_idx").on(t.stock),
  index("products_subcategory_idx").on(t.subcategory),
  index("products_seller_created_idx").on(t.sellerId, t.createdAt),
  index("products_category_created_idx").on(t.category, t.createdAt),
  index("products_featured_created_idx").on(t.featured, t.createdAt),
  index("products_discount_idx").on(t.discountPercent),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
