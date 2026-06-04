import type { Metadata } from "next";

import styles from "./login.module.css";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Lead Finder",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className={styles.screen}>
      <div className={styles.grid} aria-hidden />
      <section className={styles.card}>
        <span className={styles.frame} aria-hidden />
        <p className={styles.kicker}>Lead Finder // Console</p>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Authorized operator access only.</p>
        <LoginForm next={next} />
        <p className={styles.footer}>Single-admin session · HMAC-signed cookie</p>
      </section>
    </main>
  );
}
