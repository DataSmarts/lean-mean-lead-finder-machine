import { describe, expect, it, vi } from "vitest";

import type { LeadRow } from "@/lib/db/leads.repo";

vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/db/leads.repo", () => ({
  makeLeadsRepo: vi.fn(),
}));

import { makeLeadsRepo } from "@/lib/db/leads.repo";

import { GET } from "./route";

function makeRow(): LeadRow {
  return {
    contact: {
      id: "c-1",
      runId: "r-1",
      businessId: "b-1",
      source: "hunter",
      kind: "merged",
      fullName: "John Smith",
      firstName: "John",
      lastName: "Smith",
      title: "CEO",
      email: "john@example.com",
      emailConfidence: 90,
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
      name: "Acme Corp",
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
      city: "Houston",
      country: "US",
      niche: "lawyer",
      maxResults: 120,
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
      approvalMessageId: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: null,
      finishedAt: null,
    } as LeadRow["run"],
  };
}

function makeRequest(search = ""): Request {
  return new Request(`http://localhost/api/leads/export${search}`);
}

function mockLeadsRepo(exportMerged: ReturnType<typeof vi.fn>): void {
  vi.mocked(makeLeadsRepo).mockReturnValue({
    exportMerged,
  } as unknown as ReturnType<typeof makeLeadsRepo>);
}

describe("GET /api/leads/export", () => {
  it("returns 200 with Content-Type text/csv", async () => {
    const exportMerged = vi.fn().mockResolvedValue([makeRow()]);
    mockLeadsRepo(exportMerged);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });

  it("sets Content-Disposition as attachment", async () => {
    const exportMerged = vi.fn().mockResolvedValue([makeRow()]);
    mockLeadsRepo(exportMerged);

    const res = await GET(makeRequest());

    expect(res.headers.get("Content-Disposition")).toMatch(/attachment/);
  });

  it("returns CSV with header and data rows in the body", async () => {
    const exportMerged = vi.fn().mockResolvedValue([makeRow()]);
    mockLeadsRepo(exportMerged);

    const res = await GET(makeRequest());
    const text = await res.text();

    expect(text).toContain("Business");
    expect(text).toContain("Acme Corp");
  });

  it("passes filter querystring to the export service", async () => {
    const exportMerged = vi.fn().mockResolvedValue([]);
    mockLeadsRepo(exportMerged);

    await GET(makeRequest("?source=hunter&verification=valid"));

    expect(exportMerged).toHaveBeenCalledWith(
      expect.objectContaining({ source: "hunter", verification: "valid" }),
    );
  });
});
