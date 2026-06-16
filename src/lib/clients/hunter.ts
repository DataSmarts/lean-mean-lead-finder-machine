import { z } from "zod";

import { HttpError } from "@/lib/errors/http-error";
import { HunterQuotaExhaustedError, HunterRateLimitError } from "@/lib/errors/hunter-error";

import type { HttpClient } from "./http";

const HUNTER_BASE_URL = "https://api.hunter.io";

// Hunter's 403 is a transient rate limit (15 req/s or 500 req/min), not an auth error.
// Hunter's 429 is the account/plan quota exhausted — not retryable.
// See https://hunter.io/api-documentation/v2 — inverted from the usual HTTP convention.
const HUNTER_RATE_LIMIT_STATUS = 403;
const HUNTER_QUOTA_EXHAUSTED_STATUS = 429;
const MAX_RATE_LIMIT_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

const emailSchema = z.object({
  value: z.string(),
  type: z.enum(["personal", "generic"]).nullable().optional(),
  confidence: z.number().default(0),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  seniority: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  twitter: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  verification: z
    .object({ status: z.enum(["valid", "invalid", "accept_all"]).nullable().optional() })
    .nullable()
    .optional(),
});

const domainSearchResponseSchema = z.object({
  data: z.object({
    organization: z.string().nullable().optional(),
    pattern: z.string().nullable().optional(),
    emails: z.array(emailSchema).default([]),
  }),
});

export interface HunterEmail {
  readonly value: string;
  readonly type: "personal" | "generic" | null;
  readonly confidence: number;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly position: string | null;
  readonly seniority: string | null;
  readonly department: string | null;
  readonly linkedin: string | null;
  readonly twitter: string | null;
  readonly phoneNumber: string | null;
  readonly verificationStatus: "valid" | "invalid" | "accept_all" | null;
}

export interface HunterDomainSearchResult {
  readonly organization: string | null;
  readonly pattern: string | null;
  readonly emails: HunterEmail[];
}

export interface HunterClientDeps {
  readonly http: HttpClient;
  readonly apiKey: string;
  readonly limit?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
}

export interface HunterClient {
  domainSearch(domain: string): Promise<HunterDomainSearchResult>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createHunterClient({
  http,
  apiKey,
  limit = 5,
  sleep = defaultSleep,
  random = Math.random,
}: HunterClientDeps): HunterClient {
  // Exponential backoff with jitter, matching the pattern in http.ts.
  function backoffMs(attempt: number): number {
    const ceiling = Math.min(30_000, BASE_RETRY_DELAY_MS * 2 ** attempt);
    return ceiling / 2 + random() * (ceiling / 2);
  }

  async function fetchDomainSearch(domain: string): Promise<unknown> {
    const url =
      `${HUNTER_BASE_URL}/v2/domain-search` +
      `?domain=${encodeURIComponent(domain)}` +
      `&department=executive,management` +
      `&limit=${limit}` +
      `&api_key=${encodeURIComponent(apiKey)}`;
    // maxRetries: 0 — http.ts would retry 429 (quota) as if it were a server error, which is wrong.
    // Hunter's 429 is non-retryable quota exhaustion; 403 needs its own retry logic below.
    return http.request<unknown>(url, { method: "GET" }, { maxRetries: 0, context: { domain } });
  }

  async function domainSearchWithRetry(domain: string, attempt = 0): Promise<unknown> {
    try {
      return await fetchDomainSearch(domain);
    } catch (cause) {
      if (cause instanceof HttpError) {
        if (cause.status === HUNTER_RATE_LIMIT_STATUS) {
          if (attempt < MAX_RATE_LIMIT_RETRIES) {
            await sleep(backoffMs(attempt));
            return domainSearchWithRetry(domain, attempt + 1);
          }
          throw new HunterRateLimitError(
            `Hunter rate limit exceeded after ${MAX_RATE_LIMIT_RETRIES + 1} attempts`,
            { cause, context: { domain } },
          );
        }
        if (cause.status === HUNTER_QUOTA_EXHAUSTED_STATUS) {
          throw new HunterQuotaExhaustedError("Hunter account quota exhausted", {
            cause,
            context: { domain },
          });
        }
      }
      throw cause;
    }
  }

  return {
    async domainSearch(domain: string): Promise<HunterDomainSearchResult> {
      const raw = await domainSearchWithRetry(domain);
      const parsedResult = domainSearchResponseSchema.safeParse(raw);
      if (!parsedResult.success) {
        throw new HttpError("Hunter response failed validation", {
          context: { domain },
          cause: parsedResult.error,
        });
      }
      const parsed = parsedResult.data;
      return {
        organization: parsed.data.organization ?? null,
        pattern: parsed.data.pattern ?? null,
        emails: parsed.data.emails.map((e) => ({
          value: e.value,
          type: e.type ?? null,
          confidence: e.confidence,
          firstName: e.first_name ?? null,
          lastName: e.last_name ?? null,
          position: e.position ?? null,
          seniority: e.seniority ?? null,
          department: e.department ?? null,
          linkedin: e.linkedin ?? null,
          twitter: e.twitter ?? null,
          phoneNumber: e.phone_number ?? null,
          verificationStatus: e.verification?.status ?? null,
        })),
      };
    },
  };
}
