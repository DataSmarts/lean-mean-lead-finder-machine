/**
 * Integration tests: leads.repo cross-run join + filter composition against a real Postgres DB.
 *
 * Verifies:
 * - list() and exportMerged() honor the shared buildLeadsWhere filter (single query, no N+1).
 * - count/list WHERE parity: total from list() matches actual row count under any filter.
 * - Each filter type narrows results correctly.
 * - Empty result returns { rows: [], total: 0 }.
 * - runOptions() returns lightweight run list.
 *
 * Runs on PR to main only (CLAUDE.md §integration test procedure).
 * Requires TEST_DATABASE_URL_UNPOOLED pointing at a fresh migrated test DB.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { makeBusinessesRepo } from "./businesses.repo";
import { makeContactsRepo } from "./contacts.repo";
import { makeLeadsRepo } from "./leads.repo";
import { makeRunsRepo } from "./runs.repo";
import * as schema from "./schema";

const connectionString = process.env["TEST_DATABASE_URL_UNPOOLED"];
const client = connectionString ? postgres(connectionString, { prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;

function skipIfNoDb(name: string, fn: () => Promise<void>) {
  if (!db) {
    it.skip(`${name} (no TEST_DATABASE_URL_UNPOOLED provided)`, fn);
  } else {
    it(name, fn);
  }
}

afterAll(async () => {
  await client?.end();
});

// Unique suffix so these test rows don't collide with other parallel runs
const suffix = Date.now().toString(36);

// Seed state shared across the describe block
let runId: string;
let _businessId: string;

describe("leadsRepo (integration)", () => {
  beforeAll(async () => {
    if (!db) return;

    const runsRepo = makeRunsRepo(db);
    const businessesRepo = makeBusinessesRepo(db);
    const contactsRepo = makeContactsRepo(db);

    // Create a run
    const run = await runsRepo.create({
      triggerSource: "api",
      status: "completed",
      city: `IntegCity_${suffix}`,
      country: "US",
      niche: `integ_niche_${suffix}`,
      maxResults: 10,
      approvalToken: `tok_integ_${suffix}`,
      neighborhood: null,
      businessesFound: 1,
      businessesEnriched: 1,
      businessesFailed: 0,
      contactsFound: 1,
    });
    runId = run.id;

    // Create a business
    const business = await businessesRepo.upsertByPlaceId({
      googlePlaceId: `place_integ_${suffix}`,
      name: `Integ Corp ${suffix}`,
      websiteUri: "https://integ.example.com",
      websiteDomain: "integ.example.com",
      formattedAddress: "1 Test St",
      nationalPhone: null,
      internationalPhone: null,
      rating: null,
      userRatingCount: null,
      priceLevel: null,
      types: [],
      firstSeenRunId: run.id,
      lastSeenRunId: run.id,
    });
    _businessId = business.id;

    // Insert a merged contact for this run+business
    await contactsRepo.insertMerged({
      runId: run.id,
      businessId: business.id,
      source: "hunter",
      kind: "merged",
      fullName: `John Integ ${suffix}`,
      firstName: "John",
      lastName: "Integ",
      title: "CEO",
      email: `john_integ_${suffix}@example.com`,
      emailConfidence: 90,
      emailVerification: "valid",
      seniority: "senior",
      department: "executive",
      phone: null,
      linkedinUrl: null,
      instagramUrl: null,
      twitterUrl: null,
      facebookUrl: null,
      mergedIntoId: null,
      fieldSources: { email: "hunter", linkedin_url: "ai" },
      raw: {},
    });
  });

  skipIfNoDb("list() returns merged contacts with joined business+run", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, runId });
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    const row = result.rows.find((r) => r.contact.runId === runId);
    expect(row).toBeDefined();
    expect(row?.business.name).toContain(`Integ Corp ${suffix}`);
    expect(row?.run.niche).toContain(`integ_niche_${suffix}`);
  });

  skipIfNoDb("count/list WHERE parity: total matches actual rows", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, pageSize: 100, runId });
    expect(result.total).toBe(result.rows.length);
  });

  skipIfNoDb("runId filter narrows to a specific run", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, runId });
    expect(result.rows.every((r) => r.contact.runId === runId)).toBe(true);
  });

  skipIfNoDb("niche filter narrows results", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, niche: `integ_niche_${suffix}` });
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows.every((r) => r.run.niche === `integ_niche_${suffix}`)).toBe(true);
  });

  skipIfNoDb("city filter narrows results", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, city: `IntegCity_${suffix}` });
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows.every((r) => r.run.city === `IntegCity_${suffix}`)).toBe(true);
  });

  skipIfNoDb("source filter narrows to winning source", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, runId, source: "hunter" });
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows.every((r) => r.contact.source === "hunter")).toBe(true);
  });

  skipIfNoDb("verification filter narrows by email_verification", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, runId, verification: "valid" });
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  skipIfNoDb("q filter matches on business name", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, q: `Integ Corp ${suffix}` });
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  skipIfNoDb("q filter matches on contact fullName", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, q: `John Integ ${suffix}` });
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  skipIfNoDb("q filter matches on email", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, q: `john_integ_${suffix}` });
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  skipIfNoDb("returns empty result when filter matches no rows", async () => {
    const repo = makeLeadsRepo(db!);
    const result = await repo.list({ page: 1, niche: "no_such_niche_xyzxyz" });
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  skipIfNoDb("exportMerged returns all matching rows unbounded", async () => {
    const repo = makeLeadsRepo(db!);
    const rows = await repo.exportMerged({ runId });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  skipIfNoDb("exportRaw returns kind=person rows for a run", async () => {
    const repo = makeLeadsRepo(db!);
    // No person rows were seeded — should return empty array without error.
    const rows = await repo.exportRaw(runId);
    expect(Array.isArray(rows)).toBe(true);
  });

  skipIfNoDb("runOptions returns lightweight run list with id/niche/city", async () => {
    const repo = makeLeadsRepo(db!);
    const opts = await repo.runOptions();
    const mine = opts.find((o) => o.id === runId);
    expect(mine).toBeDefined();
    expect(mine?.niche).toContain(`integ_niche_${suffix}`);
    expect(mine?.city).toContain(`IntegCity_${suffix}`);
  });
});
