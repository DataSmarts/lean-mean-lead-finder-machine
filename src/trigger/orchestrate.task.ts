import { task } from "@trigger.dev/sdk";

import { dbDirect } from "@/lib/db/client";
import { makeRunsRepo } from "@/lib/db/runs.repo";

import { discoverTask } from "./discover.task";

// Root task — the single entry point all triggers (form, API, schedule) funnel through.
// APPEND-ONLY: downstream slices add their stage after discover; never reorder or fork the steps.
export const orchestrateTask = task({
  id: "leadRun.orchestrate",
  run: async (payload: { runId: string }) => {
    const runsRepo = makeRunsRepo(dbDirect);

    await runsRepo.updateStatus(payload.runId, "discovering", { startedAt: new Date() });
    const discovery = await discoverTask.triggerAndWait({ runId: payload.runId }).unwrap();

    // [Approval] DAT-41 replaces this with a Telegram waitpoint; for now the run parks here.
    await runsRepo.updateStatus(payload.runId, "awaiting_approval");

    return discovery;
  },
});
