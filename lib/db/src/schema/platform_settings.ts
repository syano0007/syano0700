import { pgTable, text } from "drizzle-orm/pg-core";

export const platformSettingsTable = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type PlatformSetting = typeof platformSettingsTable.$inferSelect;
