import { logout } from "@/app/actions/auth";

import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.screen}>
      <div className={styles.grid} aria-hidden />
      <section className={styles.panel}>
        <span className={styles.frame} aria-hidden />
        <p className={styles.kicker}>Lead Finder // Console</p>
        <h1 className={styles.wordmark}>Lead Finder</h1>
        <p className={styles.status}>
          <span className={styles.dot} aria-hidden /> Signed in as <strong>admin</strong>
        </p>
        <p className={styles.note}>Pipeline console coming online — Discover · Enrich · Verify.</p>
        <form action={logout}>
          <button className={styles.logout} type="submit">
            Log out
          </button>
        </form>
      </section>
    </main>
  );
}
