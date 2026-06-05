"use client";

import { useState } from "react";

import styles from "./approval-controls.module.css";

interface Props {
  runId: string;
  onDecided: () => void;
}

export function ApprovalControls({ runId, onDecided }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDecision(action: "approve" | "reject") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/${action}`, { method: "POST" });
      if (res.status === 200 || res.status === 409) {
        // 409 = already decided elsewhere (Telegram) — the run state changed; refetch.
        onDecided();
      } else if (res.status === 404) {
        setError("Run not found or no longer pending approval.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.container}>
      <p className={styles.label}>Approval Required</p>
      <p className={styles.description}>
        Review the discovered businesses before enrichment begins.
      </p>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.approveBtn}
          disabled={pending}
          onClick={() => handleDecision("approve")}
        >
          {pending ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          className={styles.rejectBtn}
          disabled={pending}
          onClick={() => handleDecision("reject")}
        >
          {pending ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
