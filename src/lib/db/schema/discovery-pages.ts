import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { runs } from "./runs";

// Pagination cursor + idempotency for Discover. Immutable after insert (no updated_at).
export const discoveryPages = pgTable(
  "discovery_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    pageIndex: integer("page_index").notNull(),
    pageToken: text("page_token"),
    resultsCount: integer("results_count").notNull().default(0),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("discovery_pages_run_page_uidx").on(table.runId, table.pageIndex), // §6.4 UNIQUE
  ],
);
