import type { ErrorContext } from "./app-error";
import { AppError } from "./app-error";

interface HunterErrorOptions {
  readonly context?: ErrorContext;
  readonly cause?: unknown;
}

// Hunter's per-second/per-minute throttle (HTTP 403). Retryable.
// NOTE: Hunter uses 403 for rate limiting, not 429 — the inverse of the usual convention.
export class HunterRateLimitError extends AppError {
  constructor(message: string, options: HunterErrorOptions = {}) {
    super(message, { code: "HUNTER_RATE_LIMIT", retryable: true, ...options });
  }
}

// Hunter's account/plan usage limit exhausted (HTTP 429). Non-retryable.
// NOTE: Hunter uses 429 for quota exhaustion, not rate limiting — the inverse of the usual convention.
export class HunterQuotaExhaustedError extends AppError {
  constructor(message: string, options: HunterErrorOptions = {}) {
    super(message, { code: "HUNTER_QUOTA_EXHAUSTED", retryable: false, ...options });
  }
}
