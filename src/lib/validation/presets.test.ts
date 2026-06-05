import { describe, expect, it } from "vitest";

import { frequencyToCron, presetFormSchema } from "./presets";

describe("frequencyToCron", () => {
  it("returns hourly cron", () => expect(frequencyToCron("hourly")).toBe("0 * * * *"));
  it("returns daily cron", () => expect(frequencyToCron("daily")).toBe("0 9 * * *"));
  it("returns weekly cron", () => expect(frequencyToCron("weekly")).toBe("0 9 * * 1"));
});

const validBase = {
  name: "Houston lawyers",
  city: "Houston",
  country: "USA",
  niche: "family law attorney",
};

describe("presetFormSchema", () => {
  it("accepts a minimal preset with no schedule", () => {
    const result = presetFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cron).toBeNull();
      expect(result.data.isActive).toBe(false);
      expect(result.data.maxResults).toBe(120);
    }
  });

  it("resolves cron from a friendly frequency", () => {
    const result = presetFormSchema.safeParse({ ...validBase, frequency: "daily", isActive: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cron).toBe("0 9 * * *");
  });

  it("accepts a valid custom cron expression", () => {
    const result = presetFormSchema.safeParse({
      ...validBase,
      frequency: "custom",
      customCron: "30 8 * * 1-5",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cron).toBe("30 8 * * 1-5");
  });

  it("rejects custom frequency with no customCron", () => {
    const result = presetFormSchema.safeParse({ ...validBase, frequency: "custom" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed custom cron", () => {
    const result = presetFormSchema.safeParse({
      ...validBase,
      frequency: "custom",
      customCron: "not a cron",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = presetFormSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("strips frequency and customCron from the output", () => {
    const result = presetFormSchema.safeParse({ ...validBase, frequency: "weekly" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("frequency" in result.data).toBe(false);
      expect("customCron" in result.data).toBe(false);
    }
  });

  it("accepts an optional id for the edit flow", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const result = presetFormSchema.safeParse({ ...validBase, id });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(id);
  });
});
