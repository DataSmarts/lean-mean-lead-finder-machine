import type { AppDatabase } from "@/lib/db/client";
import type { LeadRow, LeadsFilter } from "@/lib/db/leads.repo";
import { makeLeadsRepo } from "@/lib/db/leads.repo";
import type { Run } from "@/lib/db/runs.repo";
import { makeRunsRepo } from "@/lib/db/runs.repo";

import { mergedToCsv, rawToCsv } from "./export";

export interface RunExportRunsRepo {
  findById(id: string): Promise<Run | undefined>;
}

export interface RunExportLeadsRepo {
  exportMerged(filter: LeadsFilter): Promise<LeadRow[]>;
  exportRaw(runId: string): Promise<LeadRow[]>;
}

export type RunExportResult =
  | { readonly status: "ok"; readonly csv: string; readonly filename: string }
  | { readonly status: "not_found" };

export interface RunExportService {
  exportRun(input: { readonly runId: string; readonly raw: boolean }): Promise<RunExportResult>;
}

export function createRunExportService(deps: {
  readonly runsRepo: RunExportRunsRepo;
  readonly leadsRepo: RunExportLeadsRepo;
}): RunExportService {
  const { runsRepo, leadsRepo } = deps;

  return {
    async exportRun({ runId, raw }) {
      const run = await runsRepo.findById(runId);
      if (!run) return { status: "not_found" };

      if (raw) {
        const rows = await leadsRepo.exportRaw(runId);
        return {
          status: "ok",
          csv: rawToCsv(rows),
          filename: `run-${runId}-raw.csv`,
        };
      }

      const rows = await leadsRepo.exportMerged({ runId });
      return {
        status: "ok",
        csv: mergedToCsv(rows),
        filename: `run-${runId}-merged.csv`,
      };
    },
  };
}

export function makeRunExportService(db: AppDatabase): RunExportService {
  return createRunExportService({
    runsRepo: makeRunsRepo(db),
    leadsRepo: makeLeadsRepo(db),
  });
}
