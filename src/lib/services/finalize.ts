import type { EnrichStatusValue } from "@/lib/db/run-businesses.repo";
import type { Run } from "@/lib/db/runs.repo";

// Narrow repo ports (ISP) — finalize only uses these operations.
export interface FinalizeRunsRepo {
  findById(id: string): Promise<Run | undefined>;
  updateStatus(
    id: string,
    status: "completed" | "failed",
    extra?: Partial<Pick<Run, "finishedAt" | "error">>,
  ): Promise<Run | undefined>;
  // Set the counter columns directly (authoritative recompute rather than incremental).
  // Uses an explicit update rather than incrementCounter to avoid sign-errors on re-runs.
  setCounters(
    id: string,
    counters: { businessesEnriched: number; businessesFailed: number; contactsFound: number },
  ): Promise<Run | undefined>;
}

export interface FinalizeRunBusinessesRepo {
  countByRun(runId: string): Promise<Partial<Record<EnrichStatusValue, number>>>;
}

export interface FinalizeContactsRepo {
  countMerged(runId: string): Promise<number>;
}

export interface FinalizeServiceDeps {
  readonly runsRepo: FinalizeRunsRepo;
  readonly runBusinessesRepo: FinalizeRunBusinessesRepo;
  readonly contactsRepo: FinalizeContactsRepo;
}

export interface FinalizeService {
  finalize(runId: string): Promise<{ status: "completed" | "failed" }>;
}

// Determines the terminal run status from the per-business counts.
export function determineRunStatus(
  counts: Partial<Record<EnrichStatusValue, number>>,
): "completed" | "failed" {
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  if (total === 0) return "completed";
  const failed = counts.failed ?? 0;
  // If all businesses failed → run failed; otherwise at least one enriched/partial → completed.
  return failed === total ? "failed" : "completed";
}

export function createFinalizeService({
  runsRepo,
  runBusinessesRepo,
  contactsRepo,
}: FinalizeServiceDeps): FinalizeService {
  return {
    async finalize(runId) {
      const [counts, contactsFound] = await Promise.all([
        runBusinessesRepo.countByRun(runId),
        contactsRepo.countMerged(runId),
      ]);

      const businessesEnriched = (counts.enriched ?? 0) + (counts.partial ?? 0);
      const businessesFailed = counts.failed ?? 0;
      const status = determineRunStatus(counts);

      await runsRepo.setCounters(runId, { businessesEnriched, businessesFailed, contactsFound });
      await runsRepo.updateStatus(runId, status, { finishedAt: new Date() });

      return { status };
    },
  };
}
