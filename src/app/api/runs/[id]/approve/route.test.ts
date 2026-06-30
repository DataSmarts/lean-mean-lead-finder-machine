import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { ApprovalService } from "@/lib/services/approval";
import { createApprovalService } from "@/lib/services/approval";

import { POST } from "./route";

vi.mock("@/lib/services/approval", () => ({ createApprovalService: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({
  wait: { completeToken: vi.fn().mockResolvedValue({ success: true }) },
}));
vi.mock("@/lib/db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/db/runs.repo", () => ({ makeRunsRepo: vi.fn() }));

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function setupService(outcome: Awaited<ReturnType<ApprovalService["approve"]>>) {
  const approve = vi.fn().mockResolvedValue(outcome);
  const reject = vi.fn().mockResolvedValue(outcome);
  vi.mocked(createApprovalService).mockReturnValue({ approve, reject });
  return { approve };
}

const req = {} as NextRequest;

describe("POST /api/runs/[id]/approve", () => {
  it("awaits params to extract the run id", async () => {
    const { approve } = setupService({ status: "applied" });

    await POST(req, makeParams("run-abc"));

    expect(approve).toHaveBeenCalledWith({ runId: "run-abc" }, "admin");
  });

  it("returns 200 with status approved when applied", async () => {
    setupService({ status: "applied" });

    const res = await POST(req, makeParams("run-1"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "approved" });
  });

  it("returns 409 when already handled", async () => {
    setupService({ status: "already_handled" });

    const res = await POST(req, makeParams("run-1"));

    expect(res.status).toBe(409);
  });

  it("returns 404 when not found", async () => {
    setupService({ status: "not_found" });

    const res = await POST(req, makeParams("run-1"));

    expect(res.status).toBe(404);
  });
});
