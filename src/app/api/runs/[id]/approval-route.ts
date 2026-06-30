import { NextResponse } from "next/server";

import type { ApprovalOutcome } from "@/lib/services/approval";
import { createApprovalRuntime } from "@/lib/services/approval-runtime";

type DashboardApprovalAction = "approve" | "reject";

interface DashboardApprovalParams {
  readonly action: DashboardApprovalAction;
  readonly params: Promise<{ id: string }>;
}

const APPLIED_STATUS: Record<DashboardApprovalAction, "approved" | "rejected"> = {
  approve: "approved",
  reject: "rejected",
};

function toDashboardApprovalResponse(
  action: DashboardApprovalAction,
  outcome: ApprovalOutcome,
): NextResponse {
  if (outcome.status === "applied") {
    return NextResponse.json({ status: APPLIED_STATUS[action] }, { status: 200 });
  }
  if (outcome.status === "already_handled") {
    return NextResponse.json({ error: "Already handled" }, { status: 409 });
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function handleDashboardApproval({
  action,
  params,
}: DashboardApprovalParams): Promise<NextResponse> {
  const { id } = await params;
  const service = createApprovalRuntime();
  const outcome =
    action === "approve"
      ? await service.approve({ runId: id }, "admin")
      : await service.reject({ runId: id }, "admin");

  return toDashboardApprovalResponse(action, outcome);
}
