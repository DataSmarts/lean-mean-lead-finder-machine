import { describe, expect, it, vi } from "vitest";

import { GeocodeNotFoundError, GoogleRateLimitError } from "@/lib/errors/google-error";
import { HttpError } from "@/lib/errors/http-error";

import { createGeocodingClient } from "./google-geocoding";
import type { HttpClient } from "./http";

function fakeHttp(body: unknown): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue(body);
  return { http: { request }, request };
}

describe("createGeocodingClient.geocode", () => {
  it("returns lat/lng for an OK response", async () => {
    const { http } = fakeHttp({
      status: "OK",
      results: [{ geometry: { location: { lat: 29.76, lng: -95.37 } } }],
    });
    const client = createGeocodingClient({ http, apiKey: "test-key" });

    expect(await client.geocode("Houston, TX, USA")).toEqual({ lat: 29.76, lng: -95.37 });
  });

  it("requests the geocode endpoint with an encoded address and key", async () => {
    const { http, request } = fakeHttp({
      status: "OK",
      results: [{ geometry: { location: { lat: 1, lng: 2 } } }],
    });
    const client = createGeocodingClient({ http, apiKey: "test-key" });

    await client.geocode("Houston, TX");

    const url = request.mock.calls[0][0] as string;
    expect(url).toContain("maps.googleapis.com/maps/api/geocode/json");
    expect(url).toContain("address=Houston%2C%20TX");
    expect(url).toContain("key=test-key");
  });

  it("maps ZERO_RESULTS to GeocodeNotFoundError", async () => {
    const { http } = fakeHttp({ status: "ZERO_RESULTS", results: [] });
    const client = createGeocodingClient({ http, apiKey: "test-key" });

    await expect(client.geocode("nowhere")).rejects.toBeInstanceOf(GeocodeNotFoundError);
  });

  it("maps OVER_QUERY_LIMIT to GoogleRateLimitError", async () => {
    const { http } = fakeHttp({ status: "OVER_QUERY_LIMIT", results: [] });
    const client = createGeocodingClient({ http, apiKey: "test-key" });

    await expect(client.geocode("anywhere")).rejects.toBeInstanceOf(GoogleRateLimitError);
  });

  it("maps an unexpected status to HttpError", async () => {
    const { http } = fakeHttp({ status: "REQUEST_DENIED", results: [] });
    const client = createGeocodingClient({ http, apiKey: "test-key" });

    await expect(client.geocode("anywhere")).rejects.toBeInstanceOf(HttpError);
  });

  it("treats OK with no results as not found", async () => {
    const { http } = fakeHttp({ status: "OK", results: [] });
    const client = createGeocodingClient({ http, apiKey: "test-key" });

    await expect(client.geocode("anywhere")).rejects.toBeInstanceOf(GeocodeNotFoundError);
  });

  it("wraps invalid provider payloads in HttpError", async () => {
    const { http } = fakeHttp({ status: "OK", results: [{ geometry: {} }] });
    const client = createGeocodingClient({ http, apiKey: "test-key" });

    await expect(client.geocode("anywhere")).rejects.toBeInstanceOf(HttpError);
  });
});
