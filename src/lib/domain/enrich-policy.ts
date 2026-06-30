import type { BusinessEnrichStatusValue, SourceStatusValue } from "./enums";

export const TERMINAL_BUSINESS_ENRICH_STATUSES = ["enriched", "partial", "failed"] as const;

export interface RunCounterDeltas {
  readonly businessesEnriched: number;
  readonly businessesFailed: number;
  readonly contactsFound: number;
}

export interface FinalRunCounters {
  readonly businessesEnriched: number;
  readonly businessesFailed: number;
  readonly contactsFound: number;
}

const ZERO_COUNTER_DELTAS: RunCounterDeltas = {
  businessesEnriched: 0,
  businessesFailed: 0,
  contactsFound: 0,
};

export function isTerminalBusinessEnrichStatus(status: BusinessEnrichStatusValue): boolean {
  return TERMINAL_BUSINESS_ENRICH_STATUSES.includes(
    status as (typeof TERMINAL_BUSINESS_ENRICH_STATUSES)[number],
  );
}

export function rollUpStatus(
  aiStatus: SourceStatusValue,
  hunterStatus: SourceStatusValue,
): BusinessEnrichStatusValue {
  const statuses = [aiStatus, hunterStatus];
  const succeeded = statuses.filter((status) => status === "succeeded").length;
  const failed = statuses.filter((status) => status === "failed").length;

  if (succeeded > 0 && failed === 0) return "enriched";
  if (succeeded === 0 && failed > 0) return "failed";
  if (succeeded === 0 && failed === 0) return "skipped";
  return "partial";
}

export function calculateTerminalCounterDeltas({
  previousStatus,
  nextStatus,
  mergedContactCount,
}: {
  readonly previousStatus: BusinessEnrichStatusValue;
  readonly nextStatus: BusinessEnrichStatusValue;
  readonly mergedContactCount: number;
}): RunCounterDeltas {
  if (
    isTerminalBusinessEnrichStatus(previousStatus) ||
    !isTerminalBusinessEnrichStatus(nextStatus)
  ) {
    return ZERO_COUNTER_DELTAS;
  }

  return {
    businessesEnriched: nextStatus === "enriched" || nextStatus === "partial" ? 1 : 0,
    businessesFailed: nextStatus === "failed" ? 1 : 0,
    contactsFound: mergedContactCount,
  };
}

export function calculateFinalCounters({
  counts,
  contactsFound,
}: {
  readonly counts: Partial<Record<BusinessEnrichStatusValue, number>>;
  readonly contactsFound: number;
}): FinalRunCounters {
  return {
    businessesEnriched: (counts.enriched ?? 0) + (counts.partial ?? 0),
    businessesFailed: counts.failed ?? 0,
    contactsFound,
  };
}
