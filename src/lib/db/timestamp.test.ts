import { describe, expect, it } from "vitest";

import { systemClock, withUpdatedAt } from "./timestamp";

describe("withUpdatedAt", () => {
  it("adds updatedAt from an injected clock", () => {
    const fakeNow = new Date("2026-01-01T00:00:00.000Z");
    const result = withUpdatedAt({ name: "test" }, { now: () => fakeNow });
    expect(result.updatedAt).toBe(fakeNow);
  });

  it("does not mutate the original object", () => {
    const original = { name: "test" };
    withUpdatedAt(original, { now: () => new Date() });
    expect(Object.keys(original)).toEqual(["name"]);
  });

  it("preserves all original properties", () => {
    const fakeNow = new Date();
    const result = withUpdatedAt({ id: "abc", count: 3 }, { now: () => fakeNow });
    expect(result.id).toBe("abc");
    expect(result.count).toBe(3);
    expect(result.updatedAt).toBe(fakeNow);
  });

  it("overwrites an existing updatedAt field", () => {
    const old = new Date("2020-01-01T00:00:00.000Z");
    const fresh = new Date("2026-01-01T00:00:00.000Z");
    const result = withUpdatedAt({ updatedAt: old }, { now: () => fresh });
    expect(result.updatedAt).toBe(fresh);
  });

  it("uses systemClock by default", () => {
    const before = new Date();
    const result = withUpdatedAt({ x: 1 });
    const after = new Date();
    expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("systemClock", () => {
  it("returns a Date", () => {
    expect(systemClock.now()).toBeInstanceOf(Date);
  });
});
