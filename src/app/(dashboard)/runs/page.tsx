import Link from "next/link";

import { db } from "@/lib/db/client";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import type { RunStatusValue } from "@/lib/runs/status";
import { RUN_STATUS_BADGE_TONE } from "@/lib/runs/status";
import { runsListQuerySchema } from "@/lib/validation/runs";

import styles from "./runs.module.css";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { label: string; value: RunStatusValue | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Queued", value: "queued" },
  { label: "Discovering", value: "discovering" },
  { label: "Awaiting Approval", value: "awaiting_approval" },
  { label: "Enriching", value: "enriching" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Rejected", value: "rejected" },
  { label: "Canceled", value: "canceled" },
];

const BADGE_CLASS: Record<string, string> = {
  muted: styles.badgeMuted!,
  active: styles.badgeActive!,
  success: styles.badgeSuccess!,
  danger: styles.badgeDanger!,
};

function badgeClass(tone: string): string {
  return `${styles.badge} ${BADGE_CLASS[tone] ?? styles.badgeMuted}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildHref(status: RunStatusValue | undefined, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/runs${qs ? `?${qs}` : ""}`;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RunsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const query = runsListQuerySchema.parse({
    status: typeof sp["status"] === "string" ? sp["status"] : undefined,
    page: typeof sp["page"] === "string" ? sp["page"] : undefined,
  });

  const PAGE_SIZE = 20;
  const result = await makeRunsRepo(db).list({
    page: query.page,
    pageSize: PAGE_SIZE,
    status: query.status,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />

      <header className={styles.header}>
        <p className={styles.kicker}>Pipeline // Runs</p>
        <h1 className={styles.title}>Runs</h1>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map(({ label, value }) => {
            const isActive = query.status === value;
            return (
              <Link
                key={label}
                href={buildHref(value, 1)}
                className={`${styles.filterBtn} ${isActive ? styles.filterBtnActive : ""}`}
                aria-current={isActive ? "true" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <Link href="/runs/new" className={styles.newRunLink}>
          New Run
        </Link>
      </div>

      <div className={styles.panel}>
        <span className={styles.frame} aria-hidden />

        {result.total === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No runs yet</p>
            <p className={styles.emptyNote}>
              Start your first pipeline run to discover and enrich leads.
            </p>
            <Link href="/runs/new" className={styles.emptyAction}>
              New Run
            </Link>
          </div>
        ) : (
          <table className={styles.table} aria-label="Runs">
            <thead className={styles.thead}>
              <tr>
                <th>Niche</th>
                <th>Location</th>
                <th>Source</th>
                <th>Status</th>
                <th>Businesses</th>
                <th>Contacts</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody className={styles.tbody}>
              {result.runs.map((run) => {
                const tone = RUN_STATUS_BADGE_TONE[run.status as RunStatusValue];
                const location = [run.neighborhood, run.city, run.country]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <tr key={run.id} onClick={() => {}} aria-label={run.niche}>
                    <td>
                      <Link href={`/runs/${run.id}`} className={styles.rowLink}>
                        <span className={styles.niche}>{run.niche}</span>
                      </Link>
                    </td>
                    <td>
                      <span className={styles.location}>{location}</span>
                    </td>
                    <td>
                      <span className={styles.source}>{run.triggerSource}</span>
                    </td>
                    <td>
                      <span className={badgeClass(tone)}>
                        <span className={styles.badgeDot} aria-hidden />
                        {run.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <span className={styles.counters}>
                        <strong>{run.businessesFound}</strong> found /{" "}
                        <strong>{run.businessesEnriched}</strong> enriched /{" "}
                        <strong>{run.businessesFailed}</strong> failed
                      </span>
                    </td>
                    <td>
                      <span className={styles.counters}>
                        <strong>{run.contactsFound}</strong>
                      </span>
                    </td>
                    <td>
                      <span className={styles.timestamp}>
                        {formatDate(run.createdAt.toISOString())}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {result.total > 0 && (
        <div className={styles.pagination} aria-label="Pagination">
          <span className={styles.pageInfo}>
            Page {query.page} of {totalPages} — {result.total} run
            {result.total !== 1 ? "s" : ""}
          </span>
          <div className={styles.pageButtons}>
            <Link
              href={buildHref(query.status, query.page - 1)}
              className={`${styles.pageBtn} ${query.page <= 1 ? styles.pageBtnDisabled : ""}`}
              aria-disabled={query.page <= 1}
              tabIndex={query.page <= 1 ? -1 : undefined}
            >
              Prev
            </Link>
            <Link
              href={buildHref(query.status, query.page + 1)}
              className={`${styles.pageBtn} ${query.page >= totalPages ? styles.pageBtnDisabled : ""}`}
              aria-disabled={query.page >= totalPages}
              tabIndex={query.page >= totalPages ? -1 : undefined}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
