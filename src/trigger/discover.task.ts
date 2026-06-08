import { task, wait } from "@trigger.dev/sdk";

import { createGeocodingClient } from "@/lib/clients/google-geocoding";
import { createPlacesClient } from "@/lib/clients/google-places";
import { createHttpClient } from "@/lib/clients/http";
import { dbDirect } from "@/lib/db/client";
import { makeDiscoveryPagesRepo } from "@/lib/db/discovery-pages.repo";
import { createPersistDiscoveryPage } from "@/lib/db/discovery-write";
import { makeRunsRepo } from "@/lib/db/runs.repo";
import { env } from "@/lib/env";
import { createDiscoverService } from "@/lib/services/discover";

const persistPage = createPersistDiscoveryPage(dbDirect);

export const discoverTask = task({
  id: "discover.run",
  retry: { maxAttempts: 3 },
  run: async (payload: { runId: string }) => {
    const http = createHttpClient();
    const geocodingClient = createGeocodingClient({ http, apiKey: env.GOOGLE_MAPS_API_KEY });
    const placesClient = createPlacesClient({ http, apiKey: env.GOOGLE_MAPS_API_KEY });
    const service = createDiscoverService({
      geocodingClient,
      placesClient,
      runsRepo: makeRunsRepo(dbDirect),
      discoveryPagesRepo: makeDiscoveryPagesRepo(dbDirect),
      persistPage,
      wait: (seconds) => wait.for({ seconds }),
    });
    return service.discover(payload.runId);
  },
});
