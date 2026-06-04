/**
 * Verifies that drizzle-kit migrate has been applied correctly:
 * all 6 tables, all §6.4 indexes/unique constraints, and the correct enum types exist.
 *
 * Runs against a real Postgres DB (DATABASE_URL_UNPOOLED in the environment).
 * Intended for the PR gate to main — not run on feature branches (LINEAR_GUIDE.md §9).
 */
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

// Use TEST_DATABASE_URL_UNPOOLED so vitest's injected dummy URL doesn't trigger connection attempts.
// Set this to a real Neon test-branch URL in the CI integration job.
const connectionString = process.env["TEST_DATABASE_URL_UNPOOLED"];

const client = connectionString ? postgres(connectionString, { prepare: false }) : null;

afterAll(async () => {
  await client?.end();
});

function skipIfNoDb(name: string, fn: () => Promise<void>) {
  if (!client) {
    it.skip(`${name} (no DATABASE_URL_UNPOOLED provided)`, fn);
  } else {
    it(name, fn);
  }
}

describe("migrations", () => {
  skipIfNoDb("all 6 tables exist in the public schema", async () => {
    const rows = await client!<{ tableName: string }[]>`
      SELECT table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tables = rows.map((r) => r.tableName);
    expect(tables).toContain("presets");
    expect(tables).toContain("runs");
    expect(tables).toContain("businesses");
    expect(tables).toContain("run_businesses");
    expect(tables).toContain("discovery_pages");
    expect(tables).toContain("contacts");
  });

  skipIfNoDb("§6.4 unique indexes exist", async () => {
    const rows = await client!<{ indexName: string }[]>`
      SELECT indexname AS "indexName"
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;
    const names = rows.map((r) => r.indexName);
    expect(names).toContain("businesses_google_place_id_uidx");
    expect(names).toContain("run_businesses_run_business_uidx");
    expect(names).toContain("discovery_pages_run_page_uidx");
    expect(names).toContain("contacts_run_business_source_email_uidx");
  });

  skipIfNoDb("§6.4 composite and functional indexes exist", async () => {
    const rows = await client!<{ indexName: string }[]>`
      SELECT indexname AS "indexName"
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;
    const names = rows.map((r) => r.indexName);
    expect(names).toContain("runs_status_created_at_idx");
    expect(names).toContain("run_businesses_run_enrich_idx");
    expect(names).toContain("businesses_website_domain_idx");
    expect(names).toContain("contacts_run_business_idx");
    expect(names).toContain("contacts_run_kind_idx");
    expect(names).toContain("contacts_lower_email_idx");
  });

  skipIfNoDb("§6.2 run_status enum has correct values in order", async () => {
    const rows = await client!<{ enumValue: string }[]>`
      SELECT e.enumlabel AS "enumValue"
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'run_status'
      ORDER BY e.enumsortorder
    `;
    expect(rows.map((r) => r.enumValue)).toEqual([
      "queued",
      "discovering",
      "awaiting_approval",
      "rejected",
      "enriching",
      "completed",
      "failed",
      "canceled",
    ]);
  });

  skipIfNoDb("§6.2 business_enrich_status enum has correct values in order", async () => {
    const rows = await client!<{ enumValue: string }[]>`
      SELECT e.enumlabel AS "enumValue"
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'business_enrich_status'
      ORDER BY e.enumsortorder
    `;
    expect(rows.map((r) => r.enumValue)).toEqual([
      "queued",
      "ai_running",
      "hunter_running",
      "enriched",
      "partial",
      "failed",
      "skipped",
    ]);
  });

  skipIfNoDb("§6.2 email_verification enum has correct values in order", async () => {
    const rows = await client!<{ enumValue: string }[]>`
      SELECT e.enumlabel AS "enumValue"
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'email_verification'
      ORDER BY e.enumsortorder
    `;
    expect(rows.map((r) => r.enumValue)).toEqual([
      "valid",
      "invalid",
      "accept_all",
      "webmail",
      "disposable",
      "unknown",
      "unverified",
    ]);
  });

  skipIfNoDb("runs.approval_token is unique", async () => {
    const rows = await client!<{ indexName: string; unique: boolean }[]>`
      SELECT indexname AS "indexName", indisunique AS "unique"
      FROM pg_indexes
      JOIN pg_class ON pg_class.relname = pg_indexes.indexname
      JOIN pg_index ON pg_index.indexrelid = pg_class.oid
      WHERE pg_indexes.schemaname = 'public'
        AND pg_indexes.tablename = 'runs'
        AND indisunique = true
    `;
    const names = rows.map((r) => r.indexName);
    expect(names.some((n) => n.includes("approval_token"))).toBe(true);
  });
});
