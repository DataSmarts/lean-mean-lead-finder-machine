import { and, eq, isNull, sql } from "drizzle-orm";

import { wrapDbError } from "@/lib/errors/db-error";

import type { AppDatabase } from "./client";
import type { runStatus } from "./schema";
import { runs } from "./schema";
import { withUpdatedAt } from "./timestamp";

export type Run = typeof runs.$inferSelect;

export type NewRun = Omit<typeof runs.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type RunStatusValue = (typeof runStatus.enumValues)[number];

type CounterField = "businessesFound" | "businessesEnriched" | "businessesFailed" | "contactsFound";

export function makeRunsRepo(db: AppDatabase) {
  return {
    async create(data: NewRun): Promise<Run> {
      try {
        const [row] = await db.insert(runs).values(withUpdatedAt(data)).returning();
        if (!row) throw new Error("Insert returned no row");
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to create run");
      }
    },

    async findById(id: string): Promise<Run | undefined> {
      try {
        const rows = await db.select().from(runs).where(eq(runs.id, id));
        return rows[0];
      } catch (cause) {
        throw wrapDbError(cause, "Failed to find run", { id });
      }
    },

    async updateStatus(
      id: string,
      status: RunStatusValue,
      extra: Partial<
        Pick<Run, "startedAt" | "finishedAt" | "error" | "triggerRunId" | "approvalWaitpointId">
      > = {},
    ): Promise<Run | undefined> {
      try {
        const [row] = await db
          .update(runs)
          .set(withUpdatedAt({ status, ...extra }))
          .where(eq(runs.id, id))
          .returning();
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to update run status", { id });
      }
    },

    // Caches the geocoded coordinates on the run so Discover skips re-geocoding on resume.
    async setGeocode(id: string, lat: number, lng: number): Promise<Run | undefined> {
      try {
        const [row] = await db
          .update(runs)
          .set(withUpdatedAt({ geocodeLat: lat, geocodeLng: lng }))
          .where(eq(runs.id, id))
          .returning();
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to set run geocode", { id });
      }
    },

    // Atomically increments a counter column and stamps updated_at.
    async incrementCounter(id: string, field: CounterField, amount = 1): Promise<Run | undefined> {
      const col = runs[field];
      try {
        const [row] = await db
          .update(runs)
          .set(withUpdatedAt({ [field]: sql`${col} + ${amount}` }))
          .where(eq(runs.id, id))
          .returning();
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to increment run counter", { id, field });
      }
    },

    async findByApprovalToken(token: string): Promise<Run | undefined> {
      try {
        const rows = await db.select().from(runs).where(eq(runs.approvalToken, token));
        return rows[0];
      } catch (cause) {
        throw wrapDbError(cause, "Failed to find run by approval token");
      }
    },

    // Atomic claim: sets approved_at + approved_by only if status=awaiting_approval and no decision
    // has been recorded yet. Returns undefined if the claim was already taken (idempotent).
    async recordApproval(id: string, by: string): Promise<Run | undefined> {
      try {
        const [row] = await db
          .update(runs)
          .set(withUpdatedAt({ approvedAt: new Date(), approvedBy: by }))
          .where(
            and(
              eq(runs.id, id),
              eq(runs.status, "awaiting_approval"),
              isNull(runs.approvedAt),
              isNull(runs.rejectedAt),
            ),
          )
          .returning();
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to record run approval", { id });
      }
    },

    // Atomic claim: sets rejected_at only if status=awaiting_approval and no decision recorded yet.
    // Returns undefined if the claim was already taken (idempotent).
    async recordRejection(id: string): Promise<Run | undefined> {
      try {
        const [row] = await db
          .update(runs)
          .set(withUpdatedAt({ rejectedAt: new Date() }))
          .where(
            and(
              eq(runs.id, id),
              eq(runs.status, "awaiting_approval"),
              isNull(runs.approvedAt),
              isNull(runs.rejectedAt),
            ),
          )
          .returning();
        return row;
      } catch (cause) {
        throw wrapDbError(cause, "Failed to record run rejection", { id });
      }
    },

    // Rollback: clears a decision claim when the downstream waitpoint completion fails.
    async clearApprovalDecision(id: string): Promise<void> {
      try {
        await db
          .update(runs)
          .set(withUpdatedAt({ approvedAt: null, approvedBy: null, rejectedAt: null }))
          .where(eq(runs.id, id));
      } catch (cause) {
        throw wrapDbError(cause, "Failed to clear run approval decision", { id });
      }
    },
  };
}
