import type { ErrorContext } from "./app-error";
import { AppError } from "./app-error";

interface GoogleErrorOptions {
  readonly context?: ErrorContext;
  readonly cause?: unknown;
}

// Geocoding returned ZERO_RESULTS for the requested address (a permanent, non-retryable outcome).
export class GeocodeNotFoundError extends AppError {
  constructor(message: string, options: GoogleErrorOptions = {}) {
    super(message, { code: "GEOCODE_NOT_FOUND", retryable: false, ...options });
  }
}

// Google signalled rate limiting (Geocoding OVER_QUERY_LIMIT or a Places 429). Retryable.
export class GoogleRateLimitError extends AppError {
  constructor(message: string, options: GoogleErrorOptions = {}) {
    super(message, { code: "GOOGLE_RATE_LIMIT", retryable: true, ...options });
  }
}
