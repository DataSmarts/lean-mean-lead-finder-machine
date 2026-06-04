import { describe, expect, it } from "vitest";

import { AppError } from "./app-error";
import { HttpError, HttpTimeoutError } from "./http-error";

describe("HttpError", () => {
  it("defaults to HTTP_ERROR code", () => {
    expect(new HttpError("boom").code).toBe("HTTP_ERROR");
  });

  it("is instanceof AppError", () => {
    expect(new HttpError("boom")).toBeInstanceOf(AppError);
  });

  it("defaults retryable to false", () => {
    expect(new HttpError("boom").retryable).toBe(false);
  });

  it("carries the HTTP status when provided", () => {
    expect(new HttpError("boom", { status: 503, retryable: true }).status).toBe(503);
  });

  it("redacts secret keys in context", () => {
    const err = new HttpError("boom", { context: { api_key: "sk-123", host: "maps" } });
    expect(err.context["api_key"]).toBe("[redacted]");
    expect(err.context["host"]).toBe("maps");
  });
});

describe("HttpTimeoutError", () => {
  it("has code HTTP_TIMEOUT", () => {
    expect(new HttpTimeoutError("slow").code).toBe("HTTP_TIMEOUT");
  });

  it("is retryable by default", () => {
    expect(new HttpTimeoutError("slow").retryable).toBe(true);
  });

  it("is instanceof HttpError", () => {
    expect(new HttpTimeoutError("slow")).toBeInstanceOf(HttpError);
  });
});
