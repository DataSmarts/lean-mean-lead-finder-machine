import { z } from "zod";

import { GeocodeNotFoundError, GoogleRateLimitError } from "@/lib/errors/google-error";
import { HttpError } from "@/lib/errors/http-error";

import type { HttpClient } from "./http";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// Geocoding returns HTTP 200 with the real outcome in `status`; map it here, not in http.ts.
const geocodeResponseSchema = z.object({
  status: z.string(),
  results: z
    .array(
      z.object({
        geometry: z.object({ location: z.object({ lat: z.number(), lng: z.number() }) }),
      }),
    )
    .default([]),
});

export interface GeocodeResult {
  readonly lat: number;
  readonly lng: number;
}

export interface GeocodingClientDeps {
  readonly http: HttpClient;
  readonly apiKey: string;
}

export interface GeocodingClient {
  geocode(address: string): Promise<GeocodeResult>;
}

export function createGeocodingClient({ http, apiKey }: GeocodingClientDeps): GeocodingClient {
  return {
    async geocode(address: string): Promise<GeocodeResult> {
      const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${encodeURIComponent(apiKey)}`;
      const body = await http.request<unknown>(url, { method: "GET" }, { context: { address } });
      const parsed = geocodeResponseSchema.parse(body);

      switch (parsed.status) {
        case "OK": {
          const location = parsed.results[0]?.geometry.location;
          if (!location) {
            throw new GeocodeNotFoundError("Geocoding returned OK with no results", {
              context: { address },
            });
          }
          return { lat: location.lat, lng: location.lng };
        }
        case "ZERO_RESULTS":
          throw new GeocodeNotFoundError("Geocoding found no match for the address", {
            context: { address },
          });
        case "OVER_QUERY_LIMIT":
          throw new GoogleRateLimitError("Geocoding rate limit exceeded", { context: { address } });
        default:
          throw new HttpError(`Geocoding failed with status ${parsed.status}`, {
            context: { address, googleStatus: parsed.status },
          });
      }
    },
  };
}
