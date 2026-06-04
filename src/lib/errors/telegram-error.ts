import type { ErrorContext } from "./app-error";
import { AppError } from "./app-error";

interface TelegramErrorOptions {
  readonly context?: ErrorContext;
  readonly cause?: unknown;
}

// Telegram Bot API responded with ok:false (a logical error, not a transport error).
export class TelegramApiError extends AppError {
  constructor(message: string, options: TelegramErrorOptions = {}) {
    super(message, { code: "TELEGRAM_API_ERROR", retryable: false, ...options });
  }
}
