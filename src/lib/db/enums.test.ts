import { describe, expect, it } from "vitest";

import {
  businessEnrichStatus,
  contactKind,
  contactSource,
  emailVerification,
  runStatus,
  sourceStatus,
  triggerSource,
} from "./schema/enums";

// Guards that enum values match ARCHITECTURE.md §6.2 exactly and in order.
// Drift here would cause a broken migration — caught in CI before touching DB.

describe("runStatus enum", () => {
  it("matches §6.2 exactly", () => {
    expect(runStatus.enumValues).toEqual([
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
});

describe("businessEnrichStatus enum", () => {
  it("matches §6.2 exactly", () => {
    expect(businessEnrichStatus.enumValues).toEqual([
      "queued",
      "ai_running",
      "hunter_running",
      "enriched",
      "partial",
      "failed",
      "skipped",
    ]);
  });
});

describe("emailVerification enum", () => {
  it("matches §6.2 exactly", () => {
    expect(emailVerification.enumValues).toEqual([
      "valid",
      "invalid",
      "accept_all",
      "webmail",
      "disposable",
      "unknown",
      "unverified",
    ]);
  });
});

describe("sourceStatus enum", () => {
  it("has the correct values", () => {
    expect(sourceStatus.enumValues).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
      "skipped",
    ]);
  });
});

describe("triggerSource enum", () => {
  it("has the correct values", () => {
    expect(triggerSource.enumValues).toEqual(["dashboard", "schedule", "api"]);
  });
});

describe("contactSource enum", () => {
  it("has the correct values", () => {
    expect(contactSource.enumValues).toEqual(["ai", "hunter"]);
  });
});

describe("contactKind enum", () => {
  it("has the correct values", () => {
    expect(contactKind.enumValues).toEqual(["person", "merged"]);
  });
});
