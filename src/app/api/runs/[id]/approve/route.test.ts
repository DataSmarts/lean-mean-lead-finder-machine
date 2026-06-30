import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { handleDashboardApproval } from "../approval-route";
import { POST } from "./route";

vi.mock("../approval-route", () => ({ handleDashboardApproval: vi.fn() }));

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

const req = {} as NextRequest;

describe("POST /api/runs/[id]/approve", () => {
  it("delegates dashboard approval handling with the approve action", async () => {
    const response = NextResponse.json({ status: "approved" }, { status: 200 });
    vi.mocked(handleDashboardApproval).mockResolvedValue(response);
    const context = makeParams("run-abc");

    const result = await POST(req, context);

    expect(result).toBe(response);
    expect(handleDashboardApproval).toHaveBeenCalledWith({
      action: "approve",
      params: context.params,
    });
  });
});
