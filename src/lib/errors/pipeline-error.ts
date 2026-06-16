import type { ErrorContext } from "./app-error";
import { AppError } from "./app-error";

interface PipelineErrorOptions {
  readonly context?: ErrorContext;
  readonly cause?: unknown;
}

export class PipelineStateError extends AppError {
  constructor(message: string, options: PipelineErrorOptions = {}) {
    super(message, { code: "PIPELINE_STATE_ERROR", retryable: false, ...options });
  }
}
