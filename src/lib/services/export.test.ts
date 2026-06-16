import { describe, expect, it } from "vitest";

import type { LeadRow } from "@/lib/db/leads.repo";

import { MERGED_COLUMNS, mergedToCsv, RAW_COLUMNS, rawToCsv } from "./export";

// Minimal LeadRow factory — only the fields the export service touches.
function makeLeadRow(overrides: {
  contactOverrides?: Partial<LeadRow["contact"]>;
  businessOverrides?: Partial<LeadRow["business"]>;
  runOverrides?: Partial<LeadRow["run"]>;
}): LeadRow {
  const { contactOverrides = {}, businessOverrides = {}, runOverrides = {} } = overrides;

  const contact = {
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
    ...contactOverrides,
  } as LeadRow["contact"];

  const business = {
    id: "b-1",
    googlePlaceId: "ChIJ1",
    name: "Acme Corp",
    websiteUri: "https://acme.com",
    websiteDomain: "acme.com",
    formattedAddress: "123 Main St, Houston, TX",
    nationalPhone: null,
    internationalPhone: "+1-555-0100",
    rating: 4.5,
    userRatingCount: 120,
    priceLevel: null,
    types: ["lawyer"],
    firstSeenRunId: "r-1",
    lastSeenRunId: "r-1",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...businessOverrides,
  } as LeadRow["business"];

  const run = {
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
    approvalToken: "tok_abc",
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    triggerRunId: null,
    approvalWaitpointId: null,
    approvalMessageId: null,
    error: null,
    createdAt: new Date("2025-01-10T00:00:00Z"),
    updatedAt: new Date("2025-01-10T00:00:00Z"),
    startedAt: null,
    finishedAt: null,
    ...runOverrides,
  } as LeadRow["run"];

  return { contact, business, run };
}

describe("MERGED_COLUMNS", () => {
  it("has the correct ordered headers", () => {
    const headers = MERGED_COLUMNS.map((c) => c.header);
    expect(headers).toEqual([
      "Business",
      "Website",
      "Address",
      "Niche",
      "City",
      "Person",
      "Title",
      "Email",
      "Email Confidence",
      "Email Verification",
      "Source",
      "Field Sources",
      "Seniority",
      "Department",
      "Phone",
      "LinkedIn",
      "Instagram",
      "Twitter",
      "Facebook",
      "Run ID",
      "Created At",
    ]);
  });

  it("maps business name to the Business column", () => {
    const row = makeLeadRow({});
    const col = MERGED_COLUMNS.find((c) => c.header === "Business")!;
    expect(col.cell(row)).toBe("Acme Corp");
  });

  it("maps null socials to null (not the string 'null')", () => {
    const row = makeLeadRow({ contactOverrides: { instagramUrl: null } });
    const col = MERGED_COLUMNS.find((c) => c.header === "Instagram")!;
    expect(col.cell(row)).toBeNull();
  });

  it("serializes emailConfidence as a string", () => {
    const row = makeLeadRow({ contactOverrides: { emailConfidence: 90 } });
    const col = MERGED_COLUMNS.find((c) => c.header === "Email Confidence")!;
    expect(col.cell(row)).toBe("90");
  });

  it("maps null emailConfidence to null", () => {
    const row = makeLeadRow({ contactOverrides: { emailConfidence: null } });
    const col = MERGED_COLUMNS.find((c) => c.header === "Email Confidence")!;
    expect(col.cell(row)).toBeNull();
  });

  it("serializes fieldSources with deterministically sorted keys (key:src separated by ;)", () => {
    const row = makeLeadRow({
      contactOverrides: {
        fieldSources: {
          title: "hunter" as const,
          email: "hunter" as const,
          linkedin_url: "ai" as const,
        },
      },
    });
    const col = MERGED_COLUMNS.find((c) => c.header === "Field Sources")!;
    // Keys must be sorted alphabetically
    expect(col.cell(row)).toBe("email:hunter;linkedin_url:ai;title:hunter");
  });

  it("maps null fieldSources to null", () => {
    const row = makeLeadRow({ contactOverrides: { fieldSources: null } });
    const col = MERGED_COLUMNS.find((c) => c.header === "Field Sources")!;
    expect(col.cell(row)).toBeNull();
  });

  it("maps createdAt to ISO string", () => {
    const row = makeLeadRow({});
    const col = MERGED_COLUMNS.find((c) => c.header === "Created At")!;
    expect(col.cell(row)).toBe("2025-01-15T10:00:00.000Z");
  });
});

describe("RAW_COLUMNS", () => {
  it("has the correct ordered headers", () => {
    const headers = RAW_COLUMNS.map((c) => c.header);
    expect(headers).toEqual([
      "Business",
      "Source",
      "Person",
      "Title",
      "Email",
      "Email Confidence",
      "Email Verification",
      "Seniority",
      "Department",
      "Phone",
      "LinkedIn",
      "Instagram",
      "Twitter",
      "Facebook",
      "Created At",
    ]);
  });

  it("does not include Field Sources or Run ID columns", () => {
    const headers = RAW_COLUMNS.map((c) => c.header);
    expect(headers).not.toContain("Field Sources");
    expect(headers).not.toContain("Run ID");
  });
});

describe("mergedToCsv", () => {
  it("produces a valid CSV with header and one data row", () => {
    const row = makeLeadRow({});
    const csv = mergedToCsv([row]);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(2); // header + 1 data row
    expect(lines[0]).toContain("Business");
    expect(lines[1]).toContain("Acme Corp");
  });

  it("produces header-only CSV for an empty rows array", () => {
    const csv = mergedToCsv([]);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Business");
  });

  it("correctly escapes a business name containing a comma", () => {
    const row = makeLeadRow({ businessOverrides: { name: "Smith, Jones & Associates" } });
    const csv = mergedToCsv([row]);
    expect(csv).toContain('"Smith, Jones & Associates"');
  });

  it("applies formula guard to an email starting with =", () => {
    const row = makeLeadRow({ contactOverrides: { email: "=DROP TABLE users" } });
    const csv = mergedToCsv([row]);
    expect(csv).toContain("'=DROP TABLE users");
  });
});

describe("rawToCsv", () => {
  it("produces a valid CSV with header and one data row", () => {
    const row = makeLeadRow({});
    const csv = rawToCsv([row]);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Source");
  });

  it("produces header-only CSV for an empty rows array", () => {
    const csv = rawToCsv([]);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1);
  });
});
