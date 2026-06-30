import styles from "./leads.module.css";

interface LeadsToolbarProps {
  readonly exportHref: string;
  readonly total: number;
}

function formatLeadCount(total: number): string {
  return total === 0 ? "No leads" : `${total} lead${total !== 1 ? "s" : ""}`;
}

export function LeadsToolbar({ exportHref, total }: LeadsToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <p className={styles.totalCount}>{formatLeadCount(total)}</p>
      <a href={exportHref} className={styles.exportLink}>
        Export CSV
      </a>
    </div>
  );
}
