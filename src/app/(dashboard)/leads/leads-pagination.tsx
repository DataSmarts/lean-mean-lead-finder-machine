import Link from "next/link";

import type { LeadsListQuery } from "@/lib/validation/leads";

import styles from "./leads.module.css";
import { buildLeadsHref } from "./leads-query";

interface LeadsPaginationProps {
  readonly query: LeadsListQuery;
  readonly total: number;
  readonly totalPages: number;
}

export function LeadsPagination({ query, total, totalPages }: LeadsPaginationProps) {
  if (total === 0) return null;

  const isFirstPage = query.page <= 1;
  const isLastPage = query.page >= totalPages;

  return (
    <div className={styles.pagination} aria-label="Pagination">
      <span className={styles.pageInfo}>
        Page {query.page} of {totalPages} — {total} lead{total !== 1 ? "s" : ""}
      </span>
      <div className={styles.pageButtons}>
        <Link
          href={buildLeadsHref(query, query.page - 1)}
          className={`${styles.pageBtn} ${isFirstPage ? styles.pageBtnDisabled : ""}`}
          aria-disabled={isFirstPage}
          tabIndex={isFirstPage ? -1 : undefined}
        >
          Prev
        </Link>
        <Link
          href={buildLeadsHref(query, query.page + 1)}
          className={`${styles.pageBtn} ${isLastPage ? styles.pageBtnDisabled : ""}`}
          aria-disabled={isLastPage}
          tabIndex={isLastPage ? -1 : undefined}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
