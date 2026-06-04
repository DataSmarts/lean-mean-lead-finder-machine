import { z } from "zod";

import type { HttpClient } from "./http";

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PAGE_SIZE = 20;
const LOCATION_BIAS_RADIUS_M = 50_000;

// Exactly the fields persisted to `businesses`, plus nextPageToken (required in the mask to
// receive pagination). Derived from the schema since the legacy n8n workflow is not committed.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.websiteUri",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.types",
  "nextPageToken",
].join(",");

const placeSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }).optional(),
  websiteUri: z.string().optional(),
  formattedAddress: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  internationalPhoneNumber: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  priceLevel: z.string().optional(),
  types: z.array(z.string()).optional(),
});

const searchResponseSchema = z.object({
  places: z.array(placeSchema).default([]),
  nextPageToken: z.string().optional(),
});

export interface PlaceResult {
  readonly id: string;
  readonly name: string;
  readonly websiteUri?: string;
  readonly formattedAddress?: string;
  readonly nationalPhoneNumber?: string;
  readonly internationalPhoneNumber?: string;
  readonly rating?: number;
  readonly userRatingCount?: number;
  readonly priceLevel?: string;
  readonly types: string[];
}

export interface SearchTextParams {
  readonly textQuery: string;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly pageToken?: string;
}

export interface SearchTextResult {
  readonly places: PlaceResult[];
  readonly nextPageToken?: string;
}

export interface PlacesClientDeps {
  readonly http: HttpClient;
  readonly apiKey: string;
}

export interface PlacesClient {
  searchText(params: SearchTextParams): Promise<SearchTextResult>;
}

export function createPlacesClient({ http, apiKey }: PlacesClientDeps): PlacesClient {
  return {
    async searchText({
      textQuery,
      center,
      pageToken,
    }: SearchTextParams): Promise<SearchTextResult> {
      const requestBody = {
        textQuery,
        pageSize: PAGE_SIZE,
        locationBias: {
          circle: {
            center: { latitude: center.lat, longitude: center.lng },
            radius: LOCATION_BIAS_RADIUS_M,
          },
        },
        ...(pageToken ? { pageToken } : {}),
      };

      const response = await http.request<unknown>(
        PLACES_SEARCH_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify(requestBody),
        },
        { context: { textQuery } },
      );

      const parsed = searchResponseSchema.parse(response);
      return {
        places: parsed.places.map((place) => ({
          id: place.id,
          name: place.displayName?.text ?? "",
          websiteUri: place.websiteUri,
          formattedAddress: place.formattedAddress,
          nationalPhoneNumber: place.nationalPhoneNumber,
          internationalPhoneNumber: place.internationalPhoneNumber,
          rating: place.rating,
          userRatingCount: place.userRatingCount,
          priceLevel: place.priceLevel,
          types: place.types ?? [],
        })),
        nextPageToken: parsed.nextPageToken,
      };
    },
  };
}
