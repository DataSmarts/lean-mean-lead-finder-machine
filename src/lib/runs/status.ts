// Client-safe: no @/lib/db, @/lib/env, or service imports.
// Badge tones map to CSS design tokens in globals.css.
export type BadgeTone = "muted" | "active" | "success" | "danger";

// runStatus enum values: queued|discovering|awaiting_approval|rejected|enriching|completed|failed|canceled
export type RunStatusValue =
  | "queued"
  | "discovering"
  | "awaiting_approval"
  | "rejected"
  | "enriching"
  | "completed"
  | "failed"
  | "canceled";

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
