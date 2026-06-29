import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { DEFAULT_MAX_RESULTS } from "@/lib/config/defaults";

export const presets = pgTable("presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  // unique enables the seed's ON CONFLICT (name) DO UPDATE
  name: text("name").notNull().unique(),
  neighborhood: text("neighborhood"),
  city: text("city").notNull(),
  country: text("country").notNull(),
  niche: text("niche").notNull(),
  maxResults: integer("max_results").notNull().default(DEFAULT_MAX_RESULTS),
  isActive: boolean("is_active").notNull().default(true),
  cron: text("cron"),
  // Trigger.dev schedule handle — populated after schedules.create(); null when no schedule is registered.
  scheduleId: text("schedule_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
