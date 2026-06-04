import { describe, expect, it, vi } from "vitest";

import { HttpError, HttpTimeoutError } from "@/lib/errors/http-error";

import { createHttpClient } from "./http";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

describe("createHttpClient.request", () => {
  it("returns the parsed JSON body on a 2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ hello: "world" }));
    const client = createHttpClient({ fetch: fetchMock, sleep: vi.fn() });

    const result = await client.request<{ hello: string }>("https://api.test/x");

    expect(result).toEqual({ hello: "world" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 then succeeds, honoring Retry-After seconds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { "retry-after": "2" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createHttpClient({ fetch: fetchMock, sleep, random: () => 0 });

    const result = await client.request<{ ok: boolean }>("https://api.test/x");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("retries a 5xx then succeeds, using exponential backoff with jitter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createHttpClient({ fetch: fetchMock, sleep, random: () => 0, baseDelayMs: 250 });

    await client.request("https://api.test/x");

    // equal jitter at attempt 0 with random()=0 → baseDelay/2
    expect(sleep).toHaveBeenCalledWith(125);
  });

  it("fails fast on a 4xx without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 400));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createHttpClient({ fetch: fetchMock, sleep });

    const error = await client.request("https://api.test/x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).retryable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("throws a retryable HttpError after exhausting retries on a persistent 5xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createHttpClient({ fetch: fetchMock, sleep, maxRetries: 2 });

    const error = await client.request("https://api.test/x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(503);
    expect((error as HttpError).retryable).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("classifies a fetch AbortError as HttpTimeoutError", async () => {
    const fetchMock = vi.fn().mockRejectedValue(abortError());
    const client = createHttpClient({ fetch: fetchMock, sleep: vi.fn(), maxRetries: 0 });

    const error = await client.request("https://api.test/x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpTimeoutError);
    expect((error as HttpTimeoutError).retryable).toBe(true);
  });

  it("aborts via the AbortController when a request exceeds the timeout", async () => {
    const hangingFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(abortError()));
        }),
    );
    const client = createHttpClient({ fetch: hangingFetch, sleep: vi.fn(), maxRetries: 0 });

    const error = await client
      .request("https://api.test/x", undefined, { timeoutMs: 10 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpTimeoutError);
  });

  it("retries a network error then throws a retryable HttpError (not a timeout)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createHttpClient({ fetch: fetchMock, sleep, maxRetries: 1 });

    const error = await client.request("https://api.test/x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).not.toBeInstanceOf(HttpTimeoutError);
    expect((error as HttpError).retryable).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("redacts secret keys passed in the error context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 400));
    const client = createHttpClient({ fetch: fetchMock, sleep: vi.fn() });

    const error = await client
      .request("https://api.test/x", undefined, { context: { api_key: "sk-secret", host: "maps" } })
      .catch((e: unknown) => e);

    expect((error as HttpError).context["api_key"]).toBe("[redacted]");
    expect((error as HttpError).context["host"]).toBe("maps");
  });
});
