/**
 * Integration tests: repo round-trips against a real Postgres DB.
 * Tests that updated_at actually advances, upserts are idempotent,
 * and the contacts 4-col unique index works correctly.
 *
 * Runs on PR to main only (LINEAR_GUIDE.md §9).
 * Requires DATABASE_URL_UNPOOLED pointing at a fresh migrated test DB.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { makeBusinessesRepo } from "./businesses.repo";
import { makeContactsRepo } from "./contacts.repo";
import { makeDiscoveryPagesRepo } from "./discovery-pages.repo";
import { makePresetsRepo } from "./presets.repo";
import { makeRunBusinessesRepo } from "./run-businesses.repo";
import { makeRunsRepo } from "./runs.repo";
import * as schema from "./schema";

// Use TEST_DATABASE_URL_UNPOOLED so vitest's injected dummy URL doesn't trigger connection attempts.
// Set this to a real Neon test-branch URL in the CI integration job.
const connectionString = process.env["TEST_DATABASE_URL_UNPOOLED"];
const client = connectionString ? postgres(connectionString, { prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;

function skipIfNoDb(name: string, fn: () => Promise<void>) {
  if (!db) {
    it.skip(`${name} (no DATABASE_URL_UNPOOLED provided)`, fn);
  } else {
    it(name, fn);
  }
}

afterAll(async () => {
  await client?.end();
});

// Unique suffix to isolate test rows across parallel runs
const suffix = Date.now().toString(36);

describe("presetsRepo", () => {
  skipIfNoDb("upsertByName is idempotent — second call updates, no duplicate", async () => {
    const repo = makePresetsRepo(db!);
    const data = {
      name: `Test Preset ${suffix}`,
      city: "Houston",
      country: "US",
      niche: "test niche",
      maxResults: 50,
      isActive: false,
      cron: null,
      neighborhood: null,
    };
    const first = await repo.upsertByName(data);
    const second = await repo.upsertByName({ ...data, maxResults: 99 });
    expect(second.id).toBe(first.id); // same row
    expect(second.maxResults).toBe(99); // field updated
    const all = await repo.findAll();
    expect(all.filter((p) => p.name === data.name)).toHaveLength(1);
  });

  skipIfNoDb("update stamps a fresh updatedAt", async () => {
    const repo = makePresetsRepo(db!);
    const created = await repo.create({
      name: `Stamp Test ${suffix}`,
      city: "Dallas",
      country: "US",
      niche: "test",
      maxResults: 10,
      isActive: false,
      cron: null,
      neighborhood: null,
    });
    // Small delay to guarantee clock advancement
    await new Promise((r) => setTimeout(r, 5));
    const updated = await repo.update(created.id, { maxResults: 20 });
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
  });
});

describe("businessesRepo", () => {
  skipIfNoDb("upsertByPlaceId deduplicates globally", async () => {
    const repo = makeBusinessesRepo(db!);
    const data = {
      googlePlaceId: `place_${suffix}`,
      name: "Test Business",
      types: ["restaurant"],
      websiteUri: null,
      websiteDomain: null,
      formattedAddress: null,
      nationalPhone: null,
      internationalPhone: null,
      rating: null,
      userRatingCount: null,
      priceLevel: null,
      firstSeenRunId: null,
      lastSeenRunId: null,
    };
    const first = await repo.upsertByPlaceId(data);
    const second = await repo.upsertByPlaceId({ ...data, name: "Updated Name" });
    expect(second.id).toBe(first.id); // same global row
    expect(second.name).toBe("Updated Name"); // field updated
    expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
  });
});

describe("runsRepo", () => {
  let presetId: string;

  beforeAll(async () => {
    if (!db) return;
    const repo = makePresetsRepo(db);
    const preset = await repo.create({
      name: `Run Test Preset ${suffix}`,
      city: "Austin",
      country: "US",
      niche: "lawyers",
      maxResults: 10,
      isActive: false,
      cron: null,
      neighborhood: null,
    });
    presetId = preset.id;
  });

  skipIfNoDb("updateStatus stamps updatedAt", async () => {
    const repo = makeRunsRepo(db!);
    const run = await repo.create({
      presetId,
      triggerSource: "dashboard",
      status: "queued",
      city: "Austin",
      country: "US",
      niche: "lawyers",
      maxResults: 10,
      approvalToken: `tok_${suffix}`,
      geocodeLat: null,
      geocodeLng: null,
      neighborhood: null,
      triggerRunId: null,
      error: null,
      startedAt: null,
      finishedAt: null,
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
    });
    await new Promise((r) => setTimeout(r, 5));
    const updated = await repo.updateStatus(run.id, "discovering", { startedAt: new Date() });
    expect(updated?.status).toBe("discovering");
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(run.updatedAt.getTime());
  });
});

describe("discoveryPagesRepo", () => {
  skipIfNoDb("recordPage is idempotent — second call returns undefined, no duplicate", async () => {
    if (!db) return;
    const runsRepo = makeRunsRepo(db);
    const presetsRepo = makePresetsRepo(db);
    const preset = await presetsRepo.create({
      name: `Page Test Preset ${suffix}`,
      city: "Miami",
      country: "US",
      niche: "pages",
      maxResults: 10,
      isActive: false,
      cron: null,
      neighborhood: null,
    });
    const run = await runsRepo.create({
      presetId: preset.id,
      triggerSource: "dashboard",
      status: "discovering",
      city: "Miami",
      country: "US",
      niche: "pages",
      maxResults: 10,
      approvalToken: `tok_pages_${suffix}`,
      geocodeLat: null,
      geocodeLng: null,
      neighborhood: null,
      triggerRunId: null,
      error: null,
      startedAt: null,
      finishedAt: null,
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
    });

    const repo = makeDiscoveryPagesRepo(db);
    const first = await repo.recordPage({
      runId: run.id,
      pageIndex: 0,
      resultsCount: 20,
      pageToken: null,
    });
    const second = await repo.recordPage({
      runId: run.id,
      pageIndex: 0,
      resultsCount: 20,
      pageToken: null,
    });
    expect(first).toBeDefined();
    expect(second).toBeUndefined(); // conflict → do nothing → no row returned
    const pages = await repo.findByRun(run.id);
    expect(pages).toHaveLength(1);
  });
});

describe("contactsRepo", () => {
  skipIfNoDb("upsertRaw is idempotent on (run_id, business_id, source, email)", async () => {
    if (!db) return;
    const presetsRepo = makePresetsRepo(db);
    const runsRepo = makeRunsRepo(db);
    const bizRepo = makeBusinessesRepo(db);
    const contactsRepo = makeContactsRepo(db);

    const preset = await presetsRepo.create({
      name: `Contact Preset ${suffix}`,
      city: "Seattle",
      country: "US",
      niche: "contacts",
      maxResults: 10,
      isActive: false,
      cron: null,
      neighborhood: null,
    });
    const run = await runsRepo.create({
      presetId: preset.id,
      triggerSource: "dashboard",
      status: "enriching",
      city: "Seattle",
      country: "US",
      niche: "contacts",
      maxResults: 10,
      approvalToken: `tok_contacts_${suffix}`,
      geocodeLat: null,
      geocodeLng: null,
      neighborhood: null,
      triggerRunId: null,
      error: null,
      startedAt: null,
      finishedAt: null,
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
    });
    const biz = await bizRepo.upsertByPlaceId({
      googlePlaceId: `biz_contact_${suffix}`,
      name: "Biz",
      types: [],
      websiteUri: null,
      websiteDomain: null,
      formattedAddress: null,
      nationalPhone: null,
      internationalPhone: null,
      rating: null,
      userRatingCount: null,
      priceLevel: null,
      firstSeenRunId: null,
      lastSeenRunId: null,
    });

    const contactData = {
      runId: run.id,
      businessId: biz.id,
      source: "ai" as const,
      kind: "person" as const,
      email: `test_${suffix}@example.com`,
      fullName: "Alice Smith",
      firstName: null,
      lastName: null,
      title: null,
      emailConfidence: null,
      emailVerification: "unverified" as const,
      seniority: null,
      department: null,
      phone: null,
      linkedinUrl: null,
      instagramUrl: null,
      twitterUrl: null,
      facebookUrl: null,
      mergedIntoId: null,
      fieldSources: null,
      raw: null,
    };

    const first = await contactsRepo.upsertRaw(contactData);
    const second = await contactsRepo.upsertRaw({ ...contactData, fullName: "Alice M. Smith" });
    expect(second.id).toBe(first.id);
    expect(second.fullName).toBe("Alice M. Smith");

    // findByEmail uses the functional lower(email) index
    const found = await contactsRepo.findByEmail(run.id, contactData.email.toUpperCase());
    expect(found.some((c) => c.id === first.id)).toBe(true);
  });
});

describe("runBusinessesRepo", () => {
  skipIfNoDb("link is idempotent — second call returns the existing row", async () => {
    if (!db) return;
    const presetsRepo = makePresetsRepo(db);
    const runsRepo = makeRunsRepo(db);
    const bizRepo = makeBusinessesRepo(db);
    const rbRepo = makeRunBusinessesRepo(db);

    const preset = await presetsRepo.create({
      name: `RB Preset ${suffix}`,
      city: "Denver",
      country: "US",
      niche: "rb",
      maxResults: 10,
      isActive: false,
      cron: null,
      neighborhood: null,
    });
    const run = await runsRepo.create({
      presetId: preset.id,
      triggerSource: "schedule",
      status: "discovering",
      city: "Denver",
      country: "US",
      niche: "rb",
      maxResults: 10,
      approvalToken: `tok_rb_${suffix}`,
      geocodeLat: null,
      geocodeLng: null,
      neighborhood: null,
      triggerRunId: null,
      error: null,
      startedAt: null,
      finishedAt: null,
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
    });
    const biz = await bizRepo.upsertByPlaceId({
      googlePlaceId: `biz_rb_${suffix}`,
      name: "RB Biz",
      types: [],
      websiteUri: null,
      websiteDomain: null,
      formattedAddress: null,
      nationalPhone: null,
      internationalPhone: null,
      rating: null,
      userRatingCount: null,
      priceLevel: null,
      firstSeenRunId: null,
      lastSeenRunId: null,
    });

    const first = await rbRepo.link(run.id, biz.id);
    const second = await rbRepo.link(run.id, biz.id);
    expect(second.id).toBe(first.id); // same row returned
  });
});
