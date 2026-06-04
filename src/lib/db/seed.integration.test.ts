/**
 * Verifies that db:seed is idempotent: running it twice yields identical rows.
 * Runs on PR to main only (LINEAR_GUIDE.md §9).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { makePresetsRepo } from "./presets.repo";
import * as schema from "./schema";

// Use TEST_DATABASE_URL_UNPOOLED so vitest's injected dummy URL doesn't trigger connection attempts.
// Set this to a real Neon test-branch URL in the CI integration job.
const connectionString = process.env["TEST_DATABASE_URL_UNPOOLED"];
const client = connectionString ? postgres(connectionString, { prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;

afterAll(async () => {
  await client?.end();
});

function skipIfNoDb(name: string, fn: () => Promise<void>) {
  if (!db) {
    it.skip(`${name} (no DATABASE_URL_UNPOOLED provided)`, fn);
  } else {
    it(name, fn);
  }
}

describe("seed idempotency", () => {
  skipIfNoDb("upsertByName twice produces no duplicates", async () => {
    const repo = makePresetsRepo(db!);
    const data = {
      name: "Seed Idempotency Test",
      city: "Chicago",
      country: "US",
      niche: "idempotency test",
      maxResults: 5,
      isActive: false,
      cron: null,
      neighborhood: null,
    };
    const first = await repo.upsertByName(data);
    const second = await repo.upsertByName(data);
    expect(second.id).toBe(first.id);

    const all = await repo.findAll();
    expect(all.filter((p) => p.name === data.name)).toHaveLength(1);
  });
});
