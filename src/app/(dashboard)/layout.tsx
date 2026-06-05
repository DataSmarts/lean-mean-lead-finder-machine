import Link from "next/link";

import { logout } from "@/app/actions/auth";

import styles from "./layout.module.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <h1 className={styles.wordmark}>Lead Finder</h1>
          <p className={styles.tagline}>Operator Console</p>
        </div>

        <nav className={styles.nav}>
          <Link href="/runs" className={styles.navLink}>
            <span className={styles.navDot} aria-hidden />
            Runs
          </Link>
          <Link href="/runs/new" className={styles.navLink}>
            <span className={styles.navDot} aria-hidden />
            New Run
          </Link>
        </nav>

        <div className={styles.sidebarFooter}>
          <form action={logout}>
            <button type="submit" className={styles.logoutBtn}>
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
