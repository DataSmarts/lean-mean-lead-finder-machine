import { describe, expect, it, vi } from "vitest";

import type { LeadRow } from "@/lib/db/leads.repo";
import type { LeadsExportService } from "@/lib/services/leads-export";

vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/services/leads-export", () => ({ makeLeadsExportService: vi.fn() }));
vi.mock("@/lib/db/runs.repo", () => ({ makeRunsRepo: vi.fn() }));

import { makeRunsRepo } from "@/lib/db/runs.repo";
import { makeLeadsExportService } from "@/lib/services/leads-export";

import { GET } from "./route";

function makeRow(): LeadRow {
  return {
    contact: {
      id: "c-1",
      runId: "r-1",
      businessId: "b-1",
      source: "hunter",
      kind: "merged",
      fullName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
      title: "CFO",
      email: "jane@example.com",
      emailConfidence: 80,
      emailVerification: "valid",
      seniority: null,
      department: null,
      phone: null,
      linkedinUrl: null,
      instagramUrl: null,
      twitterUrl: null,
      facebookUrl: null,
      mergedIntoId: null,
      fieldSources: null,
      raw: {},
      createdAt: new Date("2025-01-15T10:00:00Z"),
    } as LeadRow["contact"],
    business: {
      id: "b-1",
      googlePlaceId: "ChIJ1",
      name: "Beta LLC",
      websiteUri: null,
      websiteDomain: null,
      formattedAddress: null,
      nationalPhone: null,
      internationalPhone: null,
      rating: null,
      userRatingCount: null,
      priceLevel: null,
      types: [],
      firstSeenRunId: null,
      lastSeenRunId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LeadRow["business"],
    run: {
      id: "r-1",
      presetId: null,
      triggerSource: "dashboard",
      status: "completed",
      neighborhood: null,
      city: "Austin",
      country: "US",
      niche: "dentist",
      maxResults: 50,
      geocodeLat: null,
      geocodeLng: null,
      businessesFound: 1,
      businessesEnriched: 1,
      businessesFailed: 0,
      contactsFound: 1,
      approvalToken: "tok",
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      triggerRunId: null,
      approvalWaitpointId: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: null,
      finishedAt: null,
    } as LeadRow["run"],
  };
}

function makeParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

function makeRequest(search = ""): Request {
  return new Request(`http://localhost/api/runs/r-1/export${search}`);
}

describe("GET /api/runs/:id/export", () => {
  it("returns 404 when the run does not exist", async () => {
    vi.mocked(makeRunsRepo).mockReturnValue({
      findById: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof makeRunsRepo>);

    const res = await GET(makeRequest(), { params: makeParams("no-such-run") });
    expect(res.status).toBe(404);
  });

  it("returns 200 text/csv for merged export (default)", async () => {
    vi.mocked(makeRunsRepo).mockReturnValue({
      findById: vi.fn().mockResolvedValue({ id: "r-1" }),
    } as unknown as ReturnType<typeof makeRunsRepo>);
    const exportMerged = vi.fn().mockResolvedValue([makeRow()]);
    const exportRaw = vi.fn().mockResolvedValue([]);
    vi.mocked(makeLeadsExportService).mockReturnValue({
      exportMerged,
      exportRaw,
    } as unknown as LeadsExportService);

    const res = await GET(makeRequest(), { params: makeParams("r-1") });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(exportMerged).toHaveBeenCalledWith({ runId: "r-1" });
    expect(exportRaw).not.toHaveBeenCalled();
  });

  it("calls exportRaw and uses raw columns when ?raw=1", async () => {
    vi.mocked(makeRunsRepo).mockReturnValue({
      findById: vi.fn().mockResolvedValue({ id: "r-1" }),
    } as unknown as ReturnType<typeof makeRunsRepo>);
    const exportMerged = vi.fn().mockResolvedValue([]);
    const exportRaw = vi.fn().mockResolvedValue([makeRow()]);
    vi.mocked(makeLeadsExportService).mockReturnValue({
      exportMerged,
      exportRaw,
    } as unknown as LeadsExportService);

    const res = await GET(makeRequest("?raw=1"), { params: makeParams("r-1") });

    expect(res.status).toBe(200);
    const text = await res.text();
    // Raw columns contain "Source" not "Field Sources"
    expect(text).toContain("Source");
    expect(text).not.toContain("Field Sources");
    expect(exportRaw).toHaveBeenCalledWith("r-1");
  });

  it("sets Content-Disposition as attachment", async () => {
    vi.mocked(makeRunsRepo).mockReturnValue({
      findById: vi.fn().mockResolvedValue({ id: "r-1" }),
    } as unknown as ReturnType<typeof makeRunsRepo>);
    vi.mocked(makeLeadsExportService).mockReturnValue({
      exportMerged: vi.fn().mockResolvedValue([makeRow()]),
      exportRaw: vi.fn().mockResolvedValue([]),
    } as unknown as LeadsExportService);

    const res = await GET(makeRequest(), { params: makeParams("r-1") });
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment/);
  });
});
