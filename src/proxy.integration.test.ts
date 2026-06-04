/**
 * Exercises the proxy matcher (which paths the gate runs on) per DAT-39's
 * "exercise the proxy matcher on the PR to main" note. Webhook pass-through
 * behaviour is covered by the unit test in proxy.test.ts.
 */
// Next 16.2.7 still exports this under the middleware name; the matcher config
// schema is identical for proxy.ts.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import { config } from "./proxy";

describe("proxy matcher", () => {
  it.each([
    ["/", true],
    ["/runs", true],
    ["/runs/123", true],
    ["/leads", true],
    ["/api/runs", true],
    ["/api/telegram/webhook", true],
    ["/login", false],
    ["/_next/static/chunk.js", false],
    ["/_next/image", false],
    ["/favicon.ico", false],
  ])("gates %s => %s", (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(expected);
  });
});
