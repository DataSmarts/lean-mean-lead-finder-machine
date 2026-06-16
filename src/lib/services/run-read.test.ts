import { describe, expect, it, vi } from "vitest";

import type { RunReadContactsRepo, RunReadRunBusinessesRepo, RunReadRunsRepo } from "./run-read";
import { createRunReadService } from "./run-read";

// --- Fixtures -----------------------------------------------------------------

const NOW = new Date("2024-01-15T12:00:00.000Z");
const NOW_ISO = "2024-01-15T12:00:00.000Z";

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    triggerSource: "dashboard" as const,
    status: "enriching" as const,
    neighborhood: null,
    city: "Houston",
    country: "United States",
    niche: "family law attorney",
    maxResults: 120,
    businessesFound: 5,
    businessesEnriched: 3,
    businessesFailed: 1,
    contactsFound: 8,
    approvedAt: NOW,
    approvedBy: "admin",
    rejectedAt: null,
    error: null,
    createdAt: NOW,
    updatedAt: NOW,
    startedAt: NOW,
    finishedAt: null,
    // Sensitive/internal — must NOT appear in the view:
    approvalToken: "secret-token-abc",
    approvalWaitpointId: "waitpoint-xyz",
    approvalMessageId: 123,
    triggerRunId: "trigger-run-123",
    presetId: null,
    geocodeLat: 29.7604,
    geocodeLng: -95.3698,
    ...overrides,
  };
}

function makeBusiness(id = "biz-1") {
  return {
    id,
    googlePlaceId: `place-${id}`,
    name: `Business ${id}`,
    websiteUri: `https://example.com/${id}`,
    websiteDomain: `example.com`,
    formattedAddress: "123 Main St",
    nationalPhone: "(713) 555-0001",
    internationalPhone: "+1 713 555 0001",
    rating: 4.5,
    userRatingCount: 100,
    priceLevel: null,
    types: ["lawyer"],
    firstSeenRunId: null,
    lastSeenRunId: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeRunBusiness(runId = "run-1", businessId = "biz-1") {
  return {
    id: `rb-${businessId}`,
    runId,
    businessId,
    enrichStatus: "enriched" as const,
    aiStatus: "succeeded" as const,
    hunterStatus: "succeeded" as const,
    aiError: null,
    hunterError: null,
    attempts: 1,
    enrichedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeContact(businessId = "biz-1") {
  return {
    id: `contact-${businessId}`,
    runId: "run-1",
    businessId,
    source: "ai" as const,
    kind: "merged" as const,
    fullName: "Jane Smith",
    firstName: "Jane",
    lastName: "Smith",
    title: "Partner",
    email: "jane@example.com",
    emailConfidence: 90,
    emailVerification: "valid" as const,
    seniority: "senior",
    department: "legal",
    phone: null,
    linkedinUrl: null,
    instagramUrl: null,
    twitterUrl: null,
    facebookUrl: null,
    mergedIntoId: null,
    fieldSources: { email: "hunter" },
    raw: null,
    createdAt: NOW,
  };
}

// --- Helpers ------------------------------------------------------------------

function makeRepos(
  overrides: {
    runsRepo?: Partial<RunReadRunsRepo>;
    runBusinessesRepo?: Partial<RunReadRunBusinessesRepo>;
    contactsRepo?: Partial<RunReadContactsRepo>;
  } = {},
) {
  const runsRepo: RunReadRunsRepo = {
    findById: vi.fn().mockResolvedValue(makeRun()),
    ...overrides.runsRepo,
  };
  const runBusinessesRepo: RunReadRunBusinessesRepo = {
    findByRunWithBusiness: vi
      .fn()
      .mockResolvedValue([{ runBusiness: makeRunBusiness(), business: makeBusiness() }]),
    ...overrides.runBusinessesRepo,
  };
  const contactsRepo: RunReadContactsRepo = {
    findMerged: vi.fn().mockResolvedValue([makeContact()]),
    ...overrides.contactsRepo,
  };
  return { runsRepo, runBusinessesRepo, contactsRepo };
}

// --- Tests --------------------------------------------------------------------

describe("createRunReadService.getDetail", () => {
  it("returns null when the run is not found", async () => {
    const { runsRepo, runBusinessesRepo, contactsRepo } = makeRepos({
      runsRepo: { findById: vi.fn().mockResolvedValue(undefined) },
    });
    const service = createRunReadService({ runsRepo, runBusinessesRepo, contactsRepo });
    expect(await service.getDetail("run-missing")).toBeNull();
  });

  it("returns run with businesses and nested contacts", async () => {
    const { runsRepo, runBusinessesRepo, contactsRepo } = makeRepos();
    const service = createRunReadService({ runsRepo, runBusinessesRepo, contactsRepo });
    const view = await service.getDetail("run-1");

    expect(view).not.toBeNull();
    expect(view!.run.id).toBe("run-1");
    expect(view!.businesses).toHaveLength(1);
    expect(view!.businesses[0]!.contacts).toHaveLength(1);
  });

  it("groups merged contacts under the correct businessId", async () => {
    const { runsRepo, runBusinessesRepo, contactsRepo } = makeRepos({
      runBusinessesRepo: {
        findByRunWithBusiness: vi.fn().mockResolvedValue([
          { runBusiness: makeRunBusiness("run-1", "biz-1"), business: makeBusiness("biz-1") },
          { runBusiness: makeRunBusiness("run-1", "biz-2"), business: makeBusiness("biz-2") },
        ]),
      },
      contactsRepo: {
        findMerged: vi.fn().mockResolvedValue([makeContact("biz-1"), makeContact("biz-2")]),
      },
    });
    const service = createRunReadService({ runsRepo, runBusinessesRepo, contactsRepo });
    const view = await service.getDetail("run-1");

    const biz1 = view!.businesses.find((b) => b.business.id === "biz-1");
    const biz2 = view!.businesses.find((b) => b.business.id === "biz-2");
    expect(biz1!.contacts).toHaveLength(1);
    expect(biz2!.contacts).toHaveLength(1);
    expect(biz1!.contacts[0]!.email).toBe("jane@example.com");
  });

  it("gives an empty contacts array for a business with no merged contacts", async () => {
    const { runsRepo, runBusinessesRepo, contactsRepo } = makeRepos({
      contactsRepo: { findMerged: vi.fn().mockResolvedValue([]) },
    });
    const service = createRunReadService({ runsRepo, runBusinessesRepo, contactsRepo });
    const view = await service.getDetail("run-1");

    expect(view!.businesses[0]!.contacts).toEqual([]);
  });

  it("returns businesses: [] when the run has no run_businesses", async () => {
    const { runsRepo, runBusinessesRepo, contactsRepo } = makeRepos({
      runBusinessesRepo: { findByRunWithBusiness: vi.fn().mockResolvedValue([]) },
      contactsRepo: { findMerged: vi.fn().mockResolvedValue([]) },
    });
    const service = createRunReadService({ runsRepo, runBusinessesRepo, contactsRepo });
    const view = await service.getDetail("run-1");

    expect(view!.businesses).toEqual([]);
  });

  it("serializes all run timestamps to ISO strings", async () => {
    const { runsRepo, runBusinessesRepo, contactsRepo } = makeRepos();
    const service = createRunReadService({ runsRepo, runBusinessesRepo, contactsRepo });
    const view = await service.getDetail("run-1");

    expect(view!.run.createdAt).toBe(NOW_ISO);
    expect(view!.run.updatedAt).toBe(NOW_ISO);
    expect(view!.run.startedAt).toBe(NOW_ISO);
    expect(view!.run.approvedAt).toBe(NOW_ISO);
  });

  it("serializes nullable timestamps to null (not 'null' or a placeholder date)", async () => {
    const { runsRepo, runBusinessesRepo, contactsRepo } = makeRepos({
      runsRepo: {
        findById: vi
          .fn()
          .mockResolvedValue({ ...makeRun(), finishedAt: null, rejectedAt: null, startedAt: null }),
      },
    });
    const service = createRunReadService({ runsRepo, runBusinessesRepo, contactsRepo });
    const view = await service.getDetail("run-1");

    expect(view!.run.finishedAt).toBeNull();
    expect(view!.run.rejectedAt).toBeNull();
    expect(view!.run.startedAt).toBeNull();
  });

  it("excludes sensitive/internal fields from the run view", async () => {
    const { runsRepo, runBusinessesRepo, contactsRepo } = makeRepos();
    const service = createRunReadService({ runsRepo, runBusinessesRepo, contactsRepo });
    const view = await service.getDetail("run-1");

    const runView = view!.run as unknown as Record<string, unknown>;
    expect(runView["approvalToken"]).toBeUndefined();
    expect(runView["approvalWaitpointId"]).toBeUndefined();
    expect(runView["approvalMessageId"]).toBeUndefined();
    expect(runView["triggerRunId"]).toBeUndefined();
    expect(runView["presetId"]).toBeUndefined();
    expect(runView["geocodeLat"]).toBeUndefined();
    expect(runView["geocodeLng"]).toBeUndefined();
  });

  it("calls contactsRepo.findMerged exactly once regardless of business count (no N+1)", async () => {
    const findMerged = vi.fn().mockResolvedValue([]);
    const { runsRepo, runBusinessesRepo } = makeRepos({
      runBusinessesRepo: {
        findByRunWithBusiness: vi.fn().mockResolvedValue([
          { runBusiness: makeRunBusiness("run-1", "biz-1"), business: makeBusiness("biz-1") },
          { runBusiness: makeRunBusiness("run-1", "biz-2"), business: makeBusiness("biz-2") },
          { runBusiness: makeRunBusiness("run-1", "biz-3"), business: makeBusiness("biz-3") },
        ]),
      },
    });
    const contactsRepo: RunReadContactsRepo = { findMerged };
    const service = createRunReadService({ runsRepo, runBusinessesRepo, contactsRepo });
    await service.getDetail("run-1");

    expect(findMerged).toHaveBeenCalledTimes(1);
    expect(findMerged).toHaveBeenCalledWith("run-1");
  });

  it("preserves business ordering from the repo", async () => {
    const bizPairs = [
      {
        runBusiness: makeRunBusiness("run-1", "biz-a"),
        business: { ...makeBusiness("biz-a"), name: "Alpha" },
      },
      {
        runBusiness: makeRunBusiness("run-1", "biz-b"),
        business: { ...makeBusiness("biz-b"), name: "Beta" },
      },
      {
        runBusiness: makeRunBusiness("run-1", "biz-c"),
        business: { ...makeBusiness("biz-c"), name: "Gamma" },
      },
    ];
    const { runsRepo, contactsRepo } = makeRepos({
      contactsRepo: { findMerged: vi.fn().mockResolvedValue([]) },
    });
    const runBusinessesRepo: RunReadRunBusinessesRepo = {
      findByRunWithBusiness: vi.fn().mockResolvedValue(bizPairs),
    };
    const service = createRunReadService({ runsRepo, runBusinessesRepo, contactsRepo });
    const view = await service.getDetail("run-1");

    expect(view!.businesses.map((b) => b.business.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });
});
