import { describe, expect, it } from "vitest";

import type { LeadsListQuery } from "@/lib/validation/leads";

import { buildLeadsExportHref, buildLeadsHref, hasActiveLeadsFilter } from "./leads-query";

const baseQuery: LeadsListQuery = {
  page: 1,
};

describe("buildLeadsHref", () => {
  it("returns the leads route when filters are empty and page is first page", () => {
    expect(buildLeadsHref(baseQuery, 1)).toBe("/leads");
  });

  it("serializes filters and omits first-page pagination", () => {
    const query: LeadsListQuery = {
      page: 3,
      runId: "run-123",
      niche: "dentist",
      city: "Houston",
      source: "hunter",
      verification: "valid",
      q: "owner",
    };

    expect(buildLeadsHref(query, 1)).toBe(
      "/leads?runId=run-123&niche=dentist&city=Houston&source=hunter&verification=valid&q=owner",
    );
  });

  it("adds pagination only after the first page", () => {
    expect(buildLeadsHref({ ...baseQuery, q: "Ada Lovelace" }, 2)).toBe(
      "/leads?q=Ada+Lovelace&page=2",
    );
  });
});

describe("buildLeadsExportHref", () => {
  it("serializes the same filter params without pagination", () => {
    const query: LeadsListQuery = {
      page: 5,
      runId: "run-123",
      niche: "dentist",
      city: "Houston",
      source: "hunter",
      verification: "valid",
      q: "owner",
    };

    expect(buildLeadsExportHref(query)).toBe(
      "/api/leads/export?runId=run-123&niche=dentist&city=Houston&source=hunter&verification=valid&q=owner",
    );
  });
});

describe("hasActiveLeadsFilter", () => {
  it("returns false when only page is set", () => {
    expect(hasActiveLeadsFilter(baseQuery)).toBe(false);
  });

  it("returns true when any lead filter is set", () => {
    expect(hasActiveLeadsFilter({ ...baseQuery, verification: "unknown" })).toBe(true);
  });

  it("ignores empty strings while detecting other filters", () => {
    expect(hasActiveLeadsFilter({ ...baseQuery, q: "", niche: "dentist" })).toBe(true);
  });
});
