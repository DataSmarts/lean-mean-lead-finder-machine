"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deletePreset, runPresetNow, togglePresetActive } from "@/app/actions/presets";

import styles from "./presets.module.css";

interface Props {
  presetId: string;
  presetName: string;
  isActive: boolean;
}

export function PresetRowActions({ presetId, presetName, isActive }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<"toggle" | "run" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setPending("toggle");
    setError(null);
    const result = await togglePresetActive(presetId);
    setPending(null);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleRunNow() {
    setPending("run");
    setError(null);
    // runPresetNow redirects on success — the promise may not resolve normally.
    const result = await runPresetNow(presetId);
    setPending(null);
    if (result?.error) setError(result.error);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete preset "${presetName}"? This cannot be undone.`)) return;
    setPending("delete");
    setError(null);
    const result = await deletePreset(presetId);
    setPending(null);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  const busy = pending !== null;

  return (
    <div>
      <div className={styles.rowActions}>
        <button type="button" className={styles.actionBtn} disabled={busy} onClick={handleToggle}>
          {pending === "toggle" ? "…" : isActive ? "Deactivate" : "Activate"}
        </button>
        <button type="button" className={styles.runNowBtn} disabled={busy} onClick={handleRunNow}>
          {pending === "run" ? "Starting…" : "Run Now"}
        </button>
        <button type="button" className={styles.deleteBtn} disabled={busy} onClick={handleDelete}>
          {pending === "delete" ? "Deleting…" : "Delete"}
        </button>
      </div>
      {error ? <span className={styles.rowError}>{error}</span> : null}
    </div>
  );
}
