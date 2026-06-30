import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/config/defaults";
import { getDb } from "@/lib/db/client";
import { makeLeadsReadService } from "@/lib/services/leads-read";
import { leadsListQuerySchema } from "@/lib/validation/leads";

import styles from "./leads.module.css";
import { LeadsFilters } from "./leads-filters";
import { LeadsPagination } from "./leads-pagination";
import { buildLeadsExportHref, hasActiveLeadsFilter } from "./leads-query";
import { LeadsTable } from "./leads-table";
import { LeadsToolbar } from "./leads-toolbar";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const query = leadsListQuerySchema.parse({
    runId: typeof sp["runId"] === "string" ? sp["runId"] : undefined,
    niche: typeof sp["niche"] === "string" ? sp["niche"] : undefined,
    city: typeof sp["city"] === "string" ? sp["city"] : undefined,
    source: typeof sp["source"] === "string" ? sp["source"] : undefined,
    verification: typeof sp["verification"] === "string" ? sp["verification"] : undefined,
    q: typeof sp["q"] === "string" ? sp["q"] : undefined,
    page: typeof sp["page"] === "string" ? sp["page"] : undefined,
  });

  const service = makeLeadsReadService(getDb());
  const [result, runOptions] = await Promise.all([
    service.list({ ...query, pageSize: DEFAULT_LIST_PAGE_SIZE }),
    service.runOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / DEFAULT_LIST_PAGE_SIZE));
  const exportHref = buildLeadsExportHref(query);
  const hasActiveFilter = hasActiveLeadsFilter(query);

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />

      <header className={styles.header}>
        <p className={styles.kicker}>Pipeline // Leads</p>
        <h1 className={styles.title}>Leads</h1>
      </header>

      <LeadsFilters query={query} runOptions={runOptions} />
      <LeadsToolbar exportHref={exportHref} total={result.total} />
      <LeadsTable hasActiveFilter={hasActiveFilter} rows={result.rows} total={result.total} />
      <LeadsPagination query={query} total={result.total} totalPages={totalPages} />
    </div>
  );
}
