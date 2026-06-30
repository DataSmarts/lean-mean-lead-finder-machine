import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { RunDetailView } from "@/lib/services/run-read";
import { makeRunReadService } from "@/lib/services/run-read";

import { GET } from "./route";

vi.mock("@/lib/services/run-read", () => ({ makeRunReadService: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: vi.fn(() => ({})) }));

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function stubService(result: RunDetailView | null) {
  const getDetail = vi.fn().mockResolvedValue(result);
  vi.mocked(makeRunReadService).mockReturnValue({ getDetail });
  return { getDetail };
}

const minimalView: RunDetailView = {
  run: {
    id: "run-1",
    triggerSource: "dashboard",
    status: "enriching",
    neighborhood: null,
    city: "Houston",
    country: "United States",
    niche: "lawyers",
    maxResults: 120,
    businessesFound: 0,
    businessesEnriched: 0,
    businessesFailed: 0,
    contactsFound: 0,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    error: null,
    createdAt: "2024-01-15T12:00:00.000Z",
    updatedAt: "2024-01-15T12:00:00.000Z",
    startedAt: null,
    finishedAt: null,
  },
  businesses: [],
};

const req = {} as NextRequest;

describe("GET /api/runs/[id]", () => {
  it("returns 200 with the run detail view when found", async () => {
    stubService(minimalView);

    const res = await GET(req, makeParams("run-1"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(minimalView);
  });

  it("returns 404 when the run is not found", async () => {
    stubService(null);

    const res = await GET(req, makeParams("run-missing"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("awaits params to extract the run id and passes it to the service", async () => {
    const { getDetail } = stubService(minimalView);

    await GET(req, makeParams("run-abc"));

    expect(getDetail).toHaveBeenCalledWith("run-abc");
  });
});
