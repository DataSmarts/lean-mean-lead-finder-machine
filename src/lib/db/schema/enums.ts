import { pgEnum } from "drizzle-orm/pg-core";

// §6.2 — values must match ARCHITECTURE.md exactly and in order.
// Order is significant: Postgres emits CREATE TYPE ... AS ENUM (...) in declaration order.

export const runStatus = pgEnum("run_status", [
  "queued",
  "discovering",
  "awaiting_approval",
  "rejected",
  "enriching",
  "completed",
  "failed",
  "canceled",
]);

export const businessEnrichStatus = pgEnum("business_enrich_status", [
  "queued",
  "ai_running",
  "hunter_running",
  "enriched",
  "partial",
  "failed",
  "skipped",
]);

export const emailVerification = pgEnum("email_verification", [
  "valid",
  "invalid",
  "accept_all",
  "webmail",
  "disposable",
  "unknown",
  "unverified",
]);

// Per-source pipeline state for run_businesses.ai_status / hunter_status.
// §6.2 does not name this enum; sourceStatus was confirmed with the project owner.
export const sourceStatus = pgEnum("source_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped",
]);

export const triggerSource = pgEnum("trigger_source", ["dashboard", "schedule", "api"]);

export const contactSource = pgEnum("contact_source", ["ai", "hunter"]);

export const contactKind = pgEnum("contact_kind", ["person", "merged"]);
