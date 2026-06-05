import { describe, expect, it } from "vitest";

import { HunterQuotaExhaustedError, HunterRateLimitError } from "./hunter-error";

describe("HunterRateLimitError", () => {
  it("is retryable (Hunter 403 = transient throttle)", () => {
    const err = new HunterRateLimitError("rate limited");
    expect(err.retryable).toBe(true);
    expect(err.code).toBe("HUNTER_RATE_LIMIT");
    expect(err.message).toBe("rate limited");
  });

  it("is an Error with the right name", () => {
    const err = new HunterRateLimitError("msg");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("HunterRateLimitError");
  });
});

describe("HunterQuotaExhaustedError", () => {
  it("is not retryable (Hunter 429 = quota/plan limit)", () => {
    const err = new HunterQuotaExhaustedError("quota exhausted");
    expect(err.retryable).toBe(false);
    expect(err.code).toBe("HUNTER_QUOTA_EXHAUSTED");
    expect(err.message).toBe("quota exhausted");
  });

  it("is an Error with the right name", () => {
    const err = new HunterQuotaExhaustedError("msg");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("HunterQuotaExhaustedError");
  });
});
