import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => {
  interface MockScope {
    readonly setContext: ReturnType<typeof vi.fn>;
    readonly setTag: ReturnType<typeof vi.fn>;
  }

  const scope = {
    setContext: vi.fn(),
    setTag: vi.fn(),
  } satisfies MockScope;

  return {
    captureException: vi.fn(),
    flush: vi.fn().mockResolvedValue(true),
    init: vi.fn(),
    scope,
    withScope: vi.fn((fn: (scope: MockScope) => void) => fn(scope)),
  };
});

vi.mock("@sentry/nextjs", () => sentry);

import { captureTriggerFailure } from "./trigger";

describe("captureTriggerFailure", () => {
  beforeEach(() => {
    sentry.captureException.mockClear();
    sentry.flush.mockClear();
    sentry.init.mockClear();
    sentry.scope.setContext.mockClear();
    sentry.scope.setTag.mockClear();
    sentry.withScope.mockClear();
    process.env.SENTRY_DSN = "https://public@example.com/1";
  });

  it("initializes Sentry and captures task failure context", async () => {
    const error = new Error("boom");

    await captureTriggerFailure({
      taskId: "discover.run",
      payload: { runId: "run-1" },
      error,
      runId: "run-1",
    });

    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://public@example.com/1" }),
    );
    expect(sentry.scope.setTag).toHaveBeenCalledWith("trigger.task_id", "discover.run");
    expect(sentry.scope.setTag).toHaveBeenCalledWith("trigger.run_id", "run-1");
    expect(sentry.scope.setContext).toHaveBeenCalledWith(
      "trigger",
      expect.objectContaining({ taskId: "discover.run", runId: "run-1" }),
    );
    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(sentry.flush).toHaveBeenCalledWith(2_000);
  });
});
