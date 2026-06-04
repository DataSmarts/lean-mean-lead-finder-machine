import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { businessEnrichStatus, sourceStatus } from "./enums";
import { runs } from "./runs";

export const runBusinesses = pgTable(
  "run_businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    enrichStatus: businessEnrichStatus("enrich_status").notNull().default("queued"),
    aiStatus: sourceStatus("ai_status").notNull().default("queued"),
    hunterStatus: sourceStatus("hunter_status").notNull().default("queued"),
    aiError: text("ai_error"),
    hunterError: text("hunter_error"),
    attempts: integer("attempts").notNull().default(0),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("run_businesses_run_business_uidx").on(table.runId, table.businessId), // §6.4 UNIQUE
    index("run_businesses_run_enrich_idx").on(table.runId, table.enrichStatus), // §6.4 fan-out worklist
  ],
);
