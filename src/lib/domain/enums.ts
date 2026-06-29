export const RUN_STATUS_VALUES = [
  "queued",
  "discovering",
  "awaiting_approval",
  "rejected",
  "enriching",
  "completed",
  "failed",
  "canceled",
] as const;

export const BUSINESS_ENRICH_STATUS_VALUES = [
  "queued",
  "ai_running",
  "hunter_running",
  "enriched",
  "partial",
  "failed",
  "skipped",
] as const;

export const EMAIL_VERIFICATION_VALUES = [
  "valid",
  "invalid",
  "accept_all",
  "webmail",
  "disposable",
  "unknown",
  "unverified",
] as const;

export const SOURCE_STATUS_VALUES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped",
] as const;

export const TRIGGER_SOURCE_VALUES = ["dashboard", "schedule", "api"] as const;

export const CONTACT_SOURCE_VALUES = ["ai", "hunter"] as const;

export const CONTACT_KIND_VALUES = ["person", "merged"] as const;

export type RunStatusValue = (typeof RUN_STATUS_VALUES)[number];
export type BusinessEnrichStatusValue = (typeof BUSINESS_ENRICH_STATUS_VALUES)[number];
export type EmailVerificationValue = (typeof EMAIL_VERIFICATION_VALUES)[number];
export type SourceStatusValue = (typeof SOURCE_STATUS_VALUES)[number];
export type TriggerSourceValue = (typeof TRIGGER_SOURCE_VALUES)[number];
export type ContactSourceValue = (typeof CONTACT_SOURCE_VALUES)[number];
export type ContactKindValue = (typeof CONTACT_KIND_VALUES)[number];

export type BadgeTone = "muted" | "active" | "success" | "danger";
