import type { AppDatabase } from "@/lib/db/client";
import type { Run } from "@/lib/db/runs.repo";
import { makeRunsRepo } from "@/lib/db/runs.repo";

export type RunTriggerSource = "dashboard" | "schedule" | "api";

export interface CreateRunInput {
  readonly triggerSource: RunTriggerSource;
  readonly neighborhood?: string | null;
  readonly city: string;
  readonly country: string;
  readonly niche: string;
  readonly maxResults: number;
  readonly presetId?: string | null;
}

export interface RunService {
  create(input: CreateRunInput): Promise<Run>;
}

export function createRunService(deps: { db: AppDatabase }): RunService {
  const runsRepo = makeRunsRepo(deps.db);
  return {
    async create(input: CreateRunInput): Promise<Run> {
      return runsRepo.create({
        triggerSource: input.triggerSource,
        status: "queued",
        neighborhood: input.neighborhood ?? null,
        city: input.city,
        country: input.country,
        niche: input.niche,
        maxResults: input.maxResults,
        presetId: input.presetId ?? null,
        // Unguessable token the Approval slice uses to correlate the Telegram/webhook callback.
        approvalToken: crypto.randomUUID(),
      });
    },
  };
}
