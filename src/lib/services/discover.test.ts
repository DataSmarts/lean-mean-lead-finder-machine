import { describe, expect, it, vi } from "vitest";

import type { PlaceResult } from "@/lib/clients/google-places";
import type { DiscoveryPage } from "@/lib/db/discovery-pages.repo";
import type { PersistDiscoveryPageArgs } from "@/lib/db/discovery-write";
import type { Run } from "@/lib/db/runs.repo";
import { GeocodeNotFoundError } from "@/lib/errors/google-error";

import { createDiscoverService, toNewBusiness } from "./discover";

function baseRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    presetId: null,
    triggerSource: "api",
    status: "discovering",
    neighborhood: null,
    city: "Houston",
    country: "USA",
    niche: "lawyers",
    maxResults: 120,
    geocodeLat: null,
    geocodeLng: null,
    businessesFound: 0,
    businessesEnriched: 0,
    businessesFailed: 0,
    contactsFound: 0,
    approvalToken: "tok",
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    triggerRunId: null,
    approvalWaitpointId: null,
    approvalMessageId: null,
    error: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

function place(id: string): PlaceResult {
  return { id, name: `Biz ${id}`, types: [] };
}

function discoveryPage(pageIndex: number, pageToken: string | null): DiscoveryPage {
  return {
    id: `p${pageIndex}`,
    runId: "run-1",
    pageIndex,
    pageToken,
    resultsCount: 0,
    fetchedAt: new Date(0),
  };
}

function setup() {
  const geocode = vi.fn().mockResolvedValue({ lat: 29.7, lng: -95.3 });
  const searchText = vi.fn();
  const findById = vi.fn();
  const setGeocode = vi.fn().mockResolvedValue(undefined);
  const findByRun = vi.fn().mockResolvedValue([]);
  const persistPage = vi.fn(async (args: PersistDiscoveryPageArgs) => ({
    created: args.businesses.length,
  }));
  const wait = vi.fn().mockResolvedValue(undefined);

  const service = createDiscoverService({
    geocodingClient: { geocode },
    placesClient: { searchText },
    runsRepo: { findById, setGeocode },
    discoveryPagesRepo: { findByRun },
    persistPage,
    wait,
  });

  return { service, geocode, searchText, findById, setGeocode, findByRun, persistPage, wait };
}

describe("createDiscoverService.discover", () => {
  it("geocodes once and caches the coordinates when they are missing", async () => {
    const ctx = setup();
    ctx.findById.mockResolvedValue(baseRun());
    ctx.searchText.mockResolvedValue({
      places: [place("a"), place("b")],
      nextPageToken: undefined,
    });

    const result = await ctx.service.discover("run-1");

    expect(ctx.geocode).toHaveBeenCalledWith("Houston, USA");
    expect(ctx.setGeocode).toHaveBeenCalledWith("run-1", 29.7, -95.3);
    expect(ctx.searchText.mock.calls[0][0].center).toEqual({ lat: 29.7, lng: -95.3 });
    expect(result.businessesFound).toBe(2);
  });

  it("skips geocoding when the run already has coordinates (resume)", async () => {
    const ctx = setup();
    ctx.findById.mockResolvedValue(baseRun({ geocodeLat: 1, geocodeLng: 2 }));
    ctx.searchText.mockResolvedValue({ places: [place("a")], nextPageToken: undefined });

    await ctx.service.discover("run-1");

    expect(ctx.geocode).not.toHaveBeenCalled();
    expect(ctx.setGeocode).not.toHaveBeenCalled();
    expect(ctx.searchText.mock.calls[0][0].center).toEqual({ lat: 1, lng: 2 });
  });

  it("propagates GeocodeNotFoundError and never searches", async () => {
    const ctx = setup();
    ctx.findById.mockResolvedValue(baseRun());
    ctx.geocode.mockRejectedValue(new GeocodeNotFoundError("no match"));

    await expect(ctx.service.discover("run-1")).rejects.toBeInstanceOf(GeocodeNotFoundError);
    expect(ctx.searchText).not.toHaveBeenCalled();
  });

  it("paginates across pages, waiting 2s between them", async () => {
    const ctx = setup();
    ctx.findById.mockResolvedValue(baseRun({ geocodeLat: 1, geocodeLng: 2 }));
    ctx.searchText
      .mockResolvedValueOnce({ places: [place("a"), place("b")], nextPageToken: "t1" })
      .mockResolvedValueOnce({ places: [place("c")], nextPageToken: undefined });

    const result = await ctx.service.discover("run-1");

    expect(ctx.searchText).toHaveBeenCalledTimes(2);
    expect(ctx.searchText.mock.calls[0][0].pageToken).toBeUndefined();
    expect(ctx.searchText.mock.calls[1][0].pageToken).toBe("t1");
    expect(ctx.wait).toHaveBeenCalledTimes(1);
    expect(ctx.wait).toHaveBeenCalledWith(2);
    expect(ctx.persistPage.mock.calls[0][0]).toMatchObject({ pageIndex: 0, pageToken: "t1" });
    expect(ctx.persistPage.mock.calls[1][0]).toMatchObject({ pageIndex: 1, pageToken: null });
    expect(result.businessesFound).toBe(3);
  });

  it("stops at maxResults and trims the final page so businessesFound <= maxResults", async () => {
    const ctx = setup();
    ctx.findById.mockResolvedValue(baseRun({ geocodeLat: 1, geocodeLng: 2, maxResults: 3 }));
    ctx.searchText
      .mockResolvedValueOnce({ places: [place("a"), place("b")], nextPageToken: "t1" })
      .mockResolvedValueOnce({
        places: [place("c"), place("d"), place("e"), place("f"), place("g")],
        nextPageToken: "t2",
      });

    const result = await ctx.service.discover("run-1");

    expect(ctx.searchText).toHaveBeenCalledTimes(2);
    expect(ctx.persistPage.mock.calls[1][0].businesses).toHaveLength(1); // trimmed 5 → 1
    expect(result.businessesFound).toBe(3);
    expect(result.businessesFound).toBeLessThanOrEqual(3);
  });

  it("stops when there is no nextPageToken", async () => {
    const ctx = setup();
    ctx.findById.mockResolvedValue(baseRun({ geocodeLat: 1, geocodeLng: 2 }));
    ctx.searchText.mockResolvedValue({ places: [place("a")], nextPageToken: undefined });

    await ctx.service.discover("run-1");

    expect(ctx.searchText).toHaveBeenCalledTimes(1);
    expect(ctx.wait).not.toHaveBeenCalled();
  });

  it("waits before resuming from a persisted nextPageToken", async () => {
    const ctx = setup();
    ctx.findById.mockResolvedValue(baseRun({ geocodeLat: 1, geocodeLng: 2, businessesFound: 40 }));
    ctx.findByRun.mockResolvedValue([discoveryPage(0, "t1"), discoveryPage(1, "t2")]);
    ctx.searchText.mockResolvedValue({
      places: [place("x"), place("y"), place("z")],
      nextPageToken: undefined,
    });

    const result = await ctx.service.discover("run-1");

    expect(ctx.searchText).toHaveBeenCalledTimes(1);
    expect(ctx.wait).toHaveBeenCalledWith(2);
    expect(ctx.searchText.mock.calls[0][0].pageToken).toBe("t2");
    expect(ctx.persistPage).toHaveBeenCalledTimes(1);
    expect(ctx.persistPage.mock.calls[0][0].pageIndex).toBe(2);
    expect(result.businessesFound).toBe(43);
  });

  it("completes without searching when the highest persisted page had no successor", async () => {
    const ctx = setup();
    ctx.findById.mockResolvedValue(baseRun({ geocodeLat: 1, geocodeLng: 2, businessesFound: 5 }));
    ctx.findByRun.mockResolvedValue([discoveryPage(0, null)]);

    const result = await ctx.service.discover("run-1");

    expect(ctx.searchText).not.toHaveBeenCalled();
    expect(result.businessesFound).toBe(5);
  });
});

describe("toNewBusiness", () => {
  it("maps a place and derives the website domain", () => {
    const row = toNewBusiness(
      {
        id: "places/abc",
        name: "Acme Law",
        websiteUri: "https://www.acme.example/contact",
        types: ["lawyer"],
      },
      "run-1",
    );

    expect(row).toMatchObject({
      googlePlaceId: "places/abc",
      name: "Acme Law",
      websiteUri: "https://www.acme.example/contact",
      websiteDomain: "www.acme.example",
      firstSeenRunId: "run-1",
      lastSeenRunId: "run-1",
    });
  });

  it("nulls missing optional fields and an unparseable website", () => {
    const row = toNewBusiness(
      { id: "places/x", name: "X", types: [], websiteUri: "not a url" },
      "run-1",
    );

    expect(row.websiteDomain).toBeNull();
    expect(row.formattedAddress).toBeNull();
    expect(row.rating).toBeNull();
  });
});
