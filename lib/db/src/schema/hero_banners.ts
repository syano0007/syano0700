import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const heroBannersTable = pgTable(
  "hero_banners",
  {
    id: serial("id").primaryKey(),
    titleAr: text("title_ar").notNull(),
    titleEn: text("title_en").notNull(),
    subtitleAr: text("subtitle_ar"),
    subtitleEn: text("subtitle_en"),
    descriptionAr: text("description_ar"),
    descriptionEn: text("description_en"),
    desktopImage: text("desktop_image").notNull(),
    mobileImage: text("mobile_image"),
    ctaLabelAr: text("cta_label_ar"),
    ctaLabelEn: text("cta_label_en"),
    ctaUrl: text("cta_url"),
    ctaLabelArSecondary: text("cta_label_ar_secondary"),
    ctaLabelEnSecondary: text("cta_label_en_secondary"),
    ctaUrlSecondary: text("cta_url_secondary"),
    backgroundColor: text("background_color").default("#0f172a"),
    textColor: text("text_color").default("#ffffff"),
    active: boolean("active").notNull().default(true),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    slot: text("slot").notNull().default("main"),
    sortOrder: integer("sort_order").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("hero_banners_active_idx").on(t.active),
    index("hero_banners_sort_order_idx").on(t.sortOrder),
  ]
);

export const insertHeroBannerSchema = createInsertSchema(heroBannersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  impressions: true,
  clicks: true,
});

export type InsertHeroBanner = z.infer<typeof insertHeroBannerSchema>;
export type HeroBanner = typeof heroBannersTable.$inferSelect;
