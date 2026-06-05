"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { savePreset } from "@/app/actions/presets";
import type { Preset } from "@/lib/db/presets.repo";
import { COUNTRIES } from "@/lib/runs/countries";

import styles from "./presets.module.css";

type Frequency = "hourly" | "daily" | "weekly" | "custom" | "";

interface Props {
  preset?: Preset;
}

export function PresetForm({ preset }: Props) {
  const [state, formAction, pending] = useActionState(savePreset, {});
  const [isActive, setIsActive] = useState(preset?.isActive ?? false);
  const [frequency, setFrequency] = useState<Frequency>(deriveFrequency(preset?.cron ?? null));

  const isEdit = !!preset;

  return (
    <div className={styles.formPanel}>
      <p className={styles.formPanelTitle}>{isEdit ? "Edit Preset" : "New Preset"}</p>

      <form action={formAction} className={styles.form}>
        {preset && <input type="hidden" name="id" value={preset.id} />}

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="preset-name">
              Name
            </label>
            <input
              id="preset-name"
              name="name"
              type="text"
              className={styles.input}
              defaultValue={preset?.name ?? ""}
              placeholder="Houston family law"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="preset-niche">
              Niche
            </label>
            <input
              id="preset-niche"
              name="niche"
              type="text"
              className={styles.input}
              defaultValue={preset?.niche ?? ""}
              placeholder="family law attorney"
              required
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="preset-city">
              City
            </label>
            <input
              id="preset-city"
              name="city"
              type="text"
              className={styles.input}
              defaultValue={preset?.city ?? ""}
              placeholder="Houston"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="preset-country">
              Country
            </label>
            <select
              id="preset-country"
              name="country"
              className={styles.select}
              defaultValue={preset?.country ?? COUNTRIES[0]?.value}
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="preset-neighborhood">
              Neighborhood <span className={styles.optional}>optional</span>
            </label>
            <input
              id="preset-neighborhood"
              name="neighborhood"
              type="text"
              className={styles.input}
              defaultValue={preset?.neighborhood ?? ""}
              placeholder="Midtown"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="preset-maxResults">
              Max Results
            </label>
            <input
              id="preset-maxResults"
              name="maxResults"
              type="number"
              className={styles.input}
              defaultValue={preset?.maxResults ?? 120}
              min={1}
            />
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="preset-frequency">
              Schedule <span className={styles.optional}>optional</span>
            </label>
            <select
              id="preset-frequency"
              name="frequency"
              className={styles.select}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
            >
              <option value="">None</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily (9 AM UTC)</option>
              <option value="weekly">Weekly (Mon 9 AM UTC)</option>
              <option value="custom">Custom cron…</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} aria-hidden={frequency !== "custom"}>
              &nbsp;
            </label>
            {frequency === "custom" ? (
              <input
                name="customCron"
                type="text"
                className={styles.input}
                defaultValue={preset?.cron ?? ""}
                placeholder="0 9 * * 1-5"
                aria-label="Custom cron expression"
              />
            ) : (
              <div style={{ height: "2.6rem" }} />
            )}
          </div>
        </div>

        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            name="isActive"
            value="true"
            className={styles.checkbox}
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span className={styles.checkboxLabel}>Active — run automatically on schedule</span>
        </label>

        {state.error ? (
          <p className={styles.error} role="alert">
            <span aria-hidden>!</span> {state.error}
          </p>
        ) : null}

        {!state.error && !pending && isEdit ? (
          <p className={styles.success} role="status">
            Preset saved.
          </p>
        ) : null}

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitBtn} disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save Changes" : "Create Preset"}
          </button>
          <Link href="/presets" className={styles.cancelLink}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

// Infer the frequency dropdown value from an existing cron string.
function deriveFrequency(cron: string | null): Frequency {
  if (!cron) return "";
  if (cron === "0 * * * *") return "hourly";
  if (cron === "0 9 * * *") return "daily";
  if (cron === "0 9 * * 1") return "weekly";
  return "custom";
}
