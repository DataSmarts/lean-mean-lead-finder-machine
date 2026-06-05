// Authenticated by the proxy gate (src/proxy.ts). No per-route auth code required.
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import { mergedToCsv, rawToCsv } from "@/lib/services/export";
import { makeLeadsExportService } from "@/lib/services/leads-export";
import { runExportQuerySchema } from "@/lib/validation/leads";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const run = await makeRunsRepo(db).findById(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const { raw } = runExportQuerySchema.parse(sp);

  const service = makeLeadsExportService(db);

  if (raw) {
    const rows = await service.exportRaw(id);
    const csv = rawToCsv(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="run-${id}-raw.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const rows = await service.exportMerged({ runId: id });
  const csv = mergedToCsv(rows);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="run-${id}-merged.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
