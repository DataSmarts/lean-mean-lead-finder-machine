import { eq, sql } from "drizzle-orm";

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
      extra: Partial<Pick<Run, "startedAt" | "finishedAt" | "error" | "triggerRunId">> = {},
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
  };
}
