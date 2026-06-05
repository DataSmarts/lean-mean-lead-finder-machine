import { and, asc, count, desc, eq, getTableColumns, gte, inArray, ne } from "drizzle-orm";

import { wrapDbError } from "@/lib/errors/db-error";

import type { Business } from "./businesses.repo";
import type { AppDatabase } from "./client";
import type { businessEnrichStatus, sourceStatus } from "./schema";
import { businesses, runBusinesses } from "./schema";
import { withUpdatedAt } from "./timestamp";

export type RunBusiness = typeof runBusinesses.$inferSelect;

export type EnrichStatusValue = (typeof businessEnrichStatus.enumValues)[number];
export type SourceStatusValue = (typeof sourceStatus.enumValues)[number];

export interface StatusUpdate {
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
    // Idempotent link: if the pair already exists, do nothing (Discover dedupe). `created` reports
    // whether a new row was inserted, so callers can count newly-found businesses per run.
    async link(
      runId: string,
      businessId: string,
    ): Promise<{ runBusiness: RunBusiness; created: boolean }> {
      try {
        const [row] = await db
          .insert(runBusinesses)
          .values(withUpdatedAt({ runId, businessId }))
          .onConflictDoNothing()
          .returning();
        if (!row) {
          const existing = await db
            .select()
            .from(runBusinesses)
            .where(and(eq(runBusinesses.runId, runId), eq(runBusinesses.businessId, businessId)));
          if (!existing[0]) throw new Error("Link row not found after conflict");
          return { runBusiness: existing[0], created: false };
        }
        return { runBusiness: row, created: true };
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

    // Joins run_businesses to businesses, ordered by business name for stable display.
    // Uses explicit column selection to produce a clean { runBusiness, business } shape.
    async findByRunWithBusiness(
      runId: string,
    ): Promise<{ runBusiness: RunBusiness; business: Business }[]> {
      try {
        const rows = await db
          .select({
            runBusiness: getTableColumns(runBusinesses),
            business: getTableColumns(businesses),
          })
          .from(runBusinesses)
          .innerJoin(businesses, eq(runBusinesses.businessId, businesses.id))
          .where(eq(runBusinesses.runId, runId))
          .orderBy(asc(businesses.name));
        return rows;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to list run-businesses with business", { runId });
      }
    },

    async findById(id: string): Promise<RunBusiness | undefined> {
      try {
        const rows = await db.select().from(runBusinesses).where(eq(runBusinesses.id, id));
        return rows[0];
      } catch (cause) {
        throw wrapDbError(cause, "Failed to find run-business", { id });
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

    // Returns the most recent enriched/partial run_business for a business within the reuse window,
    // excluding the current run (for the 30-day re-run reuse check — §7.4).
    async findReusable(
      businessId: string,
      since: Date,
      excludeRunId: string,
    ): Promise<RunBusiness | undefined> {
      try {
        const rows = await db
          .select()
          .from(runBusinesses)
          .where(
            and(
              eq(runBusinesses.businessId, businessId),
              inArray(runBusinesses.enrichStatus, ["enriched", "partial"]),
              gte(runBusinesses.enrichedAt, since),
              ne(runBusinesses.runId, excludeRunId),
            ),
          )
          .orderBy(desc(runBusinesses.enrichedAt))
          .limit(1);
        return rows[0];
      } catch (cause) {
        throw wrapDbError(cause, "Failed to find reusable run-business", { businessId });
      }
    },

    // Groups run_businesses by enrich_status for finalize counter reconciliation.
    async countByRun(runId: string): Promise<Partial<Record<EnrichStatusValue, number>>> {
      try {
        const rows = await db
          .select({ enrichStatus: runBusinesses.enrichStatus, count: count() })
          .from(runBusinesses)
          .where(eq(runBusinesses.runId, runId))
          .groupBy(runBusinesses.enrichStatus);
        return Object.fromEntries(rows.map((r) => [r.enrichStatus, r.count]));
      } catch (cause) {
        throw wrapDbError(cause, "Failed to count run-businesses by status", { runId });
      }
    },
  };
}
