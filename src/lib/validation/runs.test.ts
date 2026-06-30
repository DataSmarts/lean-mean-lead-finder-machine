import { describe, expect, it } from "vitest";

import { DEFAULT_MAX_RESULTS } from "@/lib/config/defaults";
import { RUN_STATUS_VALUES } from "@/lib/domain/enums";

import { createRunSchema, parseCreateRunFormData, runsListQuerySchema } from "./runs";

const valid = { city: "Houston", country: "USA", niche: "family law attorney", maxResults: 50 };

function formWith(fields: Record<string, string | undefined>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) formData.set(key, value);
  }
  return formData;
}

describe("createRunSchema", () => {
  it("parses a valid request", () => {
    expect(createRunSchema.parse(valid)).toMatchObject(valid);
  });

  it("defaults maxResults when omitted", () => {
    const { maxResults } = createRunSchema.parse({
      city: "Houston",
      country: "USA",
      niche: "dentists",
    });
    expect(maxResults).toBe(DEFAULT_MAX_RESULTS);
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

  it("rejects a string maxResults so API JSON semantics stay explicit", () => {
    expect(createRunSchema.safeParse({ ...valid, maxResults: "50" }).success).toBe(false);
  });
});

describe("parseCreateRunFormData", () => {
  it("coerces maxResults from a form string", () => {
    const result = parseCreateRunFormData(formWith({ ...valid, maxResults: "75" }));

    expect(result.success && result.data.maxResults).toBe(75);
  });

  it.each([undefined, ""])("defaults maxResults when the form value is %s", (maxResults) => {
    const result = parseCreateRunFormData(
      formWith({ city: "Houston", country: "USA", niche: "dentists", maxResults }),
    );

    expect(result.success && result.data.maxResults).toBe(DEFAULT_MAX_RESULTS);
  });

  it("treats a blank optional neighborhood as absent", () => {
    const result = parseCreateRunFormData(
      formWith({ ...valid, maxResults: "50", neighborhood: "" }),
    );

    expect(result.success && result.data.neighborhood).toBeUndefined();
  });

  it.each(["0", "-5", "10.5", "abc"])("rejects invalid form maxResults %s", (maxResults) => {
    const result = parseCreateRunFormData(formWith({ ...valid, maxResults }));

    expect(result.success).toBe(false);
  });

  it("parses save-as-preset fields when presetName is present", () => {
    const result = parseCreateRunFormData(
      formWith({ ...valid, maxResults: "50", saveAsPreset: "true", presetName: "My Preset" }),
    );

    expect(result.success && result.data.presetName).toBe("My Preset");
  });

  it.each([undefined, ""])("rejects save-as-preset when presetName is %s", (presetName) => {
    const result = parseCreateRunFormData(
      formWith({ ...valid, maxResults: "50", saveAsPreset: "true", presetName }),
    );

    expect(result.success).toBe(false);
  });
});

describe("runsListQuerySchema", () => {
  it("accepts each valid run status", () => {
    for (const value of RUN_STATUS_VALUES) {
      const result = runsListQuerySchema.parse({ status: value, page: 1 });
      expect(result.status).toBe(value);
    }
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
