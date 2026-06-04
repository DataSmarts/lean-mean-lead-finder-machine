import { tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { CreateRunInput } from "@/lib/services/run";
import { createRunService } from "@/lib/services/run";

import { POST } from "./route";

vi.mock("@/lib/services/run", () => ({ createRunService: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn() } }));

function request(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

function rejectingRequest(): NextRequest {
  return {
    json: async () => {
      throw new SyntaxError("Unexpected token");
    },
  } as unknown as NextRequest;
}

function setup() {
  const create = vi.fn(async (_input: CreateRunInput) => ({ id: "run-1", status: "queued" }));
  vi.mocked(createRunService).mockReturnValue({ create } as unknown as ReturnType<
    typeof createRunService
  >);
  vi.mocked(tasks.trigger).mockResolvedValue(undefined as never);
  return { create };
}

const validBody = { city: "Houston", country: "USA", niche: "family law attorney", maxResults: 50 };

describe("POST /api/runs", () => {
  it("rejects an invalid body with 400 and does not create or trigger", async () => {
    const { create } = setup();

    const response = await POST(request({ country: "USA", niche: "x" })); // missing city

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
    expect(tasks.trigger).not.toHaveBeenCalled();
  });

  it("rejects an unparseable JSON body with 400", async () => {
    setup();

    const response = await POST(rejectingRequest());

    expect(response.status).toBe(400);
  });

  it("creates a run as triggerSource=api and triggers orchestrate", async () => {
    const { create } = setup();

    const response = await POST(request(validBody));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ runId: "run-1", status: "queued" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ ...validBody, triggerSource: "api" }),
    );
    expect(tasks.trigger).toHaveBeenCalledWith("leadRun.orchestrate", { runId: "run-1" });
  });

  it("applies the default maxResults when omitted", async () => {
    const { create } = setup();

    await POST(request({ city: "Houston", country: "USA", niche: "dentists" }));

    expect(create.mock.calls[0][0].maxResults).toBe(120);
  });
});
