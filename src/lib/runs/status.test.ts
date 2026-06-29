import { describe, expect, it } from "vitest";

import { BUSINESS_ENRICH_STATUS_VALUES, RUN_STATUS_VALUES } from "@/lib/domain/enums";

import {
  BUSINESS_ENRICH_STATUS_BADGE_TONE,
  isTerminalRunStatus,
  RUN_STATUS_BADGE_TONE,
  TERMINAL_RUN_STATUSES,
} from "./status";

const TERMINAL: (typeof RUN_STATUS_VALUES)[number][] = [
  "rejected",
  "completed",
  "failed",
  "canceled",
];
const NON_TERMINAL: (typeof RUN_STATUS_VALUES)[number][] = [
  "queued",
  "discovering",
  "awaiting_approval",
  "enriching",
];

describe("TERMINAL_RUN_STATUSES", () => {
  it("contains exactly the terminal statuses", () => {
    expect([...TERMINAL_RUN_STATUSES].sort()).toEqual([...TERMINAL].sort());
  });

  it("stays in sync with the runStatus enum (no missing or extra values)", () => {
    const allStatuses = new Set(RUN_STATUS_VALUES);
    const terminalSet = new Set(TERMINAL_RUN_STATUSES);
    for (const s of terminalSet) {
      expect(allStatuses.has(s)).toBe(true);
    }
    // Every enum value is either terminal or non-terminal — no orphans.
    for (const s of allStatuses) {
      expect(terminalSet.has(s) || NON_TERMINAL.includes(s)).toBe(true);
    }
  });
});

describe("isTerminalRunStatus", () => {
  it.each(TERMINAL)("returns true for terminal status '%s'", (s) => {
    expect(isTerminalRunStatus(s)).toBe(true);
  });

  it.each(NON_TERMINAL)("returns false for non-terminal status '%s'", (s) => {
    expect(isTerminalRunStatus(s)).toBe(false);
  });
});

describe("RUN_STATUS_BADGE_TONE", () => {
  it("has an entry for every run status value", () => {
    for (const s of RUN_STATUS_VALUES) {
      expect(RUN_STATUS_BADGE_TONE[s], `missing tone for status '${s}'`).toBeDefined();
    }
  });

  it("maps terminal statuses to danger or success tones", () => {
    expect(RUN_STATUS_BADGE_TONE["completed"]).toBe("success");
    expect(RUN_STATUS_BADGE_TONE["rejected"]).toBe("danger");
    expect(RUN_STATUS_BADGE_TONE["failed"]).toBe("danger");
    expect(RUN_STATUS_BADGE_TONE["canceled"]).toBe("danger");
  });

  it("maps active statuses to active tone", () => {
    expect(RUN_STATUS_BADGE_TONE["awaiting_approval"]).toBe("active");
    expect(RUN_STATUS_BADGE_TONE["enriching"]).toBe("active");
  });

  it("maps queued/discovering to muted tone", () => {
    expect(RUN_STATUS_BADGE_TONE["queued"]).toBe("muted");
    expect(RUN_STATUS_BADGE_TONE["discovering"]).toBe("muted");
  });
});

describe("BUSINESS_ENRICH_STATUS_BADGE_TONE", () => {
  it("has an entry for every business enrichment status value", () => {
    for (const s of BUSINESS_ENRICH_STATUS_VALUES) {
      expect(BUSINESS_ENRICH_STATUS_BADGE_TONE[s], `missing tone for status '${s}'`).toBeDefined();
    }
  });

  it("maps active enrichment statuses to active tone", () => {
    expect(BUSINESS_ENRICH_STATUS_BADGE_TONE["ai_running"]).toBe("active");
    expect(BUSINESS_ENRICH_STATUS_BADGE_TONE["hunter_running"]).toBe("active");
    expect(BUSINESS_ENRICH_STATUS_BADGE_TONE["partial"]).toBe("active");
  });

  it("maps terminal/silent enrichment statuses to their display tones", () => {
    expect(BUSINESS_ENRICH_STATUS_BADGE_TONE["enriched"]).toBe("success");
    expect(BUSINESS_ENRICH_STATUS_BADGE_TONE["failed"]).toBe("danger");
    expect(BUSINESS_ENRICH_STATUS_BADGE_TONE["queued"]).toBe("muted");
    expect(BUSINESS_ENRICH_STATUS_BADGE_TONE["skipped"]).toBe("muted");
  });
});
