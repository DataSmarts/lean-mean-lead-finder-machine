"use client";

import { useActionState } from "react";

import { login } from "@/app/actions/auth";

import styles from "./login.module.css";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <form action={formAction} className={styles.form}>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className={styles.field}>
        <span className={styles.label}>Username</span>
        <input
          className={styles.input}
          name="username"
          type="text"
          autoComplete="username"
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          className={styles.input}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      {state.error ? (
        <p className={styles.error} role="alert">
          <span aria-hidden>!</span> {state.error}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Authenticating…" : "Sign in"}
      </button>
    </form>
  );
}
