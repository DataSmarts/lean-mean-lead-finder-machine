import { describe, expect, it, vi } from "vitest";

import type { ApprovalService } from "@/lib/services/approval";
import { createApprovalRuntime } from "@/lib/services/approval-runtime";

import { handleDashboardApproval } from "./approval-route";

vi.mock("@/lib/services/approval-runtime", () => ({ createApprovalRuntime: vi.fn() }));

function makeParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

function setupService(outcome: Awaited<ReturnType<ApprovalService["approve"]>>) {
  const approve = vi.fn().mockResolvedValue(outcome);
  const reject = vi.fn().mockResolvedValue(outcome);
  vi.mocked(createApprovalRuntime).mockReturnValue({ approve, reject });
  return { approve, reject };
}

describe("handleDashboardApproval", () => {
  it("approves a run and returns the dashboard approved response", async () => {
    const { approve } = setupService({ status: "applied" });

    const response = await handleDashboardApproval({
      action: "approve",
      params: makeParams("run-1"),
    });

    expect(approve).toHaveBeenCalledWith({ runId: "run-1" }, "admin");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "approved" });
  });

  it("rejects a run and returns the dashboard rejected response", async () => {
    const { reject } = setupService({ status: "applied" });

    const response = await handleDashboardApproval({
      action: "reject",
      params: makeParams("run-2"),
    });

    expect(reject).toHaveBeenCalledWith({ runId: "run-2" }, "admin");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "rejected" });
  });

  it("maps already handled outcomes to the existing dashboard conflict response", async () => {
    setupService({ status: "already_handled" });

    const response = await handleDashboardApproval({
      action: "approve",
      params: makeParams("run-1"),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Already handled" });
  });

  it("maps not found outcomes to the existing dashboard not found response", async () => {
    setupService({ status: "not_found" });

    const response = await handleDashboardApproval({
      action: "reject",
      params: makeParams("run-1"),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
