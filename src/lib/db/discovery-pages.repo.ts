import { eq } from "drizzle-orm";

import { wrapDbError } from "@/lib/errors/db-error";

import type { AppDatabase } from "./client";
import { discoveryPages } from "./schema";

export type DiscoveryPage = typeof discoveryPages.$inferSelect;

export type NewDiscoveryPage = Omit<typeof discoveryPages.$inferInsert, "id" | "fetchedAt">;

export function makeDiscoveryPagesRepo(db: AppDatabase) {
  return {
    // Idempotent record: if (run_id, page_index) already exists, do nothing (Discover resume).
    // discovery_pages has no updated_at — rows are immutable after insert (§6.2 spec).
    async recordPage(data: NewDiscoveryPage): Promise<DiscoveryPage | undefined> {
      try {
        const [row] = await db
          .insert(discoveryPages)
          .values(data)
          .onConflictDoNothing()
          .returning();
        return row; // undefined means the page was already recorded (idempotent)
      } catch (cause) {
        throw wrapDbError(cause, "Failed to record discovery page", {
          runId: data.runId,
          pageIndex: data.pageIndex,
        });
      }
    },

    async findByRun(runId: string): Promise<DiscoveryPage[]> {
      try {
        return await db.select().from(discoveryPages).where(eq(discoveryPages.runId, runId));
      } catch (cause) {
        throw wrapDbError(cause, "Failed to list discovery pages", { runId });
      }
    },
  };
}
