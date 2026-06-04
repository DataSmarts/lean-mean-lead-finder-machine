import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { runStatus, triggerSource } from "./enums";
import { presets } from "./presets";

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    presetId: uuid("preset_id").references(() => presets.id, { onDelete: "set null" }),
    triggerSource: triggerSource("trigger_source").notNull(),
    status: runStatus("status").notNull().default("queued"),
    neighborhood: text("neighborhood"),
    city: text("city").notNull(),
    country: text("country").notNull(),
    niche: text("niche").notNull(),
    maxResults: integer("max_results").notNull(),
    geocodeLat: doublePrecision("geocode_lat"),
    geocodeLng: doublePrecision("geocode_lng"),
    businessesFound: integer("businesses_found").notNull().default(0),
    businessesEnriched: integer("businesses_enriched").notNull().default(0),
    businessesFailed: integer("businesses_failed").notNull().default(0),
    contactsFound: integer("contacts_found").notNull().default(0),
    // Unique; generated per run before insert
    approvalToken: text("approval_token").notNull().unique(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    // Trigger.dev run handle; opaque string reference
    triggerRunId: text("trigger_run_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    // §6.4: (status, created_at DESC) for the dashboard queue view
    index("runs_status_created_at_idx").on(table.status, table.createdAt.desc()),
  ],
);
