import { eq } from "drizzle-orm";

import { wrapDbError } from "@/lib/errors/db-error";

import type { AppDatabase } from "./client";
import { presets } from "./schema";
import { withUpdatedAt } from "./timestamp";

export type Preset = typeof presets.$inferSelect;

export type NewPreset = Omit<typeof presets.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type PresetUpdate = Partial<NewPreset>;

export function makePresetsRepo(db: AppDatabase) {
  return {
    async findAll(): Promise<Preset[]> {
      try {
        return await db.select().from(presets);
      } catch (cause) {
        throw wrapDbError(cause, "Failed to list presets");
      }
    },

    async findById(id: string): Promise<Preset | undefined> {
      try {
        const rows = await db.select().from(presets).where(eq(presets.id, id));
        return rows[0];
      } catch (cause) {
        throw wrapDbError(cause, "Failed to find preset", { id });
      }
    },

    async create(data: NewPreset): Promise<Preset> {
      try {
        const [row] = await db.insert(presets).values(withUpdatedAt(data)).returning();
        if (!row) throw new Error("Insert returned no row");
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to create preset", { name: data.name });
      }
    },

    async update(id: string, data: PresetUpdate): Promise<Preset | undefined> {
      try {
        const [row] = await db
          .update(presets)
          .set(withUpdatedAt(data))
          .where(eq(presets.id, id))
          .returning();
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to update preset", { id });
      }
    },

    async delete(id: string): Promise<void> {
      try {
        await db.delete(presets).where(eq(presets.id, id));
      } catch (cause) {
        throw wrapDbError(cause, "Failed to delete preset", { id });
      }
    },

    // Idempotent upsert by name — used by db:seed and the preset-management UI.
    async upsertByName(data: NewPreset): Promise<Preset> {
      try {
        const [row] = await db
          .insert(presets)
          .values(withUpdatedAt(data))
          .onConflictDoUpdate({
            target: presets.name,
            set: withUpdatedAt({
              neighborhood: data.neighborhood,
              city: data.city,
              country: data.country,
              niche: data.niche,
              maxResults: data.maxResults,
              isActive: data.isActive,
              cron: data.cron,
            }),
          })
          .returning();
        if (!row) throw new Error("Upsert returned no row");
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to upsert preset", { name: data.name });
      }
    },
  };
}
