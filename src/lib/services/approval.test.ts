import { describe, expect, it, vi } from "vitest";

import type { Run } from "@/lib/db/runs.repo";

import { type ApprovalRunsRepo, buildApprovalPrompt, createApprovalService } from "./approval";

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    presetId: null,
    triggerSource: "api",
    status: "awaiting_approval",
    neighborhood: null,
    city: "Houston",
    country: "USA",
    niche: "family law attorney",
    maxResults: 120,
    geocodeLat: null,
    geocodeLng: null,
    businessesFound: 5,
    businessesEnriched: 0,
    businessesFailed: 0,
    contactsFound: 0,
    approvalToken: "test-approval-token",
    approvalWaitpointId: "waitpoint_123",
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

function makeRepo(overrides: Partial<ApprovalRunsRepo> = {}): ApprovalRunsRepo {
  return {
    findById: vi.fn().mockResolvedValue(makeRun()),
    findByApprovalToken: vi.fn().mockResolvedValue(makeRun()),
    recordApproval: vi.fn().mockResolvedValue(makeRun()),
    recordRejection: vi.fn().mockResolvedValue(makeRun()),
    clearApprovalDecision: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("buildApprovalPrompt", () => {
  const run = makeRun();

  it("includes the niche and location in the text", () => {
    const { text } = buildApprovalPrompt({ run, appBaseUrl: "http://localhost:3000" });
    expect(text).toContain(run.niche);
    expect(text).toContain(run.city);
    expect(text).toContain(run.country);
  });

  it("includes a dashboard link in the text", () => {
    const { text } = buildApprovalPrompt({ run, appBaseUrl: "http://localhost:3000" });
    expect(text).toContain(`http://localhost:3000/runs/${run.id}`);
  });

  it("returns an inline keyboard with approve and reject buttons", () => {
    const { replyMarkup } = buildApprovalPrompt({ run, appBaseUrl: "http://localhost:3000" });
    const buttons = replyMarkup.inline_keyboard[0] ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.callback_data).toBe(`approve:${run.approvalToken}`);
    expect(buttons[1]?.callback_data).toBe(`reject:${run.approvalToken}`);
  });

  it("keeps callback_data within the 64-byte Telegram limit", () => {
    const { replyMarkup } = buildApprovalPrompt({ run, appBaseUrl: "http://localhost:3000" });
    const buttons = replyMarkup.inline_keyboard[0] ?? [];
    for (const btn of buttons) {
      expect(new TextEncoder().encode(btn.callback_data).byteLength).toBeLessThanOrEqual(64);
    }
  });
});

describe("createApprovalService.approve", () => {
  it("returns applied when the run is found and the claim succeeds", async () => {
    const repo = makeRepo();
    const completeWaitpoint = vi.fn().mockResolvedValue(undefined);
    const service = createApprovalService({ runsRepo: repo, completeWaitpoint });

    const outcome = await service.approve({ runId: "run-1" }, "admin");

    expect(outcome.status).toBe("applied");
    expect(completeWaitpoint).toHaveBeenCalledWith("waitpoint_123", {
      decision: "approved",
      by: "admin",
    });
  });

  it("looks up by approvalToken when the locator is an approvalToken", async () => {
    const repo = makeRepo();
    const service = createApprovalService({
      runsRepo: repo,
      completeWaitpoint: vi.fn().mockResolvedValue(undefined),
    });

    await service.approve({ approvalToken: "test-approval-token" }, "telegram:alice");

    expect(repo.findByApprovalToken).toHaveBeenCalledWith("test-approval-token");
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it("returns not_found when the run does not exist", async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(undefined) });
    const service = createApprovalService({ runsRepo: repo, completeWaitpoint: vi.fn() });

    expect((await service.approve({ runId: "ghost" }, "admin")).status).toBe("not_found");
  });

  it("returns not_found when the run has no approvalWaitpointId", async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeRun({ approvalWaitpointId: null })),
    });
    const service = createApprovalService({ runsRepo: repo, completeWaitpoint: vi.fn() });

    expect((await service.approve({ runId: "run-1" }, "admin")).status).toBe("not_found");
  });

  it("returns already_handled when recordApproval returns undefined", async () => {
    const repo = makeRepo({ recordApproval: vi.fn().mockResolvedValue(undefined) });
    const completeWaitpoint = vi.fn();
    const service = createApprovalService({ runsRepo: repo, completeWaitpoint });

    expect((await service.approve({ runId: "run-1" }, "admin")).status).toBe("already_handled");
    expect(completeWaitpoint).not.toHaveBeenCalled();
  });

  it("rolls back the claim and rethrows when completeWaitpoint throws", async () => {
    const repo = makeRepo();
    const completeWaitpoint = vi.fn().mockRejectedValue(new Error("network error"));
    const service = createApprovalService({ runsRepo: repo, completeWaitpoint });

    await expect(service.approve({ runId: "run-1" }, "admin")).rejects.toThrow("network error");
    expect(repo.clearApprovalDecision).toHaveBeenCalledWith("run-1");
  });
});

describe("createApprovalService.reject", () => {
  it("returns applied when the run is found and the rejection claim succeeds", async () => {
    const repo = makeRepo();
    const completeWaitpoint = vi.fn().mockResolvedValue(undefined);
    const service = createApprovalService({ runsRepo: repo, completeWaitpoint });

    const outcome = await service.reject({ runId: "run-1" }, "admin");

    expect(outcome.status).toBe("applied");
    expect(completeWaitpoint).toHaveBeenCalledWith("waitpoint_123", {
      decision: "rejected",
      by: "admin",
    });
  });

  it("returns already_handled when recordRejection returns undefined", async () => {
    const repo = makeRepo({ recordRejection: vi.fn().mockResolvedValue(undefined) });
    const service = createApprovalService({ runsRepo: repo, completeWaitpoint: vi.fn() });

    expect((await service.reject({ runId: "run-1" }, "admin")).status).toBe("already_handled");
  });

  it("rolls back the claim and rethrows when completeWaitpoint throws", async () => {
    const repo = makeRepo();
    const completeWaitpoint = vi.fn().mockRejectedValue(new Error("timeout"));
    const service = createApprovalService({ runsRepo: repo, completeWaitpoint });

    await expect(service.reject({ runId: "run-1" }, "admin")).rejects.toThrow("timeout");
    expect(repo.clearApprovalDecision).toHaveBeenCalledWith("run-1");
  });
});
