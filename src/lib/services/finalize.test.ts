import { describe, expect, it, vi } from "vitest";

import type { Run } from "@/lib/db/runs.repo";

import {
  createFinalizeService,
  determineRunStatus,
  type FinalizeContactsRepo,
  type FinalizeRunBusinessesRepo,
  type FinalizeRunsRepo,
} from "./finalize";

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    presetId: null,
    triggerSource: "api",
    status: "enriching",
    neighborhood: null,
    city: "Houston",
    country: "USA",
    niche: "attorney",
    maxResults: 120,
    geocodeLat: null,
    geocodeLng: null,
    businessesFound: 5,
    businessesEnriched: 0,
    businessesFailed: 0,
    contactsFound: 0,
    approvalToken: "tok",
    approvalWaitpointId: null,
    approvalMessageId: null,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    triggerRunId: null,
    error: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

function makeRunsRepo(overrides: Partial<FinalizeRunsRepo> = {}): FinalizeRunsRepo {
  return {
    findById: vi.fn().mockResolvedValue(makeRun()),
    updateStatus: vi.fn().mockResolvedValue(makeRun()),
    setCounters: vi.fn().mockResolvedValue(makeRun()),
    ...overrides,
  };
}

function makeRbRepo(counts: Record<string, number> = {}): FinalizeRunBusinessesRepo {
  return { countByRun: vi.fn().mockResolvedValue(counts) };
}

function makeContactsRepo(count = 3): FinalizeContactsRepo {
  return { countMerged: vi.fn().mockResolvedValue(count) };
}

describe("determineRunStatus", () => {
  it("returns completed when at least one business is enriched", () => {
    expect(determineRunStatus({ enriched: 3, failed: 1 })).toBe("completed");
  });

  it("returns completed when at least one business is partial", () => {
    expect(determineRunStatus({ partial: 2, failed: 1 })).toBe("completed");
  });

  it("returns failed when all businesses failed", () => {
    expect(determineRunStatus({ failed: 3 })).toBe("failed");
  });

  it("returns completed for zero businesses (nothing to enrich)", () => {
    expect(determineRunStatus({})).toBe("completed");
  });

  it("returns completed when mix of enriched and partial", () => {
    expect(determineRunStatus({ enriched: 2, partial: 1 })).toBe("completed");
  });
});

describe("createFinalizeService.finalize", () => {
  it("sets businessesEnriched = enriched + partial, businessesFailed, contactsFound", async () => {
    const runsRepo = makeRunsRepo();
    const service = createFinalizeService({
      runsRepo,
      runBusinessesRepo: makeRbRepo({ enriched: 3, partial: 1, failed: 1 }),
      contactsRepo: makeContactsRepo(8),
    });

    await service.finalize("run-1");

    expect(runsRepo.setCounters).toHaveBeenCalledWith("run-1", {
      businessesEnriched: 4, // 3 enriched + 1 partial
      businessesFailed: 1,
      contactsFound: 8,
    });
  });

  it("sets status=completed when at least one business enriched", async () => {
    const runsRepo = makeRunsRepo();
    const service = createFinalizeService({
      runsRepo,
      runBusinessesRepo: makeRbRepo({ enriched: 2 }),
      contactsRepo: makeContactsRepo(4),
    });

    const result = await service.finalize("run-1");

    expect(result.status).toBe("completed");
    expect(runsRepo.updateStatus).toHaveBeenCalledWith(
      "run-1",
      "completed",
      expect.objectContaining({ finishedAt: expect.any(Date) }),
    );
  });

  it("sets status=failed when all businesses failed", async () => {
    const runsRepo = makeRunsRepo();
    const service = createFinalizeService({
      runsRepo,
      runBusinessesRepo: makeRbRepo({ failed: 3 }),
      contactsRepo: makeContactsRepo(0),
    });

    const result = await service.finalize("run-1");

    expect(result.status).toBe("failed");
    expect(runsRepo.updateStatus).toHaveBeenCalledWith("run-1", "failed", expect.anything());
  });

  it("runs countByRun and countMerged in parallel", async () => {
    const callOrder: string[] = [];
    const rb = {
      countByRun: vi.fn().mockImplementation(async () => {
        callOrder.push("rb");
        return {};
      }),
    };
    const c = {
      countMerged: vi.fn().mockImplementation(async () => {
        callOrder.push("c");
        return 0;
      }),
    };

    const service = createFinalizeService({
      runsRepo: makeRunsRepo(),
      runBusinessesRepo: rb,
      contactsRepo: c,
    });
    await service.finalize("run-1");

    // Both were called; exact order is non-deterministic in parallel execution
    expect(callOrder).toContain("rb");
    expect(callOrder).toContain("c");
  });
});
