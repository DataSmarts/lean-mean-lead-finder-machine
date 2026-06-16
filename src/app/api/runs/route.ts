import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createLeadRunTrigger } from "@/lib/clients/trigger";
import { db } from "@/lib/db/client";
import { createRunService } from "@/lib/services/run";
import { createRunSchema } from "@/lib/validation/runs";

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

  const run = await createRunService({ db, trigger: createLeadRunTrigger() }).createAndTrigger({
    ...parsed.data,
    triggerSource: "api",
  });

  return NextResponse.json({ runId: run.id, status: run.status }, { status: 202 });
}
