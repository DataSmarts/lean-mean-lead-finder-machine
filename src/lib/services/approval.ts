import type { InlineKeyboardMarkup } from "@/lib/clients/telegram";
import type { Run } from "@/lib/db/runs.repo";

export interface ApprovalDecisionPayload {
  readonly decision: "approved" | "rejected";
  readonly by: string;
}

export type ApprovalOutcomeStatus = "applied" | "already_handled" | "not_found";

export interface ApprovalOutcome {
  readonly status: ApprovalOutcomeStatus;
}

export type RunLocator = { runId: string } | { approvalToken: string };

// Narrow repo port — approval only needs these operations.
export interface ApprovalRunsRepo {
  findById(id: string): Promise<Run | undefined>;
  findByApprovalToken(token: string): Promise<Run | undefined>;
  recordApproval(id: string, by: string): Promise<Run | undefined>;
  recordRejection(id: string): Promise<Run | undefined>;
  clearApprovalDecision(id: string): Promise<void>;
}

export interface ApprovalServiceDeps {
  readonly runsRepo: ApprovalRunsRepo;
  // Injected so the service is testable without a live Trigger.dev environment.
  readonly completeWaitpoint: (waitpointId: string, data: ApprovalDecisionPayload) => Promise<void>;
}

export interface ApprovalService {
  approve(locator: RunLocator, by: string): Promise<ApprovalOutcome>;
  reject(locator: RunLocator, by: string): Promise<ApprovalOutcome>;
}

// Pure — no I/O. Build the Telegram message body for a run awaiting approval.
export function buildApprovalPrompt(params: {
  run: Pick<Run, "id" | "approvalToken" | "niche" | "city" | "country">;
  appBaseUrl: string;
}): { text: string; replyMarkup: InlineKeyboardMarkup } {
  const { run, appBaseUrl } = params;
  const link = `${appBaseUrl}/runs/${run.id}`;
  const text =
    `🔍 *New lead run awaiting approval*\n\n` +
    `Niche: ${run.niche}\n` +
    `Location: ${run.city}, ${run.country}\n\n` +
    `[View in dashboard](${link})`;

  // callback_data must be ≤64 bytes. "approve:" + UUID-36 = 44 bytes ✓
  const replyMarkup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `approve:${run.approvalToken}` },
        { text: "❌ Reject", callback_data: `reject:${run.approvalToken}` },
      ],
    ],
  };

  return { text, replyMarkup };
}

export function createApprovalService({
  runsRepo,
  completeWaitpoint,
}: ApprovalServiceDeps): ApprovalService {
  async function resolveRun(locator: RunLocator): Promise<Run | undefined> {
    if ("runId" in locator) {
      return runsRepo.findById(locator.runId);
    }
    return runsRepo.findByApprovalToken(locator.approvalToken);
  }

  async function applyDecision(
    locator: RunLocator,
    decision: "approved" | "rejected",
    by: string,
  ): Promise<ApprovalOutcome> {
    const run = await resolveRun(locator);
    if (!run) return { status: "not_found" };
    if (!run.approvalWaitpointId) return { status: "not_found" };

    const claimed =
      decision === "approved"
        ? await runsRepo.recordApproval(run.id, by)
        : await runsRepo.recordRejection(run.id);

    if (!claimed) return { status: "already_handled" };

    try {
      await completeWaitpoint(run.approvalWaitpointId, { decision, by });
    } catch (error) {
      // Roll back the claim so Telegram / the dashboard can retry cleanly.
      await runsRepo.clearApprovalDecision(run.id);
      throw error;
    }

    return { status: "applied" };
  }

  return {
    approve: (locator, by) => applyDecision(locator, "approved", by),
    reject: (locator, by) => applyDecision(locator, "rejected", by),
  };
}
