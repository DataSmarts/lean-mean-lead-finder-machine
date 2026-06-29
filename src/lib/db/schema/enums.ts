import { pgEnum } from "drizzle-orm/pg-core";

import {
  BUSINESS_ENRICH_STATUS_VALUES,
  CONTACT_KIND_VALUES,
  CONTACT_SOURCE_VALUES,
  EMAIL_VERIFICATION_VALUES,
  RUN_STATUS_VALUES,
  SOURCE_STATUS_VALUES,
  TRIGGER_SOURCE_VALUES,
} from "@/lib/domain/enums";

// §6.2 — values must match ARCHITECTURE.md exactly and in order.
// Order is significant: Postgres emits CREATE TYPE ... AS ENUM (...) in declaration order.

export const runStatus = pgEnum("run_status", RUN_STATUS_VALUES);

export const businessEnrichStatus = pgEnum("business_enrich_status", BUSINESS_ENRICH_STATUS_VALUES);

export const emailVerification = pgEnum("email_verification", EMAIL_VERIFICATION_VALUES);

// Per-source pipeline state for run_businesses.ai_status / hunter_status.
// §6.2 does not name this enum; sourceStatus was confirmed with the project owner.
export const sourceStatus = pgEnum("source_status", SOURCE_STATUS_VALUES);

export const triggerSource = pgEnum("trigger_source", TRIGGER_SOURCE_VALUES);

export const contactSource = pgEnum("contact_source", CONTACT_SOURCE_VALUES);

export const contactKind = pgEnum("contact_kind", CONTACT_KIND_VALUES);
