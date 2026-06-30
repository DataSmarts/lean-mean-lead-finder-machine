import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/client";
import { makeRunReadService } from "@/lib/services/run-read";

// Authenticated by the proxy gate (src/proxy.ts) — /api/* except the Telegram webhook.
// force-dynamic: this is a live poll target; a cached response would never reflect progress.
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const view = await makeRunReadService(getDb()).getDetail(id);
  if (!view) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(view);
}
