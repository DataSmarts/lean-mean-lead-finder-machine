import { describe, expect, it } from "vitest";

import { AppError } from "./app-error";
import { GeocodeNotFoundError, GoogleRateLimitError } from "./google-error";

describe("GeocodeNotFoundError", () => {
  it("has code GEOCODE_NOT_FOUND", () => {
    expect(new GeocodeNotFoundError("no match").code).toBe("GEOCODE_NOT_FOUND");
  });

  it("is not retryable", () => {
    expect(new GeocodeNotFoundError("no match").retryable).toBe(false);
  });

  it("is instanceof AppError", () => {
    expect(new GeocodeNotFoundError("no match")).toBeInstanceOf(AppError);
  });
});

describe("GoogleRateLimitError", () => {
  it("has code GOOGLE_RATE_LIMIT", () => {
    expect(new GoogleRateLimitError("slow down").code).toBe("GOOGLE_RATE_LIMIT");
  });

  it("is retryable", () => {
    expect(new GoogleRateLimitError("slow down").retryable).toBe(true);
  });

  it("is instanceof AppError", () => {
    expect(new GoogleRateLimitError("slow down")).toBeInstanceOf(AppError);
  });
});
