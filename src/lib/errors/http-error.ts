import type { ErrorContext } from "./app-error";
import { AppError } from "./app-error";

export type HttpErrorCode = "HTTP_ERROR" | "HTTP_TIMEOUT";

interface HttpErrorOptions {
  readonly code?: HttpErrorCode;
  readonly status?: number;
  readonly retryable?: boolean;
  readonly context?: ErrorContext;
  readonly cause?: unknown;
}

// Transport-level failure from the shared http client (non-2xx after retries, network error).
export class HttpError extends AppError {
  readonly status?: number;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message, {
      code: options.code ?? "HTTP_ERROR",
      retryable: options.retryable ?? false,
      context: options.context,
      cause: options.cause,
    });
    this.status = options.status;
  }
}

// Per-call timeout fired by the AbortController. Retryable by default.
export class HttpTimeoutError extends HttpError {
  constructor(message: string, options: Omit<HttpErrorOptions, "code" | "status"> = {}) {
    super(message, { ...options, code: "HTTP_TIMEOUT", retryable: options.retryable ?? true });
  }
}
