"use client";

import { useActionState, useState } from "react";

import { createRun } from "@/app/actions/runs";
import { COUNTRIES } from "@/lib/runs/countries";
import { createRunSchema } from "@/lib/validation/runs";

import styles from "./new-run-form.module.css";

interface FieldErrors {
  niche?: string;
  city?: string;
  presetName?: string;
}

export function NewRunForm() {
  const [state, formAction, pending] = useActionState(createRun, {});
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const rawMaxResults = fd.get("maxResults");
    const input = {
      niche: (fd.get("niche") as string) || undefined,
      // Empty string → undefined so optional min(1) field passes validation.
      neighborhood: (fd.get("neighborhood") as string) || undefined,
      city: (fd.get("city") as string) || undefined,
      country: (fd.get("country") as string) || undefined,
      maxResults: rawMaxResults ? Number(rawMaxResults) : undefined,
    };

    const result = createRunSchema.safeParse(input);
    if (!result.success) {
      e.preventDefault();
      const flat = result.error.flatten().fieldErrors;
      setFieldErrors({
        niche: flat.niche?.[0],
        city: flat.city?.[0],
      });
      return;
    }

    if (saveAsPreset && !(fd.get("presetName") as string)) {
      e.preventDefault();
      setFieldErrors({ presetName: "Preset name is required." });
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
          defaultValue={120}
          min={1}
        />
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
