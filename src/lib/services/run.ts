import type { AppDatabase } from "@/lib/db/client";
import type { Run } from "@/lib/db/runs.repo";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import type { TriggerSourceValue } from "@/lib/domain/enums";

export type RunTriggerSource = TriggerSourceValue;

export interface CreateRunInput {
  readonly triggerSource: RunTriggerSource;
  readonly neighborhood?: string | null;
  readonly city: string;
  readonly country: string;
  readonly niche: string;
  readonly maxResults: number;
  readonly presetId?: string | null;
}

// Minimal preset fields needed to create a run snapshot.
export interface PresetSnapshot {
  readonly id: string;
  readonly neighborhood: string | null;
  readonly city: string;
  readonly country: string;
  readonly niche: string;
  readonly maxResults: number;
}

export interface RunService {
  create(input: CreateRunInput): Promise<Run>;
  createFromPreset(preset: PresetSnapshot): Promise<Run>;
  createAndTrigger(input: CreateRunInput): Promise<Run>;
  createFromPresetAndTrigger(preset: PresetSnapshot): Promise<Run>;
}

export interface RunTrigger {
  trigger(runId: string): Promise<{ triggerRunId: string | null }>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createRunService(deps: { db: AppDatabase; trigger?: RunTrigger }): RunService {
  const runsRepo = makeRunsRepo(deps.db);

  async function createRun(input: CreateRunInput): Promise<Run> {
    return runsRepo.create({
      triggerSource: input.triggerSource,
      status: "queued",
      neighborhood: input.neighborhood ?? null,
      city: input.city,
      country: input.country,
      niche: input.niche,
      maxResults: input.maxResults,
      presetId: input.presetId ?? null,
      approvalToken: crypto.randomUUID(),
    });
  }

  async function triggerRun(run: Run): Promise<Run> {
    if (!deps.trigger) return run;

    try {
      const { triggerRunId } = await deps.trigger.trigger(run.id);
      return (await runsRepo.updateStatus(run.id, run.status, { triggerRunId })) ?? run;
    } catch (error) {
      await runsRepo.updateStatus(run.id, "failed", {
        error: errorMessage(error),
        finishedAt: new Date(),
      });
      throw error;
    }
  }

  function createRunFromPreset(preset: PresetSnapshot): Promise<Run> {
    return createRun({
      triggerSource: "schedule",
      neighborhood: preset.neighborhood,
      city: preset.city,
      country: preset.country,
      niche: preset.niche,
      maxResults: preset.maxResults,
      presetId: preset.id,
    });
  }

  return {
    async create(input: CreateRunInput): Promise<Run> {
      return createRun(input);
    },

    async createFromPreset(preset: PresetSnapshot): Promise<Run> {
      return createRunFromPreset(preset);
    },

    async createAndTrigger(input: CreateRunInput): Promise<Run> {
      return triggerRun(await createRun(input));
    },

    async createFromPresetAndTrigger(preset: PresetSnapshot): Promise<Run> {
      return triggerRun(await createRunFromPreset(preset));
    },
  };
}
