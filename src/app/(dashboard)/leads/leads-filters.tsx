import Link from "next/link";

import type { LeadsListQuery } from "@/lib/validation/leads";

import styles from "./leads.module.css";

interface RunOption {
  readonly id: string;
  readonly label: string;
}

interface LeadsFiltersProps {
  readonly query: LeadsListQuery;
  readonly runOptions: readonly RunOption[];
}

export function LeadsFilters({ query, runOptions }: LeadsFiltersProps) {
  return (
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
  );
}
