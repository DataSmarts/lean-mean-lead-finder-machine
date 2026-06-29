import { describe, expect, it } from "vitest";

import {
  BUSINESS_ENRICH_STATUS_VALUES,
  CONTACT_KIND_VALUES,
  CONTACT_SOURCE_VALUES,
  EMAIL_VERIFICATION_VALUES,
  RUN_STATUS_VALUES,
  SOURCE_STATUS_VALUES,
  TRIGGER_SOURCE_VALUES,
} from "@/lib/domain/enums";

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
  it("uses the shared domain values", () => {
    expect(runStatus.enumValues).toEqual(RUN_STATUS_VALUES);
  });
});

describe("businessEnrichStatus enum", () => {
  it("uses the shared domain values", () => {
    expect(businessEnrichStatus.enumValues).toEqual(BUSINESS_ENRICH_STATUS_VALUES);
  });
});

describe("emailVerification enum", () => {
  it("uses the shared domain values", () => {
    expect(emailVerification.enumValues).toEqual(EMAIL_VERIFICATION_VALUES);
  });
});

describe("sourceStatus enum", () => {
  it("uses the shared domain values", () => {
    expect(sourceStatus.enumValues).toEqual(SOURCE_STATUS_VALUES);
  });
});

describe("triggerSource enum", () => {
  it("uses the shared domain values", () => {
    expect(triggerSource.enumValues).toEqual(TRIGGER_SOURCE_VALUES);
  });
});

describe("contactSource enum", () => {
  it("uses the shared domain values", () => {
    expect(contactSource.enumValues).toEqual(CONTACT_SOURCE_VALUES);
  });
});

describe("contactKind enum", () => {
  it("uses the shared domain values", () => {
    expect(contactKind.enumValues).toEqual(CONTACT_KIND_VALUES);
  });
});
