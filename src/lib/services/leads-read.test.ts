import { describe, expect, it, vi } from "vitest";

import type { LeadRow, LeadsListResult } from "@/lib/db/leads.repo";

import type { LeadsReadService } from "./leads-read";
import { createLeadsReadService } from "./leads-read";

// --- Helpers ------------------------------------------------------------------

function makeLeadRow(overrides: Partial<LeadRow["contact"]> = {}): LeadRow {
  return {
    contact: {
      id: "c-1",
      runId: "r-1",
      businessId: "b-1",
      source: "hunter" as const,
      kind: "merged" as const,
      fullName: "John Smith",
      firstName: "John",
      lastName: "Smith",
      title: "CEO",
      email: "john@example.com",
      emailConfidence: 90,
      emailVerification: "valid" as const,
      seniority: "senior",
      department: "executive",
      phone: "+1-555-0100",
      linkedinUrl: "https://linkedin.com/in/johnsmith",
      instagramUrl: null,
      twitterUrl: null,
      facebookUrl: null,
      mergedIntoId: null,
      fieldSources: { email: "hunter" as const, linkedin_url: "ai" as const },
      raw: {},
      createdAt: new Date("2025-01-15T10:00:00Z"),
      ...overrides,
    } as LeadRow["contact"],
    business: {
      id: "b-1",
      googlePlaceId: "ChIJ1",
      name: "Acme Corp",
      websiteUri: "https://acme.com",
      websiteDomain: "acme.com",
      formattedAddress: "123 Main St",
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
      triggerSource: "dashboard" as const,
      status: "completed" as const,
      neighborhood: null,
      city: "Houston",
      country: "US",
      niche: "family law attorney",
      maxResults: 120,
      geocodeLat: null,
      geocodeLng: null,
      businessesFound: 10,
      businessesEnriched: 8,
      businessesFailed: 2,
      contactsFound: 15,
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

function makeListResult(overrides?: Partial<LeadsListResult>): LeadsListResult {
  return {
    rows: [makeLeadRow()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

// --- Tests --------------------------------------------------------------------

describe("createLeadsReadService", () => {
  it("maps a LeadRow to the correct LeadRowView shape", async () => {
    const mockRepo = {
      list: vi.fn().mockResolvedValue(makeListResult()),
      runOptions: vi.fn().mockResolvedValue([]),
    };
    const service = createLeadsReadService({ leadsRepo: mockRepo });
    const result = await service.list({ page: 1 });

    expect(result.rows).toHaveLength(1);
    const view = result.rows[0]!;
    expect(view.contactId).toBe("c-1");
    expect(view.runId).toBe("r-1");
    expect(view.businessName).toBe("Acme Corp");
    expect(view.website).toBe("https://acme.com");
    expect(view.address).toBe("123 Main St");
    expect(view.person).toBe("John Smith");
    expect(view.title).toBe("CEO");
    expect(view.email).toBe("john@example.com");
    expect(view.emailConfidence).toBe(90);
    expect(view.emailVerification).toBe("valid");
    expect(view.source).toBe("hunter");
    expect(view.sourceBadges).toContain("hunter");
    expect(view.sourceBadges).toContain("ai");
    expect(view.linkedinUrl).toBe("https://linkedin.com/in/johnsmith");
    expect(view.instagramUrl).toBeNull();
    expect(view.niche).toBe("family law attorney");
    expect(view.city).toBe("Houston");
  });

  it("passes pagination meta through unchanged", async () => {
    const mockRepo = {
      list: vi.fn().mockResolvedValue(makeListResult({ total: 42, page: 3, pageSize: 20 })),
      runOptions: vi.fn().mockResolvedValue([]),
    };
    const service = createLeadsReadService({ leadsRepo: mockRepo });
    const result = await service.list({ page: 3 });
    expect(result.total).toBe(42);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(20);
  });

  it("returns an empty rows array when the repo returns no rows", async () => {
    const mockRepo = {
      list: vi.fn().mockResolvedValue(makeListResult({ rows: [], total: 0 })),
      runOptions: vi.fn().mockResolvedValue([]),
    };
    const service = createLeadsReadService({ leadsRepo: mockRepo });
    const result = await service.list({ page: 1 });
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("passes filters through to the repo", async () => {
    const listMock = vi.fn().mockResolvedValue(makeListResult());
    const mockRepo = { list: listMock, runOptions: vi.fn().mockResolvedValue([]) };
    const service = createLeadsReadService({ leadsRepo: mockRepo });
    await service.list({ page: 2, source: "ai", q: "Smith" });
    expect(listMock).toHaveBeenCalledWith({ page: 2, source: "ai", q: "Smith" });
  });

  it("provides sourceBadges from fieldSources (both ai and hunter)", async () => {
    const row = makeLeadRow({
      fieldSources: { email: "hunter" as const, linkedin_url: "ai" as const },
      source: "hunter",
    });
    const mockRepo = {
      list: vi.fn().mockResolvedValue(makeListResult({ rows: [row] })),
      runOptions: vi.fn().mockResolvedValue([]),
    };
    const service: LeadsReadService = createLeadsReadService({ leadsRepo: mockRepo });
    const result = await service.list({ page: 1 });
    expect(result.rows[0]?.sourceBadges).toEqual(["ai", "hunter"]);
  });

  it("runOptions maps to id+label form", async () => {
    const mockRepo = {
      list: vi.fn().mockResolvedValue(makeListResult()),
      runOptions: vi.fn().mockResolvedValue([
        { id: "r-1", niche: "lawyer", city: "Houston" },
        { id: "r-2", niche: "dentist", city: "Austin" },
      ]),
    };
    const service = createLeadsReadService({ leadsRepo: mockRepo });
    const options = await service.runOptions();
    expect(options).toEqual([
      { id: "r-1", label: "lawyer — Houston" },
      { id: "r-2", label: "dentist — Austin" },
    ]);
  });
});
