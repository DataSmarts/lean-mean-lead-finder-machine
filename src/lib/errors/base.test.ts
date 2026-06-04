import { describe, expect, it } from "vitest";

import { AppError } from "./app-error";

describe("AppError", () => {
  it("exposes the code and message", () => {
    const err = new AppError("something went wrong", { code: "SOME_ERROR" });
    expect(err.code).toBe("SOME_ERROR");
    expect(err.message).toBe("something went wrong");
  });

  it("defaults retryable to false", () => {
    const err = new AppError("oops", { code: "ERR" });
    expect(err.retryable).toBe(false);
  });

  it("respects an explicit retryable value", () => {
    const err = new AppError("rate limited", { code: "RATE_LIMIT", retryable: true });
    expect(err.retryable).toBe(true);
  });

  it("redacts secret keys in context", () => {
    const err = new AppError("oops", {
      code: "ERR",
      context: { password: "secret123", email: "user@example.com", runId: "abc-123" },
    });
    expect(err.context["password"]).toBe("[redacted]");
    expect(err.context["email"]).toBe("[redacted]");
    expect(err.context["runId"]).toBe("abc-123");
  });

  it("is instanceof Error and instanceof AppError", () => {
    const err = new AppError("oops", { code: "ERR" });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it("sets the name to the constructor name", () => {
    const err = new AppError("oops", { code: "ERR" });
    expect(err.name).toBe("AppError");
  });
});
