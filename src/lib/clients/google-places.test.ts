import { describe, expect, it, vi } from "vitest";

import { createPlacesClient } from "./google-places";
import type { HttpClient } from "./http";

function fakeHttp(body: unknown): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue(body);
  return { http: { request }, request };
}

const center = { lat: 29.76, lng: -95.37 };

describe("createPlacesClient.searchText", () => {
  it("parses places and nextPageToken, mapping displayName.text to name", async () => {
    const { http } = fakeHttp({
      places: [
        {
          id: "places/abc",
          displayName: { text: "Acme Law" },
          websiteUri: "https://acme.example",
          types: ["lawyer"],
        },
      ],
      nextPageToken: "tok-2",
    });
    const client = createPlacesClient({ http, apiKey: "test-key" });

    const result = await client.searchText({ textQuery: "family law Houston", center });

    expect(result.nextPageToken).toBe("tok-2");
    expect(result.places[0]).toMatchObject({
      id: "places/abc",
      name: "Acme Law",
      websiteUri: "https://acme.example",
      types: ["lawyer"],
    });
  });

  it("sends pageSize 20, a 50000m location-bias circle, and the textQuery", async () => {
    const { http, request } = fakeHttp({ places: [] });
    const client = createPlacesClient({ http, apiKey: "test-key" });

    await client.searchText({ textQuery: "dentists Austin", center });

    const init = request.mock.calls[0][1] as RequestInit;
    const sent = JSON.parse(init.body as string);
    expect(sent.pageSize).toBe(20);
    expect(sent.textQuery).toBe("dentists Austin");
    expect(sent.locationBias.circle.radius).toBe(50000);
    expect(sent.locationBias.circle.center).toEqual({ latitude: 29.76, longitude: -95.37 });
    expect(sent.pageToken).toBeUndefined();
  });

  it("sends the API key and a field mask that includes nextPageToken", async () => {
    const { http, request } = fakeHttp({ places: [] });
    const client = createPlacesClient({ http, apiKey: "test-key" });

    await client.searchText({ textQuery: "q", center });

    const init = request.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("test-key");
    expect(headers["X-Goog-FieldMask"]).toContain("nextPageToken");
    expect(headers["X-Goog-FieldMask"]).toContain("places.id");
    expect(headers["X-Goog-FieldMask"]).toContain("places.displayName");
  });

  it("includes pageToken when provided", async () => {
    const { http, request } = fakeHttp({ places: [] });
    const client = createPlacesClient({ http, apiKey: "test-key" });

    await client.searchText({ textQuery: "q", center, pageToken: "tok-2" });

    const init = request.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string).pageToken).toBe("tok-2");
  });

  it("tolerates a place missing optional fields", async () => {
    const { http } = fakeHttp({ places: [{ id: "places/x", displayName: { text: "X" } }] });
    const client = createPlacesClient({ http, apiKey: "test-key" });

    const result = await client.searchText({ textQuery: "q", center });

    expect(result.places[0]).toMatchObject({ id: "places/x", name: "X", types: [] });
    expect(result.places[0].websiteUri).toBeUndefined();
    expect(result.nextPageToken).toBeUndefined();
  });
});
