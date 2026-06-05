import { describe, expect, it } from "vitest";

import { deriveSourceBadges } from "./source-badge";

describe("deriveSourceBadges", () => {
  it("returns both sources when fieldSources contains both", () => {
    const fieldSources = {
      email: "hunter" as const,
      linkedin_url: "ai" as const,
      title: "hunter" as const,
    };
    const badges = deriveSourceBadges(fieldSources, "hunter");
    expect(badges).toContain("hunter");
    expect(badges).toContain("ai");
    expect(badges).toHaveLength(2);
  });

  it("returns a single source when only one source appears in fieldSources", () => {
    const fieldSources = { email: "hunter" as const, title: "hunter" as const };
    expect(deriveSourceBadges(fieldSources, "hunter")).toEqual(["hunter"]);
  });

  it("falls back to the winning source column when fieldSources is null", () => {
    expect(deriveSourceBadges(null, "ai")).toEqual(["ai"]);
  });

  it("falls back to the winning source column when fieldSources is an empty object", () => {
    expect(deriveSourceBadges({}, "hunter")).toEqual(["hunter"]);
  });

  it("returns a stable sorted order (ai before hunter)", () => {
    const fieldSources = { email: "hunter" as const, linkedin_url: "ai" as const };
    const badges = deriveSourceBadges(fieldSources, "hunter");
    expect(badges).toEqual(["ai", "hunter"]);
  });
});
