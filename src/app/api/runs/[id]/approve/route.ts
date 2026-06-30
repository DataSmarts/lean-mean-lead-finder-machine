import type { NextRequest, NextResponse } from "next/server";

import { handleDashboardApproval } from "../approval-route";

// Authenticated by the proxy gate (src/proxy.ts) — /api/* except the Telegram webhook.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return handleDashboardApproval({ action: "approve", params });
}
