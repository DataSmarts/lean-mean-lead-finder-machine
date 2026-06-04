import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { NewBusiness } from "./businesses.repo";
import { makeBusinessesRepo } from "./businesses.repo";
import { makeDiscoveryPagesRepo } from "./discovery-pages.repo";
import { makeRunBusinessesRepo } from "./run-businesses.repo";
import { makeRunsRepo } from "./runs.repo";
import * as schema from "./schema";

export interface PersistDiscoveryPageArgs {
  readonly runId: string;
  readonly pageIndex: number;
  // Cursor to the following page (this page's nextPageToken); null = no following page.
  readonly pageToken: string | null;
  readonly businesses: NewBusiness[];
}

// One transaction: upsert businesses, link them to the run (per-run dedupe), record the page,
// and bump businesses_found by the number of newly-linked businesses. Returns that count.
// Idempotent on retry: re-applying a persisted page links nothing new, so the counter is unchanged.
export type PersistDiscoveryPage = (args: PersistDiscoveryPageArgs) => Promise<{ created: number }>;

// Transactions only exist on the direct (postgres-js) client; neon-http is single-shot HTTP.
export function createPersistDiscoveryPage(
  db: PostgresJsDatabase<typeof schema>,
): PersistDiscoveryPage {
  return ({ runId, pageIndex, pageToken, businesses }: PersistDiscoveryPageArgs) =>
    db.transaction(async (tx) => {
      const businessesRepo = makeBusinessesRepo(tx);
      const runBusinessesRepo = makeRunBusinessesRepo(tx);
      const discoveryPagesRepo = makeDiscoveryPagesRepo(tx);
      const runsRepo = makeRunsRepo(tx);

      let created = 0;
      for (const business of businesses) {
        const saved = await businessesRepo.upsertByPlaceId(business);
        const { created: isNew } = await runBusinessesRepo.link(runId, saved.id);
        if (isNew) created += 1;
      }

      await discoveryPagesRepo.recordPage({
        runId,
        pageIndex,
        pageToken,
        resultsCount: businesses.length,
      });

      if (created > 0) {
        await runsRepo.incrementCounter(runId, "businessesFound", created);
      }

      return { created };
    });
}
