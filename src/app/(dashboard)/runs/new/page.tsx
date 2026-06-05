import styles from "./new-run.module.css";
import { NewRunForm } from "./new-run-form";

export default function NewRunPage() {
  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.grid} aria-hidden />

      <header className={styles.header}>
        <p className={styles.kicker}>Pipeline // New Run</p>
        <h1 className={styles.title}>New Run</h1>
      </header>

      <div className={styles.card}>
        <span className={styles.frame} aria-hidden />
        <NewRunForm />
      </div>
    </div>
  );
}
