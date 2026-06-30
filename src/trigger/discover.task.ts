import { task, wait } from "@trigger.dev/sdk";

import { createGeocodingClient } from "@/lib/clients/google-geocoding";
import { createPlacesClient } from "@/lib/clients/google-places";
import { createHttpClient } from "@/lib/clients/http";
import { getDbDirect } from "@/lib/db/client";
import { makeDiscoveryPagesRepo } from "@/lib/db/discovery-pages.repo";
import { createPersistDiscoveryPage } from "@/lib/db/discovery-write";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import { env } from "@/lib/env";
import { captureTriggerFailure } from "@/lib/observability/trigger";
import { createDiscoverService } from "@/lib/services/discover";

export const discoverTask = task({
  id: "discover.run",
  retry: { maxAttempts: 3 },
  onFailure: ({ payload, error }) =>
    captureTriggerFailure({
      taskId: "discover.run",
      payload,
      error,
      runId: payload.runId,
    }),
  run: async (payload: { runId: string }) => {
    const db = getDbDirect();
    const http = createHttpClient();
    const geocodingClient = createGeocodingClient({ http, apiKey: env.GOOGLE_MAPS_API_KEY });
    const placesClient = createPlacesClient({ http, apiKey: env.GOOGLE_MAPS_API_KEY });
    const service = createDiscoverService({
      geocodingClient,
      placesClient,
      runsRepo: makeRunsRepo(db),
      discoveryPagesRepo: makeDiscoveryPagesRepo(db),
      persistPage: createPersistDiscoveryPage(db),
      wait: (seconds) => wait.for({ seconds }),
    });
    return service.discover(payload.runId);
  },
});
