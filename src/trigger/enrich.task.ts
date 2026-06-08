import { task } from "@trigger.dev/sdk";

import { createHttpClient } from "@/lib/clients/http";
import { createHunterClient } from "@/lib/clients/hunter";
import { createOpenRouterClient } from "@/lib/clients/openrouter";
import { makeBusinessesRepo } from "@/lib/db/businesses.repo";
import { dbDirect } from "@/lib/db/client";
import { createEnrichWriter } from "@/lib/db/enrich-write";
import { makeRunBusinessesRepo } from "@/lib/db/run-businesses.repo";
import { env } from "@/lib/env";
import { createAiEnrichService } from "@/lib/services/ai-enrich";
import { createEnrichService } from "@/lib/services/enrich";
import { createHunterEnrichService } from "@/lib/services/hunter-enrich";

// Number of enrich.business tasks per batchTriggerAndWait call.
// Controls fan-out concurrency and provider request volume.
export const ENRICH_BATCH_SIZE = 25;

const { persist, persistReuse } = createEnrichWriter(dbDirect);

// Chunks an array into sub-arrays of at most `size` elements. Pure helper.
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// Per-business enrichment task — thin wrapper around EnrichService.
// Retry-safe: all writes are upserts on natural keys; counter bumps are guarded.
export const enrichBusinessTask = task({
  id: "enrich.business",
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 30_000 },
  run: async (payload: { runBusinessId: string }) => {
    const http = createHttpClient();
    const hunterClient = createHunterClient({ http, apiKey: env.HUNTER_API_KEY, limit: env.HUNTER_LIMIT });
    const openRouterClient = createOpenRouterClient({ http, apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL });
    const service = createEnrichService({
      runBusinessesRepo: makeRunBusinessesRepo(dbDirect),
      businessesRepo: makeBusinessesRepo(dbDirect),
      aiEnrichService: createAiEnrichService({ openRouterClient }),
      hunterEnrichService: createHunterEnrichService({ hunterClient }),
      persist,
      persistReuse,
    });
    return service.enrichBusiness(payload.runBusinessId);
  },
});

// Fan-out task: batches run_businesses into groups and awaits each batch.
// Processes sequentially (no Promise.all over batches) to apply natural backpressure.
export const enrichFanOutTask = task({
  id: "enrich.fanOut",
  run: async (payload: { runId: string }) => {
    const runBusinessesRepo = makeRunBusinessesRepo(dbDirect);
    const all = await runBusinessesRepo.findByRun(payload.runId);
    const queued = all.filter((rb) => rb.enrichStatus === "queued");

    const batches = chunk(queued, ENRICH_BATCH_SIZE);
    let enriched = 0;
    let failed = 0;

    for (const batch of batches) {
      const result = await enrichBusinessTask.batchTriggerAndWait(
        batch.map((rb) => ({ payload: { runBusinessId: rb.id } })),
      );
      for (const run of result.runs) {
        if (run.ok) {
          enriched += 1;
        } else {
          failed += 1;
        }
      }
    }

    return { total: queued.length, enriched, failed };
  },
});
