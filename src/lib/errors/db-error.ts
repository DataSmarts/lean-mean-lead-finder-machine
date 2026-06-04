import type { ErrorContext } from "./app-error";
import { AppError } from "./app-error";

export type DbErrorCode = "DB_ERROR" | "DB_UNIQUE_VIOLATION";

interface DbErrorOptions {
  readonly code?: DbErrorCode;
  readonly retryable?: boolean;
  readonly context?: ErrorContext;
  readonly cause?: unknown;
}

export class DbError extends AppError {
  constructor(message: string, options: DbErrorOptions = {}) {
    super(message, { ...options, code: options.code ?? "DB_ERROR" });
  }
}

export class UniqueViolationError extends DbError {
  constructor(message: string, options: Omit<DbErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "DB_UNIQUE_VIOLATION" });
  }
}

// Postgres wire-protocol error code for unique constraint violation.
const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

export function wrapDbError(cause: unknown, message: string, context?: ErrorContext): DbError {
  if (isUniqueViolation(cause)) {
    return new UniqueViolationError(message, { cause, context, retryable: false });
  }
  return new DbError(message, { cause, context });
}
