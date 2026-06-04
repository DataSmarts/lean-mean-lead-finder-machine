import { REDACTED, SECRET_DATA_KEYS } from "@/lib/observability/redaction";

export interface ErrorContext {
  readonly [key: string]: unknown;
}

export interface AppErrorOptions {
  readonly code: string;
  readonly retryable?: boolean;
  readonly context?: ErrorContext;
  readonly cause?: unknown;
}

function sanitizeContext(context: ErrorContext): ErrorContext {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    clean[key] = SECRET_DATA_KEYS.has(key.toLowerCase()) ? REDACTED : value;
  }
  return clean;
}

export class AppError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly context: ErrorContext;

  constructor(message: string, options: AppErrorOptions) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.context = sanitizeContext(options.context ?? {});
    Error.captureStackTrace?.(this, this.constructor);
  }
}
