import type { NewPreset, Preset } from "@/lib/db/presets.repo";

import type { CreateRunInput, RunService } from "./run";

export interface DashboardRunPresetsRepo {
  upsertByName(data: NewPreset): Promise<Preset>;
}

export interface DashboardRunLaunchInput extends Omit<
  CreateRunInput,
  "triggerSource" | "presetId"
> {
  readonly presetName?: string;
}

export function createDashboardRunLaunchService(deps: {
  readonly presetsRepo: DashboardRunPresetsRepo;
  readonly runService: RunService;
}) {
  const { presetsRepo, runService } = deps;

  return {
    async launch(input: DashboardRunLaunchInput) {
      let presetId: string | null = null;

      if (input.presetName) {
        const preset = await presetsRepo.upsertByName({
          name: input.presetName,
          city: input.city,
          country: input.country,
          niche: input.niche,
          neighborhood: input.neighborhood ?? null,
          maxResults: input.maxResults,
          isActive: true,
          cron: null,
        });
        presetId = preset.id;
      }

      return runService.createAndTrigger({
        triggerSource: "dashboard",
        neighborhood: input.neighborhood,
        city: input.city,
        country: input.country,
        niche: input.niche,
        maxResults: input.maxResults,
        presetId,
      });
    },
  };
}
