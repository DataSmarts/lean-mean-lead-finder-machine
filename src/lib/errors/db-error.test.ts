import { describe, expect, it } from "vitest";

import { AppError } from "./app-error";
import { DbError, UniqueViolationError, wrapDbError } from "./db-error";

describe("DbError", () => {
  it("defaults to DB_ERROR code", () => {
    const err = new DbError("query failed");
    expect(err.code).toBe("DB_ERROR");
  });

  it("accepts an explicit code", () => {
    const err = new DbError("conflict", { code: "DB_UNIQUE_VIOLATION" });
    expect(err.code).toBe("DB_UNIQUE_VIOLATION");
  });

  it("is instanceof AppError", () => {
    expect(new DbError("oops")).toBeInstanceOf(AppError);
  });

  it("sets the name to DbError", () => {
    expect(new DbError("oops").name).toBe("DbError");
  });

  it("defaults retryable to false", () => {
    expect(new DbError("oops").retryable).toBe(false);
  });

  it("accepts retryable: true", () => {
    expect(new DbError("oops", { retryable: true }).retryable).toBe(true);
  });
});

describe("UniqueViolationError", () => {
  it("has code DB_UNIQUE_VIOLATION", () => {
    expect(new UniqueViolationError("conflict").code).toBe("DB_UNIQUE_VIOLATION");
  });

  it("is instanceof DbError", () => {
    expect(new UniqueViolationError("conflict")).toBeInstanceOf(DbError);
  });

  it("is instanceof AppError", () => {
    expect(new UniqueViolationError("conflict")).toBeInstanceOf(AppError);
  });

  it("sets the name to UniqueViolationError", () => {
    expect(new UniqueViolationError("conflict").name).toBe("UniqueViolationError");
  });
});

describe("wrapDbError", () => {
  it("wraps a Postgres 23505 error as UniqueViolationError", () => {
    const pgError = { code: "23505", message: "duplicate key" };
    const err = wrapDbError(pgError, "duplicate");
    expect(err).toBeInstanceOf(UniqueViolationError);
    expect(err.code).toBe("DB_UNIQUE_VIOLATION");
  });

  it("wraps any other error as DbError", () => {
    const err = wrapDbError(new Error("connection refused"), "query failed");
    expect(err).toBeInstanceOf(DbError);
    expect(err.code).toBe("DB_ERROR");
  });

  it("chains the original cause", () => {
    const cause = new Error("original");
    const err = wrapDbError(cause, "wrapped");
    expect(err.cause).toBe(cause);
  });

  it("redacts email in context", () => {
    const err = wrapDbError(new Error("x"), "oops", { email: "user@example.com", runId: "abc" });
    expect(err.context["email"]).toBe("[redacted]");
    expect(err.context["runId"]).toBe("abc");
  });
});
