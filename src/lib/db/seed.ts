import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import type { NewPreset } from "./presets.repo";
import { makePresetsRepo } from "./presets.repo";
import * as schema from "./schema";

// Seed presets — upserted by name so running this twice yields identical rows.
// Add or edit entries here; do NOT run db:seed in production migrations.
const SEED_PRESETS: NewPreset[] = [
  {
    name: "Family Law Attorneys - Houston TX",
    city: "Houston",
    country: "US",
    niche: "family law attorney",
    maxResults: 120,
    isActive: false,
    cron: null,
    neighborhood: null,
  },
  {
    name: "Dentists - New York City",
    city: "New York City",
    country: "US",
    niche: "dentist",
    maxResults: 120,
    isActive: false,
    cron: null,
    neighborhood: null,
  },
];

async function seed() {
  // Own a short-lived direct connection so the process exits cleanly after seeding.
  const client = postgres(env.DATABASE_URL_UNPOOLED, { prepare: false });
  const db = drizzle(client, { schema });
  const repo = makePresetsRepo(db);

  for (const preset of SEED_PRESETS) {
    await repo.upsertByName(preset);
    console.log(`Seeded preset: ${preset.name}`);
  }

  await client.end();
}

seed()
  .then(() => {
    console.log("Seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
