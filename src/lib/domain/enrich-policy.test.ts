import { describe, expect, it } from "vitest";

import {
  calculateFinalCounters,
  calculateTerminalCounterDeltas,
  isTerminalBusinessEnrichStatus,
  rollUpStatus,
  TERMINAL_BUSINESS_ENRICH_STATUSES,
} from "./enrich-policy";

describe("TERMINAL_BUSINESS_ENRICH_STATUSES", () => {
  it("defines terminal business enrichment statuses in one place", () => {
    expect(TERMINAL_BUSINESS_ENRICH_STATUSES).toEqual(["enriched", "partial", "failed"]);
  });
});

describe("isTerminalBusinessEnrichStatus", () => {
  it.each(["enriched", "partial", "failed"] as const)("returns true for %s", (status) => {
    expect(isTerminalBusinessEnrichStatus(status)).toBe(true);
  });

  it.each(["queued", "ai_running", "hunter_running", "skipped"] as const)(
    "returns false for %s",
    (status) => {
      expect(isTerminalBusinessEnrichStatus(status)).toBe(false);
    },
  );
});

describe("rollUpStatus", () => {
  it("returns enriched when at least one source succeeds and none fail", () => {
    expect(rollUpStatus("succeeded", "succeeded")).toBe("enriched");
    expect(rollUpStatus("succeeded", "skipped")).toBe("enriched");
  });

  it("returns failed when no source succeeds and at least one source fails", () => {
    expect(rollUpStatus("failed", "failed")).toBe("failed");
    expect(rollUpStatus("failed", "skipped")).toBe("failed");
  });

  it("returns partial when successes and failures are mixed", () => {
    expect(rollUpStatus("failed", "succeeded")).toBe("partial");
    expect(rollUpStatus("succeeded", "failed")).toBe("partial");
  });

  it("returns skipped when neither source succeeds or fails", () => {
    expect(rollUpStatus("skipped", "skipped")).toBe("skipped");
  });
});

describe("calculateTerminalCounterDeltas", () => {
  it("increments enriched business and contacts for first enriched transition", () => {
    expect(
      calculateTerminalCounterDeltas({
        previousStatus: "queued",
        nextStatus: "enriched",
        mergedContactCount: 2,
      }),
    ).toEqual({ businessesEnriched: 1, businessesFailed: 0, contactsFound: 2 });
  });

  it("counts partial as enriched for first terminal transition", () => {
    expect(
      calculateTerminalCounterDeltas({
        previousStatus: "ai_running",
        nextStatus: "partial",
        mergedContactCount: 1,
      }),
    ).toEqual({ businessesEnriched: 1, businessesFailed: 0, contactsFound: 1 });
  });

  it("increments failed business for first failed transition", () => {
    expect(
      calculateTerminalCounterDeltas({
        previousStatus: "queued",
        nextStatus: "failed",
        mergedContactCount: 0,
      }),
    ).toEqual({ businessesEnriched: 0, businessesFailed: 1, contactsFound: 0 });
  });

  it.each(["enriched", "partial", "failed"] as const)(
    "does not increment counters when previous status is already terminal: %s",
    (previousStatus) => {
      expect(
        calculateTerminalCounterDeltas({
          previousStatus,
          nextStatus: "enriched",
          mergedContactCount: 3,
        }),
      ).toEqual({ businessesEnriched: 0, businessesFailed: 0, contactsFound: 0 });
    },
  );

  it("does not increment counters for non-terminal next status", () => {
    expect(
      calculateTerminalCounterDeltas({
        previousStatus: "queued",
        nextStatus: "skipped",
        mergedContactCount: 3,
      }),
    ).toEqual({ businessesEnriched: 0, businessesFailed: 0, contactsFound: 0 });
  });
});

describe("calculateFinalCounters", () => {
  it("reconciles final counters from grouped business statuses and merged contact count", () => {
    expect(
      calculateFinalCounters({
        counts: { enriched: 3, partial: 2, failed: 1 },
        contactsFound: 8,
      }),
    ).toEqual({ businessesEnriched: 5, businessesFailed: 1, contactsFound: 8 });
  });

  it("defaults missing grouped statuses to zero", () => {
    expect(calculateFinalCounters({ counts: {}, contactsFound: 0 })).toEqual({
      businessesEnriched: 0,
      businessesFailed: 0,
      contactsFound: 0,
    });
  });
});
