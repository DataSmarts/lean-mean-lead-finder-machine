import { describe, expect, it } from "vitest";

import { rollUpStatus } from "@/lib/services/enrich";

import { chunk } from "./enrich.task";

describe("chunk", () => {
  it("splits an array into sub-arrays of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns the full array in one chunk when size >= length", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("returns empty array when input is empty", () => {
    expect(chunk([], 5)).toEqual([]);
  });

  it("handles size of 1", () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });
});

// rollUpStatus is defined in services/enrich and used by the tasks; tested here for task-level
// understanding (the authoritative tests are in enrich.test.ts).
describe("rollUpStatus (task-level sanity)", () => {
  it("enriched when AI succeeded + Hunter skipped (no-website case)", () => {
    expect(rollUpStatus("succeeded", "skipped")).toBe("enriched");
  });

  it("partial when AI fails + Hunter succeeds", () => {
    expect(rollUpStatus("failed", "succeeded")).toBe("partial");
  });

  it("failed when both fail", () => {
    expect(rollUpStatus("failed", "failed")).toBe("failed");
  });
});
