import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    googlePlaceId: text("google_place_id").notNull(),
    name: text("name").notNull(),
    websiteUri: text("website_uri"),
    websiteDomain: text("website_domain"),
    formattedAddress: text("formatted_address"),
    nationalPhone: text("national_phone"),
    internationalPhone: text("international_phone"),
    rating: doublePrecision("rating"),
    userRatingCount: integer("user_rating_count"),
    // Google Places API v1 returns priceLevel as an enum string (e.g. PRICE_LEVEL_MODERATE)
    priceLevel: text("price_level"),
    types: text("types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Soft uuid refs: businesses are global (§6.1); no FK to avoid run-lifecycle coupling.
    firstSeenRunId: uuid("first_seen_run_id"),
    lastSeenRunId: uuid("last_seen_run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("businesses_google_place_id_uidx").on(table.googlePlaceId), // §6.4 UNIQUE
    index("businesses_website_domain_idx").on(table.websiteDomain), // §6.4
  ],
);
