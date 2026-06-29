"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { BadgeTone } from "@/lib/domain/enums";
import {
  BUSINESS_ENRICH_STATUS_BADGE_TONE,
  isTerminalRunStatus,
  RUN_STATUS_BADGE_TONE,
} from "@/lib/runs/status";
import type { RunDetailView } from "@/lib/services/run-read";

import { ApprovalControls } from "./approval-controls";
import styles from "./run-detail-live.module.css";

interface Props {
  initial: RunDetailView;
  runId: string;
}

const BADGE_CLASS: Record<BadgeTone, string> = {
  muted: styles.badgeMuted!,
  active: styles.badgeActive!,
  success: styles.badgeSuccess!,
  danger: styles.badgeDanger!,
};

function badgeClass(tone: BadgeTone): string {
  return `${styles.badge} ${BADGE_CLASS[tone]}`;
}

export function RunDetailLive({ initial, runId }: Props) {
  const [detail, setDetail] = useState<RunDetailView>(initial);
  const [refetchNonce, setRefetchNonce] = useState(0);

  const { run } = detail;
  const status = run.status;
  const tone = RUN_STATUS_BADGE_TONE[run.status];
  const isActive = tone === "active";

  useEffect(() => {
    // Dep on `refetchNonce` allows ApprovalControls to trigger an immediate refetch.
    if (isTerminalRunStatus(initial.run.status) && refetchNonce === 0) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const tick = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`, { signal: controller.signal });
        if (res.ok) {
          const next = (await res.json()) as RunDetailView;
          if (!cancelled) {
            setDetail(next);
            if (!isTerminalRunStatus(next.run.status)) {
              timer = setTimeout(tick, 3000);
            }
          }
        } else {
          // Non-2xx: back off and retry to handle transient gateway errors.
          if (!cancelled) timer = setTimeout(tick, 3000);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (!cancelled) timer = setTimeout(tick, 3000);
      }
    };

    timer = setTimeout(tick, refetchNonce > 0 ? 0 : 3000);

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [runId, refetchNonce]); // eslint-disable-line react-hooks/exhaustive-deps -- initial.run.status is the seed; live status drives continuation inside tick

  const location = [run.neighborhood, run.city, run.country].filter(Boolean).join(", ");
  const pct =
    run.businessesFound > 0 ? Math.round((run.businessesEnriched / run.businessesFound) * 100) : 0;

  return (
    <div>
      <Link href="/runs" className={styles.back}>
        &#8592; All runs
      </Link>

      <header className={styles.header}>
        <p className={styles.kicker}>Pipeline // Run Detail</p>
        <h1 className={styles.title}>{run.niche}</h1>
        <div className={styles.metaRow}>
          <span className={badgeClass(tone)}>
            <span
              className={`${styles.badgeDot} ${isActive ? styles.badgeDotPulse : ""}`}
              aria-hidden
            />
            {status.replace(/_/g, " ")}
          </span>
          <span className={styles.meta}>{location}</span>
          <span className={styles.meta}>{run.triggerSource}</span>
        </div>
      </header>

      {status === "awaiting_approval" && (
        <ApprovalControls runId={runId} onDecided={() => setRefetchNonce((n) => n + 1)} />
      )}

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Progress</p>
        <div className={styles.counters}>
          <div className={styles.chip}>
            <span className={styles.chipValue}>{run.businessesFound}</span>
            <span className={styles.chipLabel}>Found</span>
          </div>
          <div className={styles.chip}>
            <span className={styles.chipValue}>{run.businessesEnriched}</span>
            <span className={styles.chipLabel}>Enriched</span>
          </div>
          <div className={styles.chip}>
            <span className={styles.chipValue}>{run.businessesFailed}</span>
            <span className={styles.chipLabel}>Failed</span>
          </div>
          <div className={styles.chip}>
            <span className={styles.chipValue}>{run.contactsFound}</span>
            <span className={styles.chipLabel}>Contacts</span>
          </div>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Businesses</p>
        <div className={styles.panel}>
          <span className={styles.frame} aria-hidden />
          {detail.businesses.length === 0 ? (
            <p className={styles.emptyState}>No businesses discovered yet.</p>
          ) : (
            <table className={styles.table} aria-label="Businesses">
              <thead className={styles.thead}>
                <tr>
                  <th>Business</th>
                  <th>Website</th>
                  <th>Status</th>
                  <th>Contacts</th>
                </tr>
              </thead>
              <tbody className={styles.tbody}>
                {detail.businesses.map(({ runBusiness, business, contacts }) => {
                  const rbTone = BUSINESS_ENRICH_STATUS_BADGE_TONE[runBusiness.enrichStatus];
                  return (
                    <tr key={runBusiness.id}>
                      <td>
                        <span className={styles.bizName}>{business.name}</span>
                        {business.formattedAddress && (
                          <span className={styles.bizAddr}>{business.formattedAddress}</span>
                        )}
                      </td>
                      <td>
                        {business.websiteUri ? (
                          <a
                            href={business.websiteUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.bizLink}
                          >
                            {business.websiteDomain ?? business.websiteUri}
                          </a>
                        ) : (
                          <span style={{ color: "var(--ink-dim)", fontSize: "0.7rem" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={badgeClass(rbTone)}>
                          <span className={styles.badgeDot} aria-hidden />
                          {runBusiness.enrichStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        {contacts.length === 0 ? (
                          <span style={{ color: "var(--ink-dim)", fontSize: "0.7rem" }}>—</span>
                        ) : (
                          <ul className={styles.contactList}>
                            {contacts.map((c) => (
                              <li key={c.id} className={styles.contact}>
                                {c.fullName && (
                                  <span className={styles.contactName}>{c.fullName}</span>
                                )}
                                {c.title && (
                                  <span className={styles.contactTitle}> · {c.title}</span>
                                )}
                                {c.email && (
                                  <span className={styles.contactEmail}> · {c.email}</span>
                                )}
                                {c.linkedinUrl && (
                                  <a
                                    href={c.linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.contactLinkedIn}
                                    aria-label={`${c.fullName ?? "Contact"} on LinkedIn`}
                                  >
                                    [li]
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
