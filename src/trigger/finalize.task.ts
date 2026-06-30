import { task } from "@trigger.dev/sdk";

import { getDbDirect } from "@/lib/db/client";
import { makeContactsRepo } from "@/lib/db/contacts.repo";
import { makeRunBusinessesRepo } from "@/lib/db/run-businesses.repo";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import { captureTriggerFailure } from "@/lib/observability/trigger";
import { createFinalizeService } from "@/lib/services/finalize";

export const finalizeRunTask = task({
  id: "finalize.run",
  onFailure: ({ payload, error }) =>
    captureTriggerFailure({
      taskId: "finalize.run",
      payload,
      error,
      runId: payload.runId,
    }),
  run: async (payload: { runId: string }) => {
    const db = getDbDirect();
    const service = createFinalizeService({
      runsRepo: makeRunsRepo(db),
      runBusinessesRepo: makeRunBusinessesRepo(db),
      contactsRepo: makeContactsRepo(db),
    });
    return service.finalize(payload.runId);
  },
});
