import type { ErrorContext } from "@/lib/errors/app-error";
import { HttpError, HttpTimeoutError } from "@/lib/errors/http-error";

export interface HttpRequestOptions {
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  // Merged (and sanitized) into any thrown error. Never put secrets here.
  readonly context?: ErrorContext;
}

export interface HttpClientDeps {
  readonly fetch?: typeof globalThis.fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  // Returns [0, 1); injected so backoff jitter is deterministic under test.
  readonly random?: () => number;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

export interface HttpClient {
  request<T>(url: string, init?: RequestInit, options?: HttpRequestOptions): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 10_000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "AbortError";
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

// Retry-After is either delta-seconds or an HTTP-date (RFC 9110 §10.2.3).
function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(header);
  if (Number.isNaN(dateMs)) return undefined;
  return Math.max(0, dateMs - Date.now());
}

export function createHttpClient(deps: HttpClientDeps = {}): HttpClient {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const random = deps.random ?? Math.random;
  const defaultTimeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const defaultMaxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = deps.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = deps.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  // Exponential backoff with equal jitter: half fixed, half random.
  function backoffMs(attempt: number): number {
    const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    return ceiling / 2 + random() * (ceiling / 2);
  }

  async function fetchWithTimeout(
    url: string,
    init: RequestInit | undefined,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function parseJson<T>(response: Response, context?: ErrorContext): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new HttpError("Response body was not valid JSON", {
        status: response.status,
        retryable: false,
        context,
        cause,
      });
    }
  }

  return {
    async request<T>(
      url: string,
      init?: RequestInit,
      options: HttpRequestOptions = {},
    ): Promise<T> {
      const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
      const maxRetries = options.maxRetries ?? defaultMaxRetries;
      const context = options.context;

      for (let attempt = 0; ; attempt++) {
        let response: Response;
        try {
          response = await fetchWithTimeout(url, init, timeoutMs);
        } catch (cause) {
          const timedOut = isAbortError(cause);
          if (attempt < maxRetries) {
            await sleep(backoffMs(attempt));
            continue;
          }
          if (timedOut) {
            throw new HttpTimeoutError("Request timed out", { context, cause });
          }
          throw new HttpError("Request failed", { retryable: true, context, cause });
        }

        if (response.ok) {
          return parseJson<T>(response, context);
        }

        if (isRetryableStatus(response.status) && attempt < maxRetries) {
          await sleep(retryAfterMs(response) ?? backoffMs(attempt));
          continue;
        }

        throw new HttpError(`Request failed with status ${response.status}`, {
          status: response.status,
          retryable: isRetryableStatus(response.status),
          context,
        });
      }
    },
  };
}
