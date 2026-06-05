import { schedules, tasks } from "@trigger.dev/sdk";

import { dbDirect } from "@/lib/db/client";
import { makePresetsRepo } from "@/lib/db/presets.repo";
import { createRunService } from "@/lib/services/run";

// One task handles all active preset schedules.
// Each schedule instance passes its preset id via externalId.
export const presetScheduleTask = schedules.task({
  id: "presets.schedule",
  run: async (payload) => {
    if (!payload.externalId) {
      throw new Error("presets.schedule requires externalId (preset id)");
    }

    const preset = await makePresetsRepo(dbDirect).findById(payload.externalId);

    // Guard: preset was deleted or deactivated between schedule creation and fire time.
    if (!preset || !preset.isActive) return;

    const run = await createRunService({ db: dbDirect }).createFromPreset(preset);
    await tasks.trigger("leadRun.orchestrate", { runId: run.id });
  },
});
