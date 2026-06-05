// Client-safe: no DB or service imports.
// Mirrors the badge-tone pattern from src/lib/runs/status.ts.

import type { BadgeTone } from "@/lib/runs/status";

export type ContactSourceValue = "ai" | "hunter";

export type EmailVerificationValue =
  | "valid"
  | "invalid"
  | "accept_all"
  | "webmail"
  | "disposable"
  | "unknown"
  | "unverified";

// Derives which sources contributed to a merged contact for display as badges.
// Falls back to [winningSource] when fieldSources is null/empty.
// Return order is stable: ai before hunter (alphabetical).
export function deriveSourceBadges(
  fieldSources: Record<string, "ai" | "hunter"> | null | undefined,
  winningSource: ContactSourceValue,
): ContactSourceValue[] {
  const sources: Set<ContactSourceValue> = new Set();
  if (fieldSources) {
    for (const src of Object.values(fieldSources)) {
      sources.add(src);
    }
  }
  if (sources.size === 0) sources.add(winningSource);
  // Stable order: ai before hunter.
  const ordered: ContactSourceValue[] = [];
  if (sources.has("ai")) ordered.push("ai");
  if (sources.has("hunter")) ordered.push("hunter");
  return ordered;
}

export const EMAIL_VERIFICATION_BADGE_TONE: Record<EmailVerificationValue, BadgeTone> = {
  valid: "success",
  invalid: "danger",
  accept_all: "muted",
  webmail: "muted",
  disposable: "danger",
  unknown: "muted",
  unverified: "muted",
};
