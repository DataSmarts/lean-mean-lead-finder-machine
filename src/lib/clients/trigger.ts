import { tasks } from "@trigger.dev/sdk";

import type { RunTrigger } from "@/lib/services/run";
import type { orchestrateTask } from "@/trigger/orchestrate.task";

export function createLeadRunTrigger(): RunTrigger {
  return {
    async trigger(runId) {
      const handle = await tasks.trigger<typeof orchestrateTask>("leadRun.orchestrate", { runId });
      return { triggerRunId: handle.id };
    },
  };
}
