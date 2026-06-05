export interface ScheduleOps {
  create(params: {
    task: string;
    cron: string;
    externalId: string;
    deduplicationKey: string;
  }): Promise<{ id: string }>;
  update(
    scheduleId: string,
    params: { task: string; cron: string; externalId: string },
  ): Promise<{ id: string }>;
  activate(scheduleId: string): Promise<{ id: string }>;
  deactivate(scheduleId: string): Promise<{ id: string }>;
  del(scheduleId: string): Promise<void>;
}

interface PresetForSync {
  readonly id: string;
  readonly scheduleId: string | null;
  readonly isActive: boolean;
  readonly cron: string | null;
}

export interface PresetScheduleService {
  // Ensures the Trigger.dev schedule matches the preset's active/cron state.
  // Returns the scheduleId to persist (may be null when no schedule exists).
  sync(preset: PresetForSync): Promise<string | null>;
  // Removes the Trigger.dev schedule permanently (call before deleting a preset).
  remove(scheduleId: string): Promise<void>;
}

const TASK_ID = "presets.schedule";

export function createPresetScheduleService(deps: {
  scheduleOps: ScheduleOps;
}): PresetScheduleService {
  const { scheduleOps } = deps;

  return {
    async sync(preset) {
      const shouldSchedule = preset.isActive && !!preset.cron;

      if (shouldSchedule) {
        if (preset.scheduleId) {
          await scheduleOps.update(preset.scheduleId, {
            task: TASK_ID,
            cron: preset.cron!,
            externalId: preset.id,
          });
          await scheduleOps.activate(preset.scheduleId);
          return preset.scheduleId;
        }
        const result = await scheduleOps.create({
          task: TASK_ID,
          cron: preset.cron!,
          externalId: preset.id,
          deduplicationKey: preset.id,
        });
        return result.id;
      }

      if (preset.scheduleId) {
        await scheduleOps.deactivate(preset.scheduleId);
      }
      return preset.scheduleId;
    },

    async remove(scheduleId) {
      await scheduleOps.del(scheduleId);
    },
  };
}
