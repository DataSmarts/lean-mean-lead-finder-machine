export const dynamic = "force-dynamic";

import Link from "next/link";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/config/defaults";
import { db } from "@/lib/db/client";
import { EMAIL_VERIFICATION_BADGE_TONE } from "@/lib/leads/source-badge";
import { makeLeadsReadService } from "@/lib/services/leads-read";
import type { LeadsListQuery } from "@/lib/validation/leads";
import { leadsListQuerySchema } from "@/lib/validation/leads";

import styles from "./leads.module.css";

const BADGE_CLASS: Record<string, string> = {
  muted: styles.badgeMuted!,
  active: styles.badgeActive!,
  success: styles.badgeSuccess!,
  danger: styles.badgeDanger!,
};

function badgeClass(tone: string): string {
  return `${styles.badge} ${BADGE_CLASS[tone] ?? styles.badgeMuted!}`;
}

function buildHref(query: LeadsListQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.runId) params.set("runId", query.runId);
  if (query.niche) params.set("niche", query.niche);
  if (query.city) params.set("city", query.city);
  if (query.source) params.set("source", query.source);
  if (query.verification) params.set("verification", query.verification);
  if (query.q) params.set("q", query.q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/leads${qs ? `?${qs}` : ""}`;
}

function buildExportHref(query: LeadsListQuery): string {
  const params = new URLSearchParams();
  if (query.runId) params.set("runId", query.runId);
  if (query.niche) params.set("niche", query.niche);
  if (query.city) params.set("city", query.city);
  if (query.source) params.set("source", query.source);
  if (query.verification) params.set("verification", query.verification);
  if (query.q) params.set("q", query.q);
  const qs = params.toString();
  return `/api/leads/export${qs ? `?${qs}` : ""}`;
}

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

  const service = makeLeadsReadService(db);
  const [result, runOptions] = await Promise.all([
    service.list({ ...query, pageSize: DEFAULT_LIST_PAGE_SIZE }),
    service.runOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / DEFAULT_LIST_PAGE_SIZE));
  const exportHref = buildExportHref(query);
  const hasActiveFilter =
    query.q ?? query.niche ?? query.city ?? query.source ?? query.verification ?? query.runId;

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />

      <header className={styles.header}>
        <p className={styles.kicker}>Pipeline // Leads</p>
        <h1 className={styles.title}>Leads</h1>
      </header>

      {/* Filter bar — GET form: submitting navigates to /leads?… */}
      <form method="GET" action="/leads" className={styles.filterForm}>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label htmlFor="filter-run" className={styles.filterLabel}>
              Run
            </label>
            <select
              id="filter-run"
              name="runId"
              className={styles.filterSelect}
              defaultValue={query.runId ?? ""}
            >
              <option value="">All runs</option>
              {runOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="filter-q" className={styles.filterLabel}>
              Search
            </label>
            <input
              id="filter-q"
              name="q"
              type="search"
              placeholder="Name, email, business…"
              className={styles.filterInput}
              defaultValue={query.q ?? ""}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="filter-source" className={styles.filterLabel}>
              Source
            </label>
            <select
              id="filter-source"
              name="source"
              className={styles.filterSelect}
              defaultValue={query.source ?? ""}
            >
              <option value="">All sources</option>
              <option value="ai">AI</option>
              <option value="hunter">Hunter</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="filter-verification" className={styles.filterLabel}>
              Verification
            </label>
            <select
              id="filter-verification"
              name="verification"
              className={styles.filterSelect}
              defaultValue={query.verification ?? ""}
            >
              <option value="">All</option>
              <option value="valid">Valid</option>
              <option value="invalid">Invalid</option>
              <option value="accept_all">Accept All</option>
              <option value="webmail">Webmail</option>
              <option value="disposable">Disposable</option>
              <option value="unknown">Unknown</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="filter-niche" className={styles.filterLabel}>
              Niche
            </label>
            <input
              id="filter-niche"
              name="niche"
              type="text"
              placeholder="e.g. dentist"
              className={styles.filterInput}
              defaultValue={query.niche ?? ""}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="filter-city" className={styles.filterLabel}>
              City
            </label>
            <input
              id="filter-city"
              name="city"
              type="text"
              placeholder="e.g. Houston"
              className={styles.filterInput}
              defaultValue={query.city ?? ""}
            />
          </div>

          <div className={styles.filterActions}>
            <button type="submit" className={styles.filterSubmit}>
              Filter
            </button>
            <Link href="/leads" className={styles.filterClear}>
              Clear
            </Link>
          </div>
        </div>
      </form>

      {/* Toolbar: count + export */}
      <div className={styles.toolbar}>
        <p className={styles.totalCount}>
          {result.total === 0 ? "No leads" : `${result.total} lead${result.total !== 1 ? "s" : ""}`}
        </p>
        <a href={exportHref} className={styles.exportLink}>
          Export CSV
        </a>
      </div>

      {/* Data panel */}
      <div className={styles.panel}>
        <span className={styles.frame} aria-hidden />

        {result.total === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No leads found</p>
            <p className={styles.emptyNote}>
              {hasActiveFilter
                ? "Try adjusting or clearing the filters."
                : "Run the pipeline and enrich a batch to see contacts here."}
            </p>
            {!hasActiveFilter && (
              <Link href="/runs/new" className={styles.emptyAction}>
                New Run
              </Link>
            )}
          </div>
        ) : (
          <table className={styles.table} aria-label="Leads">
            <thead className={styles.thead}>
              <tr>
                <th>Business</th>
                <th>Person</th>
                <th>Email</th>
                <th>Source</th>
                <th>Socials</th>
                <th>Niche</th>
                <th>City</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((lead) => {
                const verTone = EMAIL_VERIFICATION_BADGE_TONE[lead.emailVerification];
                return (
                  <tr key={lead.contactId} className={styles.leadRow}>
                    {/* Business */}
                    <td className={styles.businessCell}>
                      <span className={styles.businessName}>{lead.businessName}</span>
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.businessMeta}
                        >
                          {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      ) : lead.address ? (
                        <span className={styles.businessMeta}>{lead.address}</span>
                      ) : null}
                    </td>

                    {/* Person */}
                    <td className={styles.personCell}>
                      {lead.person && <span className={styles.personName}>{lead.person}</span>}
                      {lead.title && <span className={styles.personTitle}>{lead.title}</span>}
                    </td>

                    {/* Email */}
                    <td className={styles.emailCell}>
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className={styles.emailAddress}>
                          {lead.email}
                        </a>
                      )}
                      <div className={styles.emailMeta}>
                        <span className={badgeClass(verTone)}>
                          <span className={styles.badgeDot} aria-hidden />
                          {lead.emailVerification.replace(/_/g, " ")}
                        </span>
                        {lead.emailConfidence !== null && (
                          <span className={styles.confidence}>{lead.emailConfidence}%</span>
                        )}
                      </div>
                    </td>

                    {/* Source badges */}
                    <td>
                      <div className={styles.sourceBadges}>
                        {lead.sourceBadges.map((src) => (
                          <span
                            key={src}
                            className={`${styles.sourceBadge} ${
                              src === "ai" ? styles.sourceBadgeAi : styles.sourceBadgeHunter
                            }`}
                          >
                            {src === "ai" ? "AI" : "Hunter"}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Socials */}
                    <td>
                      <div className={styles.socials}>
                        {lead.linkedinUrl && (
                          <a
                            href={lead.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.socialLink}
                            aria-label="LinkedIn"
                          >
                            LI
                          </a>
                        )}
                        {lead.instagramUrl && (
                          <a
                            href={lead.instagramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.socialLink}
                            aria-label="Instagram"
                          >
                            IG
                          </a>
                        )}
                        {lead.twitterUrl && (
                          <a
                            href={lead.twitterUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.socialLink}
                            aria-label="Twitter / X"
                          >
                            TW
                          </a>
                        )}
                        {lead.facebookUrl && (
                          <a
                            href={lead.facebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.socialLink}
                            aria-label="Facebook"
                          >
                            FB
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Niche */}
                    <td>
                      <span className={styles.niche}>{lead.niche}</span>
                    </td>

                    {/* City */}
                    <td>
                      <span className={styles.location}>{lead.city}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {result.total > 0 && (
        <div className={styles.pagination} aria-label="Pagination">
          <span className={styles.pageInfo}>
            Page {query.page} of {totalPages} — {result.total} lead
            {result.total !== 1 ? "s" : ""}
          </span>
          <div className={styles.pageButtons}>
            <Link
              href={buildHref(query, query.page - 1)}
              className={`${styles.pageBtn} ${query.page <= 1 ? styles.pageBtnDisabled : ""}`}
              aria-disabled={query.page <= 1}
              tabIndex={query.page <= 1 ? -1 : undefined}
            >
              Prev
            </Link>
            <Link
              href={buildHref(query, query.page + 1)}
              className={`${styles.pageBtn} ${
                query.page >= totalPages ? styles.pageBtnDisabled : ""
              }`}
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
