import type { NewPreset, Preset, PresetUpdate } from "@/lib/db/presets.repo";
import type { PresetFormData } from "@/lib/validation/presets";

import type { PresetScheduleService } from "./preset-schedule";
import type { RunService } from "./run";

export type PresetMutationResult =
  | { readonly status: "ok" }
  | { readonly status: "not_found" }
  | { readonly status: "failed" };

export interface PresetManagementRepo {
  findById(id: string): Promise<Preset | undefined>;
  create(data: NewPreset): Promise<Preset>;
  update(id: string, data: PresetUpdate): Promise<Preset | undefined>;
  delete(id: string): Promise<void>;
}

export interface PresetManagementService {
  save(input: PresetFormData): Promise<PresetMutationResult>;
  toggleActive(presetId: string): Promise<PresetMutationResult>;
  delete(presetId: string): Promise<PresetMutationResult>;
  runNow(
    presetId: string,
  ): Promise<{ readonly status: "ok"; readonly runId: string } | { readonly status: "not_found" }>;
}

export function createPresetManagementService(deps: {
  readonly presetsRepo: PresetManagementRepo;
  readonly scheduleService: PresetScheduleService;
  readonly runService: RunService;
}): PresetManagementService {
  const { presetsRepo, scheduleService, runService } = deps;

  async function syncSchedule(preset: Preset): Promise<void> {
    const newScheduleId = await scheduleService.sync({
      id: preset.id,
      scheduleId: preset.scheduleId ?? null,
      isActive: preset.isActive,
      cron: preset.cron ?? null,
    });

    if (newScheduleId !== (preset.scheduleId ?? null)) {
      await presetsRepo.update(preset.id, { scheduleId: newScheduleId ?? undefined });
    }
  }

  return {
    async save(input) {
      const { id, ...presetData } = input;
      let preset = id ? await presetsRepo.findById(id) : undefined;
      if (id && !preset) return { status: "not_found" };

      if (preset) {
        preset = (await presetsRepo.update(preset.id, presetData)) ?? preset;
      } else {
        preset = await presetsRepo.create(presetData);
      }

      await syncSchedule(preset);
      return { status: "ok" };
    },

    async toggleActive(presetId) {
      const preset = await presetsRepo.findById(presetId);
      if (!preset) return { status: "not_found" };

      const updated = await presetsRepo.update(presetId, { isActive: !preset.isActive });
      if (!updated) return { status: "failed" };

      await syncSchedule(updated);
      return { status: "ok" };
    },

    async delete(presetId) {
      const preset = await presetsRepo.findById(presetId);
      if (!preset) return { status: "not_found" };

      if (preset.scheduleId) {
        await scheduleService.remove(preset.scheduleId);
      }

      await presetsRepo.delete(presetId);
      return { status: "ok" };
    },

    async runNow(presetId) {
      const preset = await presetsRepo.findById(presetId);
      if (!preset) return { status: "not_found" };

      const run = await runService.createFromPresetAndTrigger(preset);
      return { status: "ok", runId: run.id };
    },
  };
}
