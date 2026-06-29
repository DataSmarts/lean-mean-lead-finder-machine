import { describe, expect, it } from "vitest";

import {
  BUSINESS_ENRICH_STATUS_VALUES,
  CONTACT_KIND_VALUES,
  CONTACT_SOURCE_VALUES,
  EMAIL_VERIFICATION_VALUES,
  RUN_STATUS_VALUES,
  SOURCE_STATUS_VALUES,
  TRIGGER_SOURCE_VALUES,
} from "./enums";

describe("domain enum values", () => {
  it("keeps run statuses in DB declaration order", () => {
    expect(RUN_STATUS_VALUES).toEqual([
      "queued",
      "discovering",
      "awaiting_approval",
      "rejected",
      "enriching",
      "completed",
      "failed",
      "canceled",
    ]);
  });

  it("keeps business enrichment statuses in DB declaration order", () => {
    expect(BUSINESS_ENRICH_STATUS_VALUES).toEqual([
      "queued",
      "ai_running",
      "hunter_running",
      "enriched",
      "partial",
      "failed",
      "skipped",
    ]);
  });

  it("keeps email verification values in DB declaration order", () => {
    expect(EMAIL_VERIFICATION_VALUES).toEqual([
      "valid",
      "invalid",
      "accept_all",
      "webmail",
      "disposable",
      "unknown",
      "unverified",
    ]);
  });

  it("keeps source status values in DB declaration order", () => {
    expect(SOURCE_STATUS_VALUES).toEqual(["queued", "running", "succeeded", "failed", "skipped"]);
  });

  it("keeps trigger source, contact source, and contact kind values in DB declaration order", () => {
    expect(TRIGGER_SOURCE_VALUES).toEqual(["dashboard", "schedule", "api"]);
    expect(CONTACT_SOURCE_VALUES).toEqual(["ai", "hunter"]);
    expect(CONTACT_KIND_VALUES).toEqual(["person", "merged"]);
  });
});
