// Authenticated by the proxy gate (src/proxy.ts). No per-route auth code required.
export const dynamic = "force-dynamic";

import { db } from "@/lib/db/client";
import { mergedToCsv } from "@/lib/services/export";
import type { LeadsExportService } from "@/lib/services/leads-export";
import { makeLeadsExportService } from "@/lib/services/leads-export";
import { leadsListQuerySchema } from "@/lib/validation/leads";

export type { LeadsExportService };

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const filter = leadsListQuerySchema.parse(sp);
  // page is not meaningful for an unbounded export — drop it from the filter.
  const { page: _page, ...exportFilter } = filter;

  const service = makeLeadsExportService(db);
  const rows = await service.exportMerged(exportFilter);
  const csv = mergedToCsv(rows);

  const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
