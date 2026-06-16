import type { AppDatabase } from "@/lib/db/client";
import type { RunsListParams, RunsListResult } from "@/lib/db/runs.repo";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import { type RunView, toRunView } from "@/lib/services/run-read";

export interface RunsListPageView {
  readonly runs: RunView[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface RunsListRunsRepo {
  list(params: RunsListParams): Promise<RunsListResult>;
}

export interface RunsListService {
  list(params: RunsListParams): Promise<RunsListPageView>;
}

export function createRunsListService(runsRepo: RunsListRunsRepo): RunsListService {
  return {
    async list(params) {
      const result = await runsRepo.list(params);
      return {
        runs: result.runs.map(toRunView),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      };
    },
  };
}

export function makeRunsListService(db: AppDatabase): RunsListService {
  return createRunsListService(makeRunsRepo(db));
}
