import Link from "next/link";

import { getDb } from "@/lib/db/client";
import type { Preset } from "@/lib/db/presets.repo";
import { makePresetsReadService } from "@/lib/services/presets-read";

import { PresetForm } from "./preset-form";
import { PresetRowActions } from "./preset-row-actions";
import styles from "./presets.module.css";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatCron(cron: string | null): string {
  if (!cron) return "—";
  const aliases: Record<string, string> = {
    "0 * * * *": "Hourly",
    "0 9 * * *": "Daily 9 AM",
    "0 9 * * 1": "Weekly Mon",
  };
  return aliases[cron] ?? cron;
}

function getEditPreset(presets: Preset[], editId: string | undefined): Preset | undefined {
  if (!editId) return undefined;
  return presets.find((p) => p.id === editId);
}

export default async function PresetsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const mode = typeof sp["new"] === "string" ? "new" : undefined;
  const editId = typeof sp["edit"] === "string" ? sp["edit"] : undefined;

  const allPresets = await makePresetsReadService(getDb()).list();

  const editPreset = getEditPreset(allPresets, editId);
  const showForm = mode === "new" || !!editPreset;

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />

      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.kicker}>Pipeline // Scheduling</p>
          <h1 className={styles.title}>Presets</h1>
        </div>
        {!showForm && (
          <Link href="/presets?new=1" className={styles.newBtn}>
            New Preset
          </Link>
        )}
      </header>

      {showForm && <PresetForm preset={editPreset} />}

      <div className={styles.panel}>
        <span className={styles.frame} aria-hidden />

        {allPresets.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No presets yet</p>
            <p className={styles.emptyNote}>
              Save a run configuration as a preset to schedule it automatically.
            </p>
            <Link href="/presets?new=1" className={styles.emptyAction}>
              New Preset
            </Link>
          </div>
        ) : (
          <table className={styles.table} aria-label="Presets">
            <thead className={styles.thead}>
              <tr>
                <th>Name</th>
                <th>Niche</th>
                <th>Location</th>
                <th>Max</th>
                <th>Status</th>
                <th>Schedule</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className={styles.tbody}>
              {allPresets.map((preset) => {
                const location = [preset.neighborhood, preset.city, preset.country]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <tr key={preset.id}>
                    <td>
                      <span className={styles.presetName}>{preset.name}</span>
                    </td>
                    <td>
                      <span className={styles.niche}>{preset.niche}</span>
                    </td>
                    <td>
                      <span className={styles.location}>{location}</span>
                    </td>
                    <td>
                      <span className={styles.cronText}>{preset.maxResults}</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${preset.isActive ? styles.badgeActive : styles.badgeInactive}`}
                      >
                        <span className={styles.badgeDot} aria-hidden />
                        {preset.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.cronText}>{formatCron(preset.cron)}</span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link href={`/presets?edit=${preset.id}`} className={styles.actionBtn}>
                          Edit
                        </Link>
                        <PresetRowActions
                          presetId={preset.id}
                          presetName={preset.name}
                          isActive={preset.isActive}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
