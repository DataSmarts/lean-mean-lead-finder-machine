import { tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { createRunService } from "@/lib/services/run";
import { createRunSchema } from "@/lib/validation/runs";
import type { orchestrateTask } from "@/trigger/orchestrate.task";

// Authenticated by the proxy gate (src/proxy.ts) — every /api/* path except the Telegram webhook.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = createRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const run = await createRunService({ db }).create({ ...parsed.data, triggerSource: "api" });
  await tasks.trigger<typeof orchestrateTask>("leadRun.orchestrate", { runId: run.id });

  return NextResponse.json({ runId: run.id, status: run.status }, { status: 202 });
}
