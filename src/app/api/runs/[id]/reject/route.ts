import { wait } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import { createApprovalService } from "@/lib/services/approval";

// Authenticated by the proxy gate (src/proxy.ts) — /api/* except the Telegram webhook.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const service = createApprovalService({
    runsRepo: makeRunsRepo(db),
    completeWaitpoint: (waitpointId, data) =>
      wait.completeToken(waitpointId, data).then(() => undefined),
  });

  const outcome = await service.reject({ runId: id }, "admin");

  if (outcome.status === "applied") {
    return NextResponse.json({ status: "rejected" }, { status: 200 });
  }
  if (outcome.status === "already_handled") {
    return NextResponse.json({ error: "Already handled" }, { status: 409 });
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
