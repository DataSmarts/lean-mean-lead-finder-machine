import type { AppDatabase } from "@/lib/db/client";
import type { Run } from "@/lib/db/runs.repo";
import { makeRunsRepo } from "@/lib/db/runs.repo";

import { mergedToCsv, rawToCsv } from "./export";
import type { LeadsExportService } from "./leads-export";
import { makeLeadsExportService } from "./leads-export";

export interface RunExportRunsRepo {
  findById(id: string): Promise<Run | undefined>;
}

export type RunExportResult =
  | { readonly status: "ok"; readonly csv: string; readonly filename: string }
  | { readonly status: "not_found" };

export interface RunExportService {
  exportRun(input: { readonly runId: string; readonly raw: boolean }): Promise<RunExportResult>;
}

export function createRunExportService(deps: {
  readonly runsRepo: RunExportRunsRepo;
  readonly leadsExportService: LeadsExportService;
}): RunExportService {
  const { runsRepo, leadsExportService } = deps;

  return {
    async exportRun({ runId, raw }) {
      const run = await runsRepo.findById(runId);
      if (!run) return { status: "not_found" };

      if (raw) {
        const rows = await leadsExportService.exportRaw(runId);
        return {
          status: "ok",
          csv: rawToCsv(rows),
          filename: `run-${runId}-raw.csv`,
        };
      }

      const rows = await leadsExportService.exportMerged({ runId });
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
    leadsExportService: makeLeadsExportService(db),
  });
}
