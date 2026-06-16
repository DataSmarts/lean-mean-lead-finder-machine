// Authenticated by the proxy gate (src/proxy.ts). No per-route auth code required.
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { makeRunExportService } from "@/lib/services/run-export";
import { runExportQuerySchema } from "@/lib/validation/leads";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const { raw } = runExportQuerySchema.parse(sp);

  const result = await makeRunExportService(db).exportRun({ runId: id, raw });
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return new Response(result.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
