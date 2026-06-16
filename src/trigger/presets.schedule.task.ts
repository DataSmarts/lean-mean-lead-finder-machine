import { schedules } from "@trigger.dev/sdk";

import { createLeadRunTrigger } from "@/lib/clients/trigger";
import { dbDirect } from "@/lib/db/client";
import { makePresetsRepo } from "@/lib/db/presets.repo";
import { PipelineStateError } from "@/lib/errors";
import { captureTriggerFailure } from "@/lib/observability/trigger";
import { createRunService } from "@/lib/services/run";

// One task handles all active preset schedules.
// Each schedule instance passes its preset id via externalId.
export const presetScheduleTask = schedules.task({
  id: "presets.schedule",
  onFailure: ({ payload, error }) =>
    captureTriggerFailure({
      taskId: "presets.schedule",
      payload,
      error,
      runId: payload.externalId,
    }),
  run: async (payload) => {
    if (!payload.externalId) {
      throw new PipelineStateError("presets.schedule requires externalId (preset id)");
    }

    const preset = await makePresetsRepo(dbDirect).findById(payload.externalId);

    // Guard: preset was deleted or deactivated between schedule creation and fire time.
    if (!preset || !preset.isActive) return;

    await createRunService({
      db: dbDirect,
      trigger: createLeadRunTrigger(),
    }).createFromPresetAndTrigger(preset);
  },
});
