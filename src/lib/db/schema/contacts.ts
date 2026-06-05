import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { contactKind, contactSource, emailVerification } from "./enums";
import { runs } from "./runs";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    source: contactSource("source").notNull(),
    kind: contactKind("kind").notNull(),
    fullName: text("full_name"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    title: text("title"),
    email: text("email"),
    // Hunter-supplied confidence score (0-100); validated at the repo boundary
    emailConfidence: integer("email_confidence"),
    emailVerification: emailVerification("email_verification").notNull().default("unverified"),
    seniority: text("seniority"),
    department: text("department"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    instagramUrl: text("instagram_url"),
    twitterUrl: text("twitter_url"),
    facebookUrl: text("facebook_url"),
    // Self-FK: raw contact row → its merged row. (): AnyPgColumn breaks circular inference.
    mergedIntoId: uuid("merged_into_id").references((): AnyPgColumn => contacts.id, {
      onDelete: "set null",
    }),
    // Populated on kind='merged' rows only (§6.3); e.g. { email: "hunter", linkedin_url: "ai" }
    fieldSources: jsonb("field_sources").$type<Record<string, "ai" | "hunter">>(),
    // Original source payload for audit and correction
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // §6.4 UNIQUE — partial (kind='person' only) so merged rows can share emails with raw rows.
    // NULLs are treated as distinct, so null-email person rows can coexist within the same source.
    uniqueIndex("contacts_run_business_source_email_uidx")
      .on(table.runId, table.businessId, table.source, table.email)
      .where(sql`${table.kind} = 'person'`),
    index("contacts_run_business_idx").on(table.runId, table.businessId), // §6.4
    index("contacts_run_kind_idx").on(table.runId, table.kind), // §6.4
    // §6.4 functional index — case-insensitive email lookup
    index("contacts_lower_email_idx").on(sql`lower(${table.email})`),
  ],
);
