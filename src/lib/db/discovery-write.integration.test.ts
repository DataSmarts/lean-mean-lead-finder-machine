/**
 * Integration test: Discover's per-page write transaction against a real Postgres DB.
 * Verifies businesses / run_businesses / discovery_pages are populated, the counter is bumped,
 * and re-applying the same page is a no-op (idempotency via the unique constraints).
 *
 * Runs on PR to main only (LINEAR_GUIDE.md §9). Requires TEST_DATABASE_URL_UNPOOLED.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import type { NewBusiness } from "./businesses.repo";
import { makeDiscoveryPagesRepo } from "./discovery-pages.repo";
import { createPersistDiscoveryPage } from "./discovery-write";
import { makeRunBusinessesRepo } from "./run-businesses.repo";
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

const suffix = Date.now().toString(36);

function business(id: string, runId: string): NewBusiness {
  return {
    googlePlaceId: `place_${id}_${suffix}`,
    name: `Biz ${id}`,
    types: [],
    websiteUri: null,
    websiteDomain: null,
    formattedAddress: null,
    nationalPhone: null,
    internationalPhone: null,
    rating: null,
    userRatingCount: null,
    priceLevel: null,
    firstSeenRunId: runId,
    lastSeenRunId: runId,
  };
}

describe("createPersistDiscoveryPage", () => {
  skipIfNoDb("persists a page and is idempotent on re-apply", async () => {
    if (!db) return;
    const runsRepo = makeRunsRepo(db);
    const runBusinessesRepo = makeRunBusinessesRepo(db);
    const discoveryPagesRepo = makeDiscoveryPagesRepo(db);
    const persistPage = createPersistDiscoveryPage(db);

    const run = await runsRepo.create({
      triggerSource: "api",
      status: "discovering",
      city: "Houston",
      country: "USA",
      niche: "discovery-write test",
      maxResults: 100,
      approvalToken: `tok_disc_${suffix}`,
      neighborhood: null,
      presetId: null,
    });

    const page = [business("a", run.id), business("b", run.id)];
    const first = await persistPage({
      runId: run.id,
      pageIndex: 0,
      pageToken: "next-1",
      businesses: page,
    });

    expect(first.created).toBe(2);
    expect(await runBusinessesRepo.findByRun(run.id)).toHaveLength(2);
    const pages = await discoveryPagesRepo.findByRun(run.id);
    expect(pages).toHaveLength(1);
    expect(pages[0].pageToken).toBe("next-1");
    expect((await runsRepo.findById(run.id))?.businessesFound).toBe(2);

    const second = await persistPage({
      runId: run.id,
      pageIndex: 0,
      pageToken: "next-1",
      businesses: page,
    });

    expect(second.created).toBe(0); // nothing new linked
    expect(await runBusinessesRepo.findByRun(run.id)).toHaveLength(2); // no duplicate links
    expect(await discoveryPagesRepo.findByRun(run.id)).toHaveLength(1); // page not re-recorded
    expect((await runsRepo.findById(run.id))?.businessesFound).toBe(2); // counter unchanged
  });
});
