import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const presets = pgTable("presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  // unique enables the seed's ON CONFLICT (name) DO UPDATE
  name: text("name").notNull().unique(),
  neighborhood: text("neighborhood"),
  city: text("city").notNull(),
  country: text("country").notNull(),
  niche: text("niche").notNull(),
  maxResults: integer("max_results").notNull().default(120),
  isActive: boolean("is_active").notNull().default(true),
  cron: text("cron"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
