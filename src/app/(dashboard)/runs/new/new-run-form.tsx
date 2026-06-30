"use client";

import { useActionState, useState } from "react";

import { createRun } from "@/app/actions/runs";
import { DEFAULT_MAX_RESULTS } from "@/lib/config/defaults";
import { COUNTRIES } from "@/lib/runs/countries";
import { parseCreateRunFormData } from "@/lib/validation/runs";

import styles from "./new-run-form.module.css";

interface FieldErrors {
  niche?: string;
  city?: string;
  maxResults?: string;
  presetName?: string;
}

export function NewRunForm() {
  const [state, formAction, pending] = useActionState(createRun, {});
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const result = parseCreateRunFormData(fd);
    if (!result.success) {
      e.preventDefault();
      const flat = result.error.flatten().fieldErrors;
      setFieldErrors({
        niche: flat.niche?.[0],
        city: flat.city?.[0],
        maxResults: flat.maxResults?.[0],
        presetName: flat.presetName?.[0],
      });
      return;
    }

    setFieldErrors({});
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="niche">
          Niche
        </label>
        <input
          id="niche"
          name="niche"
          type="text"
          className={styles.input}
          placeholder="family law attorney"
          required
        />
        {fieldErrors.niche ? <p className={styles.fieldError}>{fieldErrors.niche}</p> : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="city">
          City
        </label>
        <input
          id="city"
          name="city"
          type="text"
          className={styles.input}
          placeholder="Houston"
          required
        />
        {fieldErrors.city ? <p className={styles.fieldError}>{fieldErrors.city}</p> : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="neighborhood">
          Neighborhood <span className={styles.optional}>optional</span>
        </label>
        <input
          id="neighborhood"
          name="neighborhood"
          type="text"
          className={styles.input}
          placeholder="Midtown"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="country">
          Country
        </label>
        <select
          id="country"
          name="country"
          className={styles.select}
          defaultValue={COUNTRIES[0]?.value}
        >
          {COUNTRIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="maxResults">
          Max Results
        </label>
        <input
          id="maxResults"
          name="maxResults"
          type="number"
          className={styles.input}
          defaultValue={DEFAULT_MAX_RESULTS}
          min={1}
        />
        {fieldErrors.maxResults ? (
          <p className={styles.fieldError}>{fieldErrors.maxResults}</p>
        ) : null}
      </div>

      <div className={styles.divider} />

      <label className={styles.checkboxField}>
        <input
          type="checkbox"
          name="saveAsPreset"
          value="true"
          className={styles.checkbox}
          checked={saveAsPreset}
          onChange={(e) => setSaveAsPreset(e.target.checked)}
        />
        <span className={styles.checkboxLabel}>Save as preset</span>
      </label>

      {saveAsPreset ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="presetName">
            Preset Name
          </label>
          <input
            id="presetName"
            name="presetName"
            type="text"
            className={styles.input}
            placeholder="Houston family law"
          />
          {fieldErrors.presetName ? (
            <p className={styles.fieldError}>{fieldErrors.presetName}</p>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p className={styles.error} role="alert">
          <span aria-hidden>!</span> {state.error}
        </p>
      ) : null}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Launching…" : "Launch Run"}
      </button>
    </form>
  );
}
