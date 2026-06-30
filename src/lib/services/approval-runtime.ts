import { wait } from "@trigger.dev/sdk";

import { getDb } from "@/lib/db/client";
import { makeRunsRepo } from "@/lib/db/runs.repo";

import type { ApprovalDecisionPayload, ApprovalService } from "./approval";
import { createApprovalService } from "./approval";

function completeWaitpoint(waitpointId: string, data: ApprovalDecisionPayload): Promise<void> {
  return wait.completeToken(waitpointId, data).then(() => undefined);
}

export function createApprovalRuntime(): ApprovalService {
  return createApprovalService({
    runsRepo: makeRunsRepo(getDb()),
    completeWaitpoint,
  });
}
