import { describe, expect, it } from "vitest";

import { DEFAULT_ENRICH_BATCH_SIZE, DEFAULT_ENRICH_REUSE_DAYS } from "@/lib/config/defaults";

import { parseEnv, parseWebEnv } from "./env";

const validTask = {
  DATABASE_URL: "postgresql://user:pass@host/db",
  DATABASE_URL_UNPOOLED: "postgresql://user:pass@host/db",
  GOOGLE_MAPS_API_KEY: "test-google-maps-key",
  HUNTER_API_KEY: "test-hunter-key",
  OPENROUTER_API_KEY: "test-openrouter-key",
  TELEGRAM_BOT_TOKEN: "1234567890:test-token",
  TELEGRAM_CHAT_ID: "987654321",
  APP_BASE_URL: "http://localhost:3000",
};

const validWeb = {
  ...validTask,
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "correct horse battery staple",
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  TELEGRAM_WEBHOOK_SECRET: "test-webhook-secret",
};

describe("parseEnv (task-safe vars)", () => {
  it("throws with the missing key named when a required var is absent", () => {
    expect(() => parseEnv({ DATABASE_URL_UNPOOLED: validTask.DATABASE_URL_UNPOOLED })).toThrow(
      "DATABASE_URL",
    );
  });

  it("throws when a required var is not a valid URL", () => {
    expect(() => parseEnv({ ...validTask, DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("returns a typed env object on valid input", () => {
    const result = parseEnv(validTask);
    expect(result.DATABASE_URL).toBe(validTask.DATABASE_URL);
    expect(result.DATABASE_URL_UNPOOLED).toBe(validTask.DATABASE_URL_UNPOOLED);
  });

  it("defaults NODE_ENV to development when omitted", () => {
    const result = parseEnv(validTask);
    expect(result.NODE_ENV).toBe("development");
  });

  it("does not throw when optional SENTRY_DSN is absent", () => {
    expect(() => parseEnv(validTask)).not.toThrow();
  });

  it("defaults ENRICH_REUSE_DAYS", () => {
    expect(parseEnv(validTask).ENRICH_REUSE_DAYS).toBe(DEFAULT_ENRICH_REUSE_DAYS);
  });

  it("coerces ENRICH_REUSE_DAYS from a string", () => {
    expect(parseEnv({ ...validTask, ENRICH_REUSE_DAYS: "14" }).ENRICH_REUSE_DAYS).toBe(14);
  });

  it("defaults ENRICH_BATCH_SIZE", () => {
    expect(parseEnv(validTask).ENRICH_BATCH_SIZE).toBe(DEFAULT_ENRICH_BATCH_SIZE);
  });

  it("coerces ENRICH_BATCH_SIZE from a string", () => {
    expect(parseEnv({ ...validTask, ENRICH_BATCH_SIZE: "10" }).ENRICH_BATCH_SIZE).toBe(10);
  });

  it("throws when ENRICH_BATCH_SIZE is not positive", () => {
    expect(() => parseEnv({ ...validTask, ENRICH_BATCH_SIZE: "0" })).toThrow("ENRICH_BATCH_SIZE");
  });

  it("throws when TELEGRAM_BOT_TOKEN is absent", () => {
    const { TELEGRAM_BOT_TOKEN: _, ...rest } = validTask;
    expect(() => parseEnv(rest)).toThrow("TELEGRAM_BOT_TOKEN");
  });

  it("throws when TELEGRAM_CHAT_ID is absent", () => {
    const { TELEGRAM_CHAT_ID: _, ...rest } = validTask;
    expect(() => parseEnv(rest)).toThrow("TELEGRAM_CHAT_ID");
  });

  it("throws when APP_BASE_URL is absent", () => {
    const { APP_BASE_URL: _, ...rest } = validTask;
    expect(() => parseEnv(rest)).toThrow("APP_BASE_URL");
  });

  it("throws when APP_BASE_URL is not a valid URL", () => {
    expect(() => parseEnv({ ...validTask, APP_BASE_URL: "not-a-url" })).toThrow("APP_BASE_URL");
  });

  it("does not require web-only vars", () => {
    expect(() => parseEnv(validTask)).not.toThrow();
  });
});

describe("parseWebEnv (web-only vars)", () => {
  it("rejects a SESSION_SECRET shorter than 32 characters", () => {
    expect(() => parseWebEnv({ ...validWeb, SESSION_SECRET: "too-short" })).toThrow(
      "SESSION_SECRET",
    );
  });

  it("throws when TELEGRAM_WEBHOOK_SECRET is absent", () => {
    const { TELEGRAM_WEBHOOK_SECRET: _, ...rest } = validWeb;
    expect(() => parseWebEnv(rest)).toThrow("TELEGRAM_WEBHOOK_SECRET");
  });

  it("throws when ADMIN_USERNAME is absent", () => {
    const { ADMIN_USERNAME: _, ...rest } = validWeb;
    expect(() => parseWebEnv(rest)).toThrow("ADMIN_USERNAME");
  });

  it("returns a typed env object on valid input", () => {
    const result = parseWebEnv(validWeb);
    expect(result.ADMIN_USERNAME).toBe(validWeb.ADMIN_USERNAME);
    expect(result.SESSION_SECRET).toBe(validWeb.SESSION_SECRET);
  });
});
