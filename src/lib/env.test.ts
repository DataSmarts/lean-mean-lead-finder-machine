import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

const validBase = {
  DATABASE_URL: "postgresql://user:pass@host/db",
  DATABASE_URL_UNPOOLED: "postgresql://user:pass@host/db",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "correct horse battery staple",
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("parseEnv", () => {
  it("throws with the missing key named when a required var is absent", () => {
    expect(() => parseEnv({ DATABASE_URL_UNPOOLED: validBase.DATABASE_URL_UNPOOLED })).toThrow(
      "DATABASE_URL",
    );
  });

  it("throws when a required var is not a valid URL", () => {
    expect(() => parseEnv({ ...validBase, DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("returns a typed env object on valid input", () => {
    const result = parseEnv(validBase);
    expect(result.DATABASE_URL).toBe(validBase.DATABASE_URL);
    expect(result.DATABASE_URL_UNPOOLED).toBe(validBase.DATABASE_URL_UNPOOLED);
  });

  it("defaults NODE_ENV to development when omitted", () => {
    const result = parseEnv(validBase);
    expect(result.NODE_ENV).toBe("development");
  });

  it("does not throw when optional SENTRY_DSN is absent", () => {
    expect(() => parseEnv(validBase)).not.toThrow();
  });

  it("rejects a SESSION_SECRET shorter than 32 characters", () => {
    expect(() => parseEnv({ ...validBase, SESSION_SECRET: "too-short" })).toThrow("SESSION_SECRET");
  });
});
