import { beforeEach, describe, expect, it, vi } from "vitest";

import { webEnv as env } from "@/lib/env";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/services/auth";

const { cookieStore, redirectMock } = vi.hoisted(() => ({
  cookieStore: { set: vi.fn(), delete: vi.fn() },
  redirectMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { login, logout } from "./auth";

function formWith(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  cookieStore.set.mockClear();
  cookieStore.delete.mockClear();
  redirectMock.mockClear();
});

describe("login action", () => {
  it("rejects wrong credentials without setting a cookie or redirecting", async () => {
    const result = await login({}, formWith({ username: "wrong", password: "wrong" }));

    expect(result.error).toBeDefined();
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects empty fields", async () => {
    const result = await login({}, formWith({ username: "", password: "" }));

    expect(result.error).toBeDefined();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("sets a valid signed session cookie with the right flags on correct credentials", async () => {
    await login(
      {},
      formWith({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD, next: "/runs" }),
    );

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const [name, token, options] = cookieStore.set.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: expect.any(Number),
    });

    const verified = await verifySessionToken({ token, secret: env.SESSION_SECRET });
    expect(verified.valid).toBe(true);
    expect(redirectMock).toHaveBeenCalledWith("/runs");
  });

  it("redirects to / when the next target is not a same-origin path", async () => {
    await login(
      {},
      formWith({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD, next: "//evil.com" }),
    );

    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});

describe("logout action", () => {
  it("clears the session cookie and redirects to /login", async () => {
    await logout();

    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
