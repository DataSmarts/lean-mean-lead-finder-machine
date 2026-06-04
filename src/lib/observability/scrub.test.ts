import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { scrubEvent } from "./scrub";

function makeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return { ...overrides } as unknown as ErrorEvent;
}

describe("scrubEvent", () => {
  it("redacts authorization and cookie request headers", () => {
    const event = makeEvent({
      request: {
        headers: {
          authorization: "Bearer token123",
          cookie: "session=abc",
          "user-agent": "Mozilla/5.0",
        },
      },
    });
    const result = scrubEvent(event);
    expect(result.request?.headers?.["authorization"]).toBe("[redacted]");
    expect(result.request?.headers?.["cookie"]).toBe("[redacted]");
    expect(result.request?.headers?.["user-agent"]).toBe("Mozilla/5.0");
  });

  it("redacts secret keys in extra", () => {
    const event = makeEvent({
      extra: { password: "secret", api_key: "key123", runId: "run-abc" },
    });
    const result = scrubEvent(event);
    expect(result.extra?.["password"]).toBe("[redacted]");
    expect(result.extra?.["api_key"]).toBe("[redacted]");
    expect(result.extra?.["runId"]).toBe("run-abc");
  });

  it("redacts nested secret keys in extra", () => {
    const event = makeEvent({
      extra: { user: { email: "user@example.com", name: "Alice" } },
    });
    const result = scrubEvent(event);
    const user = result.extra?.["user"] as Record<string, unknown>;
    expect(user["email"]).toBe("[redacted]");
    expect(user["name"]).toBe("Alice");
  });

  it("passes a clean event through unchanged", () => {
    const event = makeEvent({ extra: { runId: "run-abc", status: "ok" } });
    const result = scrubEvent(event);
    expect(result.extra?.["runId"]).toBe("run-abc");
    expect(result.extra?.["status"]).toBe("ok");
  });

  it("does not throw on a minimal event with no request or extra", () => {
    expect(() => scrubEvent(makeEvent())).not.toThrow();
  });

  it("does not mutate the original event", () => {
    const event = makeEvent({
      request: { headers: { authorization: "Bearer token" } },
    });
    scrubEvent(event);
    expect(event.request?.headers?.["authorization"]).toBe("Bearer token");
  });
});
