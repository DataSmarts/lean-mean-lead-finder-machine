import { describe, expect, it } from "vitest";

import { createRunSchema } from "./runs";

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
