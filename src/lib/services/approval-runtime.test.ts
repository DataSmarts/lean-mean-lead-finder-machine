import { wait } from "@trigger.dev/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db/client";
import { makeRunsRepo } from "@/lib/db/runs.repo";

import { createApprovalService } from "./approval";
import { createApprovalRuntime } from "./approval-runtime";

vi.mock("@trigger.dev/sdk", () => ({
  wait: { completeToken: vi.fn().mockResolvedValue({ success: true }) },
}));
vi.mock("@/lib/db/client", () => ({ getDb: vi.fn(() => "db") }));
vi.mock("@/lib/db/runs.repo", () => ({ makeRunsRepo: vi.fn(() => "runsRepo") }));
vi.mock("./approval", () => ({
  createApprovalService: vi.fn(() => ({ approve: vi.fn(), reject: vi.fn() })),
}));

describe("createApprovalRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs the approval service with the runs repo", () => {
    const service = createApprovalRuntime();

    expect(service).toEqual({ approve: expect.any(Function), reject: expect.any(Function) });
    expect(getDb).toHaveBeenCalledOnce();
    expect(makeRunsRepo).toHaveBeenCalledWith("db");
    expect(createApprovalService).toHaveBeenCalledWith(
      expect.objectContaining({ runsRepo: "runsRepo" }),
    );
  });

  it("completes Trigger waitpoints through the injected boundary", async () => {
    createApprovalRuntime();
    const deps = vi.mocked(createApprovalService).mock.calls[0]?.[0];
    if (!deps) throw new Error("createApprovalService was not called");

    await deps.completeWaitpoint("waitpoint-1", { decision: "approved", by: "admin" });

    expect(wait.completeToken).toHaveBeenCalledWith("waitpoint-1", {
      decision: "approved",
      by: "admin",
    });
  });
});
