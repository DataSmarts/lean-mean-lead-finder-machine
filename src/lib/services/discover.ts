import type { GeocodingClient } from "@/lib/clients/google-geocoding";
import type { PlaceResult, PlacesClient } from "@/lib/clients/google-places";
import type { NewBusiness } from "@/lib/db/businesses.repo";
import type { DiscoveryPage } from "@/lib/db/discovery-pages.repo";
import type { PersistDiscoveryPage } from "@/lib/db/discovery-write";
import type { Run } from "@/lib/db/runs.repo";
import { AppError } from "@/lib/errors/app-error";

const WAIT_SECONDS_BETWEEN_PAGES = 2;

// Narrow ports (ISP): Discover only reads runs and lists discovery pages directly; all writes go
// through the injected transactional `persistPage` (see @/lib/db/discovery-write).
export interface DiscoverRunsRepo {
  findById(id: string): Promise<Run | undefined>;
  setGeocode(id: string, lat: number, lng: number): Promise<Run | undefined>;
}

export interface DiscoverDiscoveryPagesRepo {
  findByRun(runId: string): Promise<DiscoveryPage[]>;
}

export interface DiscoverServiceDeps {
  readonly geocodingClient: GeocodingClient;
  readonly placesClient: PlacesClient;
  readonly runsRepo: DiscoverRunsRepo;
  readonly discoveryPagesRepo: DiscoverDiscoveryPagesRepo;
  readonly persistPage: PersistDiscoveryPage;
  readonly wait: (seconds: number) => Promise<void>;
}

export interface DiscoverService {
  discover(runId: string): Promise<{ businessesFound: number }>;
}

function extractDomain(uri: string | null | undefined): string | null {
  if (!uri || !URL.canParse(uri)) return null;
  return new URL(uri).hostname;
}

// Pure mapping from a Places result to a business insert row. `runId` seeds first/last-seen refs.
export function toNewBusiness(place: PlaceResult, runId: string): NewBusiness {
  return {
    googlePlaceId: place.id,
    name: place.name,
    websiteUri: place.websiteUri ?? null,
    websiteDomain: extractDomain(place.websiteUri),
    formattedAddress: place.formattedAddress ?? null,
    nationalPhone: place.nationalPhoneNumber ?? null,
    internationalPhone: place.internationalPhoneNumber ?? null,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    priceLevel: place.priceLevel ?? null,
    types: place.types,
    firstSeenRunId: runId,
    lastSeenRunId: runId,
  };
}

export function createDiscoverService(deps: DiscoverServiceDeps): DiscoverService {
  const { geocodingClient, placesClient, runsRepo, discoveryPagesRepo, persistPage, wait } = deps;

  async function ensureGeocode(run: Run): Promise<{ lat: number; lng: number }> {
    if (run.geocodeLat !== null && run.geocodeLng !== null) {
      return { lat: run.geocodeLat, lng: run.geocodeLng };
    }
    const address = [run.neighborhood, run.city, run.country].filter(Boolean).join(", ");
    const location = await geocodingClient.geocode(address);
    await runsRepo.setGeocode(run.id, location.lat, location.lng);
    return location;
  }

  return {
    async discover(runId: string): Promise<{ businessesFound: number }> {
      const run = await runsRepo.findById(runId);
      if (!run) {
        throw new AppError("Run not found for discovery", {
          code: "RUN_NOT_FOUND",
          context: { runId },
        });
      }

      const center = await ensureGeocode(run);
      const textQuery = [run.niche, run.neighborhood, run.city, run.country]
        .filter(Boolean)
        .join(" ");

      // Resume: continue from the page after the highest persisted one, using its stored cursor.
      const pages = await discoveryPagesRepo.findByRun(runId);
      let pageIndex = 0;
      let requestToken: string | null = null;
      if (pages.length > 0) {
        const highest = pages.reduce((a, b) => (b.pageIndex > a.pageIndex ? b : a));
        if (highest.pageToken === null) {
          return { businessesFound: run.businessesFound };
        }
        pageIndex = highest.pageIndex + 1;
        requestToken = highest.pageToken;
        await wait(WAIT_SECONDS_BETWEEN_PAGES);
      }

      let businessesFound = run.businessesFound;

      while (businessesFound < run.maxResults) {
        const { places, nextPageToken } = await placesClient.searchText({
          textQuery,
          center,
          pageToken: requestToken ?? undefined,
        });

        const remaining = run.maxResults - businessesFound;
        const reachedLimit = places.length > remaining;
        const trimmed = reachedLimit ? places.slice(0, remaining) : places;

        const { created } = await persistPage({
          runId,
          pageIndex,
          pageToken: nextPageToken ?? null,
          businesses: trimmed.map((place) => toNewBusiness(place, runId)),
        });
        businessesFound += created;

        if (reachedLimit || !nextPageToken) break;

        await wait(WAIT_SECONDS_BETWEEN_PAGES);
        pageIndex += 1;
        requestToken = nextPageToken;
      }

      return { businessesFound };
    },
  };
}
