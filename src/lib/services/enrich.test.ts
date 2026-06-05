import { describe, expect, it, vi } from "vitest";

import type { Business } from "@/lib/db/businesses.repo";
import type { PersistEnrichment, PersistReuseEnrichment } from "@/lib/db/enrich-write";
import type { RunBusiness } from "@/lib/db/run-businesses.repo";

import type { AiEnrichService } from "./ai-enrich";
import {
  createEnrichService,
  ENRICH_REUSE_DAYS,
  type EnrichBusinessesRepo,
  type EnrichRunBusinessesRepo,
  rollUpStatus,
} from "./enrich";
import type { HunterEnrichService } from "./hunter-enrich";
import type { SourceContact } from "./merge";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRunBusiness(overrides: Partial<RunBusiness> = {}): RunBusiness {
  return {
    id: "rb-1",
    runId: "run-1",
    businessId: "biz-1",
    enrichStatus: "queued",
    aiStatus: "queued",
    hunterStatus: "queued",
    aiError: null,
    hunterError: null,
    attempts: 0,
    enrichedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: "biz-1",
    googlePlaceId: "place-1",
    name: "Acme Law",
    websiteUri: "https://acmelaw.com",
    websiteDomain: "acmelaw.com",
    formattedAddress: "123 Main St",
    nationalPhone: null,
    internationalPhone: null,
    rating: null,
    userRatingCount: null,
    priceLevel: null,
    types: [],
    firstSeenRunId: null,
    lastSeenRunId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

const aiContact: SourceContact = {
  source: "ai",
  fullName: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  title: "CEO",
  email: null,
  emailConfidence: null,
  emailVerification: null,
  seniority: null,
  department: null,
  phone: null,
  linkedinUrl: null,
  instagramUrl: null,
  twitterUrl: null,
  facebookUrl: null,
  raw: {},
};

const hunterContact: SourceContact = {
  source: "hunter",
  fullName: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  title: null,
  email: "jane@acmelaw.com",
  emailConfidence: 90,
  emailVerification: "valid",
  seniority: null,
  department: null,
  phone: null,
  linkedinUrl: null,
  instagramUrl: null,
  twitterUrl: null,
  facebookUrl: null,
  raw: {},
};

function makeRbRepo(overrides: Partial<EnrichRunBusinessesRepo> = {}): EnrichRunBusinessesRepo {
  return {
    findById: vi.fn().mockResolvedValue(makeRunBusiness()),
    updateStatus: vi.fn().mockResolvedValue(makeRunBusiness()),
    findReusable: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeBizRepo(biz = makeBusiness()): EnrichBusinessesRepo {
  return { findById: vi.fn().mockResolvedValue(biz) };
}

function makeAiService(contacts: SourceContact[] = [aiContact]): AiEnrichService {
  return { enrich: vi.fn().mockResolvedValue(contacts) };
}

function makeHunterService(contacts: SourceContact[] = [hunterContact]): HunterEnrichService {
  return { enrich: vi.fn().mockResolvedValue(contacts) };
}

function makePersist(): PersistEnrichment {
  return vi.fn().mockResolvedValue({ newlyTerminal: true });
}

function makePersistReuse(): PersistReuseEnrichment {
  return vi.fn().mockResolvedValue({ contactsCopied: 4 });
}

// ── rollUpStatus ─────────────────────────────────────────────────────────────

describe("rollUpStatus", () => {
  it("enriched when both succeed", () => {
    expect(rollUpStatus("succeeded", "succeeded")).toBe("enriched");
  });

  it("enriched when AI succeeds and Hunter is skipped", () => {
    expect(rollUpStatus("succeeded", "skipped")).toBe("enriched");
  });

  it("failed when both fail", () => {
    expect(rollUpStatus("failed", "failed")).toBe("failed");
  });

  it("partial when AI fails and Hunter succeeds", () => {
    expect(rollUpStatus("failed", "succeeded")).toBe("partial");
  });

  it("partial when AI succeeds and Hunter fails", () => {
    expect(rollUpStatus("succeeded", "failed")).toBe("partial");
  });
});

// ── enrichBusiness ───────────────────────────────────────────────────────────

describe("createEnrichService.enrichBusiness", () => {
  it("runs AI and Hunter in parallel and calls persist with merged results", async () => {
    const persist = makePersist();
    const service = createEnrichService({
      runBusinessesRepo: makeRbRepo(),
      businessesRepo: makeBizRepo(),
      aiEnrichService: makeAiService(),
      hunterEnrichService: makeHunterService(),
      persist,
      persistReuse: makePersistReuse(),
    });

    const result = await service.enrichBusiness("rb-1");

    expect(result.enrichStatus).toBe("enriched");
    expect(result.aiStatus).toBe("succeeded");
    expect(result.hunterStatus).toBe("succeeded");
    expect(result.mergedCount).toBeGreaterThan(0);
    expect(persist).toHaveBeenCalledOnce();
  });

  it("yields partial and persists when AI fails but Hunter succeeds", async () => {
    const persist = makePersist();
    const service = createEnrichService({
      runBusinessesRepo: makeRbRepo(),
      businessesRepo: makeBizRepo(),
      aiEnrichService: { enrich: vi.fn().mockRejectedValue(new Error("ai error")) },
      hunterEnrichService: makeHunterService(),
      persist,
      persistReuse: makePersistReuse(),
    });

    const result = await service.enrichBusiness("rb-1");

    expect(result.enrichStatus).toBe("partial");
    expect(result.aiStatus).toBe("failed");
    expect(result.hunterStatus).toBe("succeeded");
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        aiError: "ai error",
        enrichStatus: "partial",
      }),
    );
  });

  it("skips Hunter when the business has no websiteDomain", async () => {
    const hunterService = makeHunterService();
    const service = createEnrichService({
      runBusinessesRepo: makeRbRepo(),
      businessesRepo: makeBizRepo(makeBusiness({ websiteDomain: null, websiteUri: null })),
      aiEnrichService: makeAiService(),
      hunterEnrichService: hunterService,
      persist: makePersist(),
      persistReuse: makePersistReuse(),
    });

    const result = await service.enrichBusiness("rb-1");

    expect(result.hunterStatus).toBe("skipped");
    expect(hunterService.enrich).not.toHaveBeenCalled();
    expect(result.enrichStatus).toBe("enriched"); // AI succeeded + Hunter skipped
  });

  it("calls persistReuse when a reusable run_business exists", async () => {
    const reusableRb = makeRunBusiness({
      id: "old-rb",
      runId: "old-run",
      enrichStatus: "enriched",
      enrichedAt: new Date(), // just enriched
    });
    const persistReuse = makePersistReuse();
    const service = createEnrichService({
      runBusinessesRepo: makeRbRepo({
        findReusable: vi.fn().mockResolvedValue(reusableRb),
      }),
      businessesRepo: makeBizRepo(),
      aiEnrichService: makeAiService(),
      hunterEnrichService: makeHunterService(),
      persist: makePersist(),
      persistReuse,
    });

    const result = await service.enrichBusiness("rb-1");

    expect(result.reused).toBe(true);
    expect(persistReuse).toHaveBeenCalledWith(expect.objectContaining({ sourceRunId: "old-run" }));
  });

  it("does not call AI/Hunter when reusing", async () => {
    const aiService = makeAiService();
    const hunterService = makeHunterService();
    const service = createEnrichService({
      runBusinessesRepo: makeRbRepo({
        findReusable: vi
          .fn()
          .mockResolvedValue(makeRunBusiness({ runId: "old-run", enrichedAt: new Date() })),
      }),
      businessesRepo: makeBizRepo(),
      aiEnrichService: aiService,
      hunterEnrichService: hunterService,
      persist: makePersist(),
      persistReuse: makePersistReuse(),
    });

    await service.enrichBusiness("rb-1");

    expect(aiService.enrich).not.toHaveBeenCalled();
    expect(hunterService.enrich).not.toHaveBeenCalled();
  });

  it("uses findReusable with the correct 30-day window and excludes the current run", async () => {
    const fixedNow = new Date("2026-06-01T00:00:00Z");
    const rbRepo = makeRbRepo();
    const service = createEnrichService({
      runBusinessesRepo: rbRepo,
      businessesRepo: makeBizRepo(),
      aiEnrichService: makeAiService(),
      hunterEnrichService: makeHunterService(),
      persist: makePersist(),
      persistReuse: makePersistReuse(),
      now: () => fixedNow,
    });

    await service.enrichBusiness("rb-1");

    const expectedSince = new Date(fixedNow.getTime() - ENRICH_REUSE_DAYS * 24 * 60 * 60 * 1000);
    expect(rbRepo.findReusable).toHaveBeenCalledWith("biz-1", expectedSince, "run-1");
  });

  it("throws when the RunBusiness is not found", async () => {
    const service = createEnrichService({
      runBusinessesRepo: makeRbRepo({ findById: vi.fn().mockResolvedValue(undefined) }),
      businessesRepo: makeBizRepo(),
      aiEnrichService: makeAiService(),
      hunterEnrichService: makeHunterService(),
      persist: makePersist(),
      persistReuse: makePersistReuse(),
    });

    await expect(service.enrichBusiness("ghost")).rejects.toThrow(/RunBusiness ghost not found/);
  });
});
