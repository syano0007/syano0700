import { pgTable, serial, integer, text, numeric, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const productVariantGroupsTable = pgTable("product_variant_groups", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
}, (t) => [
  index("pvg_product_id_idx").on(t.productId),
]);

export const productVariantOptionsTable = pgTable("product_variant_options", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => productVariantGroupsTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  position: integer("position").notNull().default(0),
});

export const productVariantsTable = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  sku: text("sku"),
  priceAdjustment: numeric("price_adjustment", { precision: 10, scale: 2 }).notNull().default("0"),
  price: numeric("price", { precision: 10, scale: 2 }),
  compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
  barcode: text("barcode"),
  weightGrams: integer("weight_grams"),
  dimensions: text("dimensions"),
  stock: integer("stock").notNull().default(0),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("pv_product_id_idx").on(t.productId),
]);

export const productVariantValuesTable = pgTable("product_variant_values", {
  variantId: integer("variant_id").notNull().references(() => productVariantsTable.id, { onDelete: "cascade" }),
  optionId: integer("option_id").notNull().references(() => productVariantOptionsTable.id, { onDelete: "cascade" }),
});

export const variantImagesTable = pgTable("variant_images", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => productVariantsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
  optionValueId: integer("option_value_id").references(() => productVariantOptionsTable.id, { onDelete: "set null" }),
}, (t) => [
  index("vi_variant_id_idx").on(t.variantId),
  index("vi_option_value_id_idx").on(t.optionValueId),
]);

export type ProductVariantGroup  = typeof productVariantGroupsTable.$inferSelect;
export type ProductVariantOption = typeof productVariantOptionsTable.$inferSelect;
export type ProductVariant       = typeof productVariantsTable.$inferSelect;
export type VariantImage         = typeof variantImagesTable.$inferSelect;
