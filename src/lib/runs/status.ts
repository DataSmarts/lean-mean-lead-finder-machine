import type { BadgeTone, BusinessEnrichStatusValue, RunStatusValue } from "@/lib/domain/enums";

export type { BadgeTone, BusinessEnrichStatusValue, RunStatusValue };

export const TERMINAL_RUN_STATUSES = new Set<RunStatusValue>([
  "rejected",
  "completed",
  "failed",
  "canceled",
]);

export function isTerminalRunStatus(status: RunStatusValue): boolean {
  return TERMINAL_RUN_STATUSES.has(status);
}

export const RUN_STATUS_BADGE_TONE: Record<RunStatusValue, BadgeTone> = {
  queued: "muted",
  discovering: "muted",
  awaiting_approval: "active",
  enriching: "active",
  completed: "success",
  rejected: "danger",
  failed: "danger",
  canceled: "danger",
};

export const BUSINESS_ENRICH_STATUS_BADGE_TONE: Record<BusinessEnrichStatusValue, BadgeTone> = {
  queued: "muted",
  ai_running: "active",
  hunter_running: "active",
  enriched: "success",
  partial: "active",
  failed: "danger",
  skipped: "muted",
};
