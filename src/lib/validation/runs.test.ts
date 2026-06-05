import { describe, expect, it } from "vitest";

import { createRunSchema, runsListQuerySchema, saveAsPresetSchema } from "./runs";

const valid = { city: "Houston", country: "USA", niche: "family law attorney", maxResults: 50 };

describe("createRunSchema", () => {
  it("parses a valid request", () => {
    expect(createRunSchema.parse(valid)).toMatchObject(valid);
  });

  it("defaults maxResults to 120 when omitted", () => {
    const { maxResults } = createRunSchema.parse({
      city: "Houston",
      country: "USA",
      niche: "dentists",
    });
    expect(maxResults).toBe(120);
  });

  it("treats neighborhood as optional", () => {
    expect(createRunSchema.parse(valid).neighborhood).toBeUndefined();
    expect(createRunSchema.parse({ ...valid, neighborhood: "Midtown" }).neighborhood).toBe(
      "Midtown",
    );
  });

  it.each(["city", "country", "niche"])("rejects a missing %s", (field) => {
    const input: Record<string, unknown> = { ...valid };
    delete input[field];
    expect(createRunSchema.safeParse(input).success).toBe(false);
  });

  it("rejects a non-positive maxResults", () => {
    expect(createRunSchema.safeParse({ ...valid, maxResults: 0 }).success).toBe(false);
    expect(createRunSchema.safeParse({ ...valid, maxResults: -5 }).success).toBe(false);
  });

  it("rejects a non-integer maxResults", () => {
    expect(createRunSchema.safeParse({ ...valid, maxResults: 10.5 }).success).toBe(false);
  });
});

describe("runsListQuerySchema", () => {
  it("accepts a valid run status", () => {
    const result = runsListQuerySchema.parse({ status: "completed", page: 1 });
    expect(result.status).toBe("completed");
  });

  it("drops an unrecognised status (catch fallback) without throwing", () => {
    const result = runsListQuerySchema.parse({ status: "bogus", page: 1 });
    expect(result.status).toBeUndefined();
  });

  it("accepts a missing status (all runs)", () => {
    const result = runsListQuerySchema.parse({ page: 1 });
    expect(result.status).toBeUndefined();
  });

  it("coerces string page to a number", () => {
    const result = runsListQuerySchema.parse({ page: "3" });
    expect(result.page).toBe(3);
  });

  it("falls back to page 1 for zero", () => {
    const result = runsListQuerySchema.parse({ page: "0" });
    expect(result.page).toBe(1);
  });

  it("falls back to page 1 for negative page", () => {
    const result = runsListQuerySchema.parse({ page: "-1" });
    expect(result.page).toBe(1);
  });

  it("falls back to page 1 for a non-numeric string", () => {
    const result = runsListQuerySchema.parse({ page: "abc" });
    expect(result.page).toBe(1);
  });

  it("defaults page to 1 when omitted", () => {
    const result = runsListQuerySchema.parse({});
    expect(result.page).toBe(1);
  });
});

describe("saveAsPresetSchema", () => {
  it("passes when saveAsPreset is false (no presetName required)", () => {
    expect(saveAsPresetSchema.safeParse({ saveAsPreset: false }).success).toBe(true);
  });

  it("passes when saveAsPreset is true and presetName is provided", () => {
    expect(
      saveAsPresetSchema.safeParse({ saveAsPreset: true, presetName: "My Preset" }).success,
    ).toBe(true);
  });

  it("fails when saveAsPreset is true but presetName is missing", () => {
    expect(saveAsPresetSchema.safeParse({ saveAsPreset: true }).success).toBe(false);
  });

  it("fails when saveAsPreset is true but presetName is empty", () => {
    expect(saveAsPresetSchema.safeParse({ saveAsPreset: true, presetName: "" }).success).toBe(
      false,
    );
  });

  it("defaults saveAsPreset to false when omitted", () => {
    const result = saveAsPresetSchema.parse({});
    expect(result.saveAsPreset).toBe(false);
  });
});
