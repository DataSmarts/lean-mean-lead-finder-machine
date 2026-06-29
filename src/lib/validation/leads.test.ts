import { describe, expect, it } from "vitest";

import { CONTACT_SOURCE_VALUES, EMAIL_VERIFICATION_VALUES } from "@/lib/domain/enums";

import { leadsListQuerySchema, runExportQuerySchema } from "./leads";

describe("leadsListQuerySchema", () => {
  it("accepts all fields when valid", () => {
    const result = leadsListQuerySchema.parse({
      runId: "abc-123",
      niche: "family law attorney",
      city: "Houston",
      source: "hunter",
      verification: "valid",
      q: "smith",
      page: "3",
    });
    expect(result).toEqual({
      runId: "abc-123",
      niche: "family law attorney",
      city: "Houston",
      source: "hunter",
      verification: "valid",
      q: "smith",
      page: 3,
    });
  });

  it("returns undefined for optional fields when absent", () => {
    const result = leadsListQuerySchema.parse({});
    expect(result.runId).toBeUndefined();
    expect(result.niche).toBeUndefined();
    expect(result.city).toBeUndefined();
    expect(result.source).toBeUndefined();
    expect(result.verification).toBeUndefined();
    expect(result.q).toBeUndefined();
  });

  it("defaults page to 1 when absent", () => {
    expect(leadsListQuerySchema.parse({}).page).toBe(1);
  });

  it("coerces a numeric string page", () => {
    expect(leadsListQuerySchema.parse({ page: "5" }).page).toBe(5);
  });

  it("falls back to page 1 for a non-numeric page (no 500)", () => {
    expect(leadsListQuerySchema.parse({ page: "bogus" }).page).toBe(1);
  });

  it("falls back to page 1 for a page below 1", () => {
    expect(leadsListQuerySchema.parse({ page: "0" }).page).toBe(1);
  });

  it("returns undefined for an invalid source value instead of throwing", () => {
    expect(leadsListQuerySchema.parse({ source: "unknown_source" }).source).toBeUndefined();
  });

  it("accepts each valid source value", () => {
    for (const value of CONTACT_SOURCE_VALUES) {
      expect(leadsListQuerySchema.parse({ source: value }).source).toBe(value);
    }
  });

  it("returns undefined for an invalid verification value instead of throwing", () => {
    expect(
      leadsListQuerySchema.parse({ verification: "bogus_verification" }).verification,
    ).toBeUndefined();
  });

  it("accepts each valid verification value", () => {
    for (const v of EMAIL_VERIFICATION_VALUES) {
      expect(leadsListQuerySchema.parse({ verification: v }).verification).toBe(v);
    }
  });
});

describe("runExportQuerySchema", () => {
  it("parses ?raw=1 as true", () => {
    expect(runExportQuerySchema.parse({ raw: "1" }).raw).toBe(true);
  });

  it("parses ?raw=true as true", () => {
    expect(runExportQuerySchema.parse({ raw: "true" }).raw).toBe(true);
  });

  it("parses ?raw=0 as false", () => {
    expect(runExportQuerySchema.parse({ raw: "0" }).raw).toBe(false);
  });

  it("defaults to false when raw is absent", () => {
    expect(runExportQuerySchema.parse({}).raw).toBe(false);
  });

  it("falls back to false for a garbage raw value (no 500)", () => {
    expect(runExportQuerySchema.parse({ raw: "garbage" }).raw).toBe(false);
  });
});
