import type { ErrorEvent, EventHint } from "@sentry/nextjs";

import { REDACTED, SECRET_DATA_KEYS, SECRET_HEADER_KEYS } from "./redaction";

function scrubRecord(
  input: Record<string, unknown>,
  secretKeys: Set<string>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (secretKeys.has(key.toLowerCase())) {
      output[key] = REDACTED;
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      output[key] = scrubRecord(value as Record<string, unknown>, secretKeys);
    } else {
      output[key] = value;
    }
  }
  return output;
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  const cloned = structuredClone(event);

  if (cloned.request?.headers) {
    cloned.request.headers = scrubRecord(
      cloned.request.headers as Record<string, unknown>,
      SECRET_HEADER_KEYS,
    ) as Record<string, string>;
  }

  if (cloned.request?.cookies !== undefined) {
    // cookies can be a string or object — redact entirely
    (cloned.request as Record<string, unknown>)["cookies"] = REDACTED;
  }

  if (cloned.extra) {
    cloned.extra = scrubRecord(cloned.extra as Record<string, unknown>, SECRET_DATA_KEYS);
  }

  if (cloned.contexts) {
    cloned.contexts = scrubRecord(
      cloned.contexts as Record<string, unknown>,
      SECRET_DATA_KEYS,
    ) as typeof cloned.contexts;
  }

  return cloned;
}
