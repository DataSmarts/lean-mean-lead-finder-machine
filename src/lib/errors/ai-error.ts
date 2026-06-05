import type { ErrorContext } from "./app-error";
import { AppError } from "./app-error";

interface AiErrorOptions {
  readonly context?: ErrorContext;
  readonly cause?: unknown;
}

// AI returned content that could not be parsed as valid JSON after bounded retries.
export class AiOutputParseError extends AppError {
  constructor(message: string, options: AiErrorOptions = {}) {
    super(message, { code: "AI_OUTPUT_PARSE", retryable: false, ...options });
  }
}
