import { task } from "@trigger.dev/sdk";

import { dbDirect } from "@/lib/db/client";
import { makeContactsRepo } from "@/lib/db/contacts.repo";
import { makeRunBusinessesRepo } from "@/lib/db/run-businesses.repo";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import { createFinalizeService } from "@/lib/services/finalize";

export const finalizeRunTask = task({
  id: "finalize.run",
  run: async (payload: { runId: string }) => {
    const service = createFinalizeService({
      runsRepo: makeRunsRepo(dbDirect),
      runBusinessesRepo: makeRunBusinessesRepo(dbDirect),
      contactsRepo: makeContactsRepo(dbDirect),
    });
    return service.finalize(payload.runId);
  },
});
