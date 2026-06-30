import Link from "next/link";

import type { BadgeTone } from "@/lib/domain/enums";
import { EMAIL_VERIFICATION_BADGE_TONE } from "@/lib/leads/source-badge";
import type { LeadRowView } from "@/lib/services/leads-read";

import styles from "./leads.module.css";

const BADGE_CLASS: Record<BadgeTone, string> = {
  muted: styles.badgeMuted!,
  active: styles.badgeActive!,
  success: styles.badgeSuccess!,
  danger: styles.badgeDanger!,
};

interface LeadsTableProps {
  readonly hasActiveFilter: boolean;
  readonly rows: readonly LeadRowView[];
  readonly total: number;
}

function badgeClass(tone: BadgeTone): string {
  return `${styles.badge} ${BADGE_CLASS[tone]}`;
}

function formatWebsite(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function LeadsEmptyState({ hasActiveFilter }: Pick<LeadsTableProps, "hasActiveFilter">) {
  return (
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
  );
}

export function LeadsTable({ hasActiveFilter, rows, total }: LeadsTableProps) {
  return (
    <div className={styles.panel}>
      <span className={styles.frame} aria-hidden />

      {total === 0 ? (
        <LeadsEmptyState hasActiveFilter={hasActiveFilter} />
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
            {rows.map((lead) => {
              const verificationTone = EMAIL_VERIFICATION_BADGE_TONE[lead.emailVerification];
              return (
                <tr key={lead.contactId} className={styles.leadRow}>
                  <td className={styles.businessCell}>
                    <span className={styles.businessName}>{lead.businessName}</span>
                    {lead.website ? (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.businessMeta}
                      >
                        {formatWebsite(lead.website)}
                      </a>
                    ) : lead.address ? (
                      <span className={styles.businessMeta}>{lead.address}</span>
                    ) : null}
                  </td>

                  <td className={styles.personCell}>
                    {lead.person && <span className={styles.personName}>{lead.person}</span>}
                    {lead.title && <span className={styles.personTitle}>{lead.title}</span>}
                  </td>

                  <td className={styles.emailCell}>
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className={styles.emailAddress}>
                        {lead.email}
                      </a>
                    )}
                    <div className={styles.emailMeta}>
                      <span className={badgeClass(verificationTone)}>
                        <span className={styles.badgeDot} aria-hidden />
                        {lead.emailVerification.replace(/_/g, " ")}
                      </span>
                      {lead.emailConfidence !== null && (
                        <span className={styles.confidence}>{lead.emailConfidence}%</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <div className={styles.sourceBadges}>
                      {lead.sourceBadges.map((source) => (
                        <span
                          key={source}
                          className={`${styles.sourceBadge} ${
                            source === "ai" ? styles.sourceBadgeAi : styles.sourceBadgeHunter
                          }`}
                        >
                          {source === "ai" ? "AI" : "Hunter"}
                        </span>
                      ))}
                    </div>
                  </td>

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

                  <td>
                    <span className={styles.niche}>{lead.niche}</span>
                  </td>

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
  );
}
