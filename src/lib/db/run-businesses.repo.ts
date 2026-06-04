import { and, eq } from "drizzle-orm";

import { wrapDbError } from "@/lib/errors/db-error";

import type { AppDatabase } from "./client";
import type { businessEnrichStatus, sourceStatus } from "./schema";
import { runBusinesses } from "./schema";
import { withUpdatedAt } from "./timestamp";

export type RunBusiness = typeof runBusinesses.$inferSelect;

type EnrichStatusValue = (typeof businessEnrichStatus.enumValues)[number];
type SourceStatusValue = (typeof sourceStatus.enumValues)[number];

interface StatusUpdate {
  enrichStatus?: EnrichStatusValue;
  aiStatus?: SourceStatusValue;
  hunterStatus?: SourceStatusValue;
  aiError?: string | null;
  hunterError?: string | null;
  attempts?: number;
  enrichedAt?: Date | null;
}

export function makeRunBusinessesRepo(db: AppDatabase) {
  return {
    // Idempotent link: if the pair already exists, do nothing (Discover dedupe).
    async link(runId: string, businessId: string): Promise<RunBusiness> {
      try {
        const [row] = await db
          .insert(runBusinesses)
          .values(withUpdatedAt({ runId, businessId }))
          .onConflictDoNothing()
          .returning();
        if (!row) {
          // Row existed; fetch and return it
          const existing = await db
            .select()
            .from(runBusinesses)
            .where(and(eq(runBusinesses.runId, runId), eq(runBusinesses.businessId, businessId)));
          if (!existing[0]) throw new Error("Link row not found after conflict");
          return existing[0];
        }
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to link run-business", { runId, businessId });
      }
    },

    async findByRun(runId: string): Promise<RunBusiness[]> {
      try {
        return await db.select().from(runBusinesses).where(eq(runBusinesses.runId, runId));
      } catch (cause) {
        throw wrapDbError(cause, "Failed to list run-businesses", { runId });
      }
    },

    async updateStatus(id: string, update: StatusUpdate): Promise<RunBusiness | undefined> {
      try {
        const [row] = await db
          .update(runBusinesses)
          .set(withUpdatedAt(update))
          .where(eq(runBusinesses.id, id))
          .returning();
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to update run-business status", { id });
      }
    },
  };
}
