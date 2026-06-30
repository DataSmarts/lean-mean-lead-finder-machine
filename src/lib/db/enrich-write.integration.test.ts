/**
 * Integration tests for the enrich transactional writer.
 * These tests require a real Neon database branch — see CLAUDE.md "Integration Tests" procedure.
 * They run in the `integration` Vitest project only (not during feature-branch dev).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { makeBusinessesRepo } from "./businesses.repo";
import type { NewContact } from "./contacts.repo";
import { makeContactsRepo } from "./contacts.repo";
import { createEnrichWriter } from "./enrich-write";
import { makeRunBusinessesRepo } from "./run-businesses.repo";
import { makeRunsRepo } from "./runs.repo";
import * as schema from "./schema";

const TEST_DB_URL = process.env.TEST_DATABASE_URL_UNPOOLED;

function skipIfNoDb() {
  if (!TEST_DB_URL) {
    console.warn("Skipping integration test: TEST_DATABASE_URL_UNPOOLED not set");
    return true;
  }
  return false;
}

const dbClient = TEST_DB_URL ? postgres(TEST_DB_URL, { prepare: false }) : null;
const db = dbClient ? drizzle(dbClient, { schema }) : null;

afterAll(async () => {
  await dbClient?.end();
});

describe("createEnrichWriter.persist (integration)", () => {
  it("skips when no DB", () => {
    if (skipIfNoDb()) return;
  });

  it("upserts raw contacts and inserts merged rows in one transaction", async () => {
    if (skipIfNoDb() || !db) return;

    const runsRepo = makeRunsRepo(db);
    const bizRepo = makeBusinessesRepo(db);
    const rbRepo = makeRunBusinessesRepo(db);
    const { persist } = createEnrichWriter(db);

    // Seed a run and business.
    const run = await runsRepo.create({
      triggerSource: "api",
      status: "enriching",
      city: "Houston",
      country: "USA",
      niche: "attorney",
      maxResults: 120,
      approvalToken: crypto.randomUUID(),
    });
    const biz = await bizRepo.upsertByPlaceId({
      googlePlaceId: `int-test-${crypto.randomUUID()}`,
      name: "Test Firm",
      websiteUri: "https://testfirm.com",
      websiteDomain: "testfirm.com",
      formattedAddress: null,
      nationalPhone: null,
      internationalPhone: null,
      rating: null,
      userRatingCount: null,
      priceLevel: null,
      types: [],
      firstSeenRunId: run.id,
      lastSeenRunId: run.id,
    });
    const { runBusiness } = await rbRepo.link(run.id, biz.id);

    const rawContact: NewContact = {
      runId: run.id,
      businessId: biz.id,
      source: "hunter",
      kind: "person",
      fullName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
      title: "CEO",
      email: "jane@testfirm.com",
      emailConfidence: 90,
      emailVerification: "valid",
      seniority: "executive",
      department: "executive",
      phone: null,
      linkedinUrl: null,
      instagramUrl: null,
      twitterUrl: null,
      facebookUrl: null,
      mergedIntoId: null,
      fieldSources: null,
      raw: { value: "jane@testfirm.com" },
    };

    const mergedContact: NewContact = {
      ...rawContact,
      kind: "merged",
      source: "hunter",
      fieldSources: { email: "hunter" },
      raw: null,
    };

    await persist({
      runId: run.id,
      runBusinessId: runBusiness.id,
      businessId: biz.id,
      rawContacts: [{ contact: rawContact, mergedPersonIndex: 0 }],
      mergedContacts: [mergedContact],
      status: {
        enrichStatus: "enriched",
        aiStatus: "skipped",
        hunterStatus: "succeeded",
        aiError: null,
        hunterError: null,
      },
      counterDeltas: { businessesEnriched: 1, businessesFailed: 0, contactsFound: 1 },
    });

    const contactsRepo = makeContactsRepo(db);
    const all = await contactsRepo.findByRunAndBusiness(run.id, biz.id);
    const raw = all.filter((c) => c.kind === "person");
    const merged = all.filter((c) => c.kind === "merged");

    expect(raw).toHaveLength(1);
    expect(merged).toHaveLength(1);
    expect(raw[0]!.mergedIntoId).toBe(merged[0]!.id);
    expect(merged[0]!.fieldSources).toEqual({ email: "hunter" });

    // Counter should have been incremented.
    const updatedRun = await runsRepo.findById(run.id);
    expect(updatedRun!.businessesEnriched).toBe(1);
    expect(updatedRun!.contactsFound).toBe(1);
  });

  it("is idempotent on retry when raw contacts have no email", async () => {
    if (skipIfNoDb() || !db) return;

    const runsRepo = makeRunsRepo(db);
    const bizRepo = makeBusinessesRepo(db);
    const rbRepo = makeRunBusinessesRepo(db);
    const { persist } = createEnrichWriter(db);

    const run = await runsRepo.create({
      triggerSource: "api",
      status: "enriching",
      city: "Test",
      country: "US",
      niche: "test",
      maxResults: 10,
      approvalToken: crypto.randomUUID(),
    });
    const biz = await bizRepo.upsertByPlaceId({
      googlePlaceId: `idempotent-${crypto.randomUUID()}`,
      name: "Idempotent Firm",
      websiteUri: null,
      websiteDomain: null,
      formattedAddress: null,
      nationalPhone: null,
      internationalPhone: null,
      rating: null,
      userRatingCount: null,
      priceLevel: null,
      types: [],
      firstSeenRunId: run.id,
      lastSeenRunId: run.id,
    });
    const { runBusiness } = await rbRepo.link(run.id, biz.id);

    const args = {
      runId: run.id,
      runBusinessId: runBusiness.id,
      businessId: biz.id,
      rawContacts: [
        {
          contact: {
            runId: run.id,
            businessId: biz.id,
            source: "ai" as const,
            kind: "person" as const,
            fullName: "Bob",
            firstName: "Bob",
            lastName: "Smith",
            title: null,
            email: null,
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
            raw: {},
          },
          mergedPersonIndex: 0,
        },
      ],
      mergedContacts: [
        {
          runId: run.id,
          businessId: biz.id,
          source: "ai" as const,
          kind: "merged" as const,
          fullName: "Bob",
          firstName: "Bob",
          lastName: "Smith",
          title: null,
          email: null,
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
          fieldSources: { full_name: "ai" as const },
          raw: null,
        },
      ],
      status: {
        enrichStatus: "enriched" as const,
        aiStatus: "succeeded" as const,
        hunterStatus: "skipped" as const,
        aiError: null,
        hunterError: null,
      },
      counterDeltas: { businessesEnriched: 1, businessesFailed: 0, contactsFound: 1 },
    };

    await persist(args);
    // Second call simulates a task retry.
    await persist({
      ...args,
      counterDeltas: { businessesEnriched: 0, businessesFailed: 0, contactsFound: 0 },
    });

    const contactsRepo = makeContactsRepo(db);
    const all = await contactsRepo.findByRunAndBusiness(run.id, biz.id);
    expect(all.filter((c) => c.kind === "merged")).toHaveLength(1);
    expect(all.filter((c) => c.kind === "person")).toHaveLength(1);

    // Counter not double-counted on retry because the service supplies zero deltas.
    const updatedRun = await runsRepo.findById(run.id);
    expect(updatedRun!.businessesEnriched).toBe(1);
  });
});
