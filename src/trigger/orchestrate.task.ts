import { task, wait } from "@trigger.dev/sdk";

import { createHttpClient } from "@/lib/clients/http";
import { createTelegramClient } from "@/lib/clients/telegram";
import { dbDirect } from "@/lib/db/client";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import { env } from "@/lib/env";
import { PipelineStateError } from "@/lib/errors";
import { captureTriggerFailure } from "@/lib/observability/trigger";
import { type ApprovalDecisionPayload, buildApprovalPrompt } from "@/lib/services/approval";

import { discoverTask } from "./discover.task";
import { enrichFanOutTask } from "./enrich.task";
import { finalizeRunTask } from "./finalize.task";

// Root task — the single entry point all triggers (form, API, schedule) funnel through.
// APPEND-ONLY: downstream slices add their stage after the approval gate; never reorder or fork.
export const orchestrateTask = task({
  id: "leadRun.orchestrate",
  onFailure: ({ payload, error }) =>
    captureTriggerFailure({
      taskId: "leadRun.orchestrate",
      payload,
      error,
      runId: payload.runId,
    }),
  run: async (payload: { runId: string }) => {
    const http = createHttpClient();
    const telegram = createTelegramClient({ http, botToken: env.TELEGRAM_BOT_TOKEN });
    const runsRepo = makeRunsRepo(dbDirect);

    await runsRepo.updateStatus(payload.runId, "discovering", { startedAt: new Date() });
    const discovery = await discoverTask.triggerAndWait({ runId: payload.runId }).unwrap();

    // --- Approval gate (DAT-41) ---
    const run = await runsRepo.findById(payload.runId);
    if (!run) {
      throw new PipelineStateError(`Run ${payload.runId} not found after discover`, {
        context: { runId: payload.runId },
      });
    }

    // idempotencyKey ties the token to this specific run so a task retry reuses the same token.
    const token = await wait.createToken({
      timeout: "24h",
      idempotencyKey: run.approvalToken,
      idempotencyKeyTTL: "25h",
      tags: [`run:${payload.runId}`],
    });

    const awaitingRun = await runsRepo.updateStatus(payload.runId, "awaiting_approval", {
      approvalWaitpointId: token.id,
    });

    const promptRun = awaitingRun ?? run;
    if (shouldSendApprovalPrompt(promptRun)) {
      const { text, replyMarkup } = buildApprovalPrompt({ run, appBaseUrl: env.APP_BASE_URL });
      const message = await telegram.sendMessage({
        chatId: env.TELEGRAM_CHAT_ID,
        text,
        replyMarkup,
      });
      await runsRepo.recordApprovalMessage(payload.runId, message.messageId);
    }

    const result = await wait.forToken<ApprovalDecisionPayload>(token.id);

    const nextStatus = mapWaitpointResult(result);

    if (nextStatus === "rejected") {
      // Timeout path: nobody set rejected_at, so we do it here.
      if (!result.ok) {
        await runsRepo.recordRejection(payload.runId);
      }
      await runsRepo.updateStatus(payload.runId, "rejected");
      return;
    }

    await runsRepo.updateStatus(payload.runId, "enriching");
    await enrichFanOutTask.triggerAndWait({ runId: payload.runId }).unwrap();
    // finalize.run recomputes counters and sets status=completed|failed + finishedAt.
    await finalizeRunTask.triggerAndWait({ runId: payload.runId }).unwrap();

    return discovery;
  },
});

// Pure — maps the forToken result to the next run status, testable without Trigger.dev.
export function mapWaitpointResult(result: {
  ok: boolean;
  output?: ApprovalDecisionPayload;
}): "approved" | "rejected" {
  if (!result.ok) return "rejected";
  if (result.output?.decision === "rejected") return "rejected";
  return "approved";
}

export function shouldSendApprovalPrompt(run: { approvalMessageId: number | null }): boolean {
  return run.approvalMessageId === null;
}
