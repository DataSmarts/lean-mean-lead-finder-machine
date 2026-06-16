import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

import { webEnv as env } from "@/lib/env";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/services/auth";

import { proxy } from "./proxy";

function requestFor(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`), {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy", () => {
  let validCookie: string;

  beforeAll(async () => {
    const token = await createSessionToken({ secret: env.SESSION_SECRET });
    validCookie = `${SESSION_COOKIE_NAME}=${token}`;
  });

  it("redirects an unauthenticated page request to /login carrying the original path", async () => {
    const response = await proxy(requestFor("/runs"));

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Fruns");
  });

  it("returns 401 JSON for an unauthenticated API request", async () => {
    const response = await proxy(requestFor("/api/runs"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("lets the Telegram webhook through without a session", async () => {
    const response = await proxy(requestFor("/api/telegram/webhook"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows an authenticated page request through", async () => {
    const response = await proxy(requestFor("/runs", validCookie));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows an authenticated API request through", async () => {
    const response = await proxy(requestFor("/api/runs", validCookie));

    expect(response.status).toBe(200);
  });

  it("redirects a page request whose session cookie is malformed", async () => {
    const response = await proxy(requestFor("/runs", `${SESSION_COOKIE_NAME}=not-a-valid-token`));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("returns 401 for an API request whose session has expired", async () => {
    const token = await createSessionToken({
      secret: env.SESSION_SECRET,
      nowSeconds: 1000,
      ttlSeconds: 60,
    });
    const response = await proxy(requestFor("/api/runs", `${SESSION_COOKIE_NAME}=${token}`));

    expect(response.status).toBe(401);
  });

  it("gates an unauthenticated dashboard approve request with 401", async () => {
    const response = await proxy(requestFor("/api/runs/run-1/approve"));

    expect(response.status).toBe(401);
  });

  it("gates an unauthenticated dashboard reject request with 401", async () => {
    const response = await proxy(requestFor("/api/runs/run-1/reject"));

    expect(response.status).toBe(401);
  });
});
