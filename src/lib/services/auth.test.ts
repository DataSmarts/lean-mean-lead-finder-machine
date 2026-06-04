import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  SESSION_TTL_SECONDS,
  verifyCredentials,
  verifySessionToken,
} from "./auth";

const SECRET = "unit-test-secret-key-at-least-32-bytes!!";
const OTHER_SECRET = "another-secret-key-also-32-bytes-minimum";

// Independent reference for the wire signature, used to forge correctly-signed
// tokens in tests. Cross-checks that the service's Web Crypto HMAC matches
// standard HMAC-SHA256 over the base64url payload segment.
function signSegment(secret: string, payloadSegment: string): string {
  return createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips a valid token to an admin payload", async () => {
    const now = 1_000_000;

    const token = await createSessionToken({ secret: SECRET, nowSeconds: now });
    const result = await verifySessionToken({ token, secret: SECRET, nowSeconds: now + 10 });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.sub).toBe("admin");
      expect(result.payload.iat).toBe(now);
      expect(result.payload.exp).toBe(now + SESSION_TTL_SECONDS);
    }
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken({ secret: SECRET });

    const result = await verifySessionToken({ token, secret: OTHER_SECRET });

    expect(result).toEqual({ valid: false, reason: "bad-signature" });
  });

  it("rejects a tampered signature", async () => {
    const token = await createSessionToken({ secret: SECRET });
    const [payloadSegment, signature] = token.split(".");
    const flipped = (signature.startsWith("A") ? "B" : "A") + signature.slice(1);

    const result = await verifySessionToken({
      token: `${payloadSegment}.${flipped}`,
      secret: SECRET,
    });

    expect(result).toEqual({ valid: false, reason: "bad-signature" });
  });

  it("rejects a tampered payload even when the forged expiry is in the future", async () => {
    const now = 1_000_000;
    const token = await createSessionToken({ secret: SECRET, nowSeconds: now });
    const [payloadSegment, signature] = token.split(".");

    const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
    payload.exp = now + 999_999_999;
    const forgedSegment = Buffer.from(JSON.stringify(payload)).toString("base64url");

    const result = await verifySessionToken({
      token: `${forgedSegment}.${signature}`,
      secret: SECRET,
      nowSeconds: now + 10,
    });

    expect(result).toEqual({ valid: false, reason: "bad-signature" });
  });

  it("rejects an expired token", async () => {
    const now = 1_000_000;
    const token = await createSessionToken({ secret: SECRET, nowSeconds: now, ttlSeconds: 60 });

    const result = await verifySessionToken({ token, secret: SECRET, nowSeconds: now + 61 });

    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("accepts a token on the second before it expires", async () => {
    const now = 1_000_000;
    const token = await createSessionToken({ secret: SECRET, nowSeconds: now, ttlSeconds: 60 });

    const result = await verifySessionToken({ token, secret: SECRET, nowSeconds: now + 59 });

    expect(result.valid).toBe(true);
  });

  it.each([
    ["empty string", ""],
    ["no separator", "abc"],
    ["too many segments", "a.b.c"],
    ["non-base64 signature", "cGF5bG9hZA.@@@"],
  ])("returns malformed for an unparseable token: %s", async (_label, token) => {
    const result = await verifySessionToken({ token, secret: SECRET });

    expect(result).toEqual({ valid: false, reason: "malformed" });
  });

  it("returns malformed when a correctly-signed payload is not a valid session shape", async () => {
    const payloadSegment = Buffer.from(
      JSON.stringify({ sub: "intruder", iat: 1, exp: 9_999_999_999 }),
    ).toString("base64url");
    const signature = signSegment(SECRET, payloadSegment);

    const result = await verifySessionToken({
      token: `${payloadSegment}.${signature}`,
      secret: SECRET,
    });

    expect(result).toEqual({ valid: false, reason: "malformed" });
  });

  it("signs tokens with standard HMAC-SHA256 over the payload segment", async () => {
    const token = await createSessionToken({ secret: SECRET, nowSeconds: 1_000_000 });
    const [payloadSegment, signature] = token.split(".");

    expect(signature).toBe(signSegment(SECRET, payloadSegment));
  });
});

describe("verifyCredentials", () => {
  const expected = { username: "admin", password: "s3cret-pa55word" };

  it("accepts exact credentials", async () => {
    expect(await verifyCredentials(expected, expected)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    expect(await verifyCredentials({ username: "admin", password: "nope" }, expected)).toBe(false);
  });

  it("rejects a wrong username", async () => {
    expect(
      await verifyCredentials({ username: "root", password: "s3cret-pa55word" }, expected),
    ).toBe(false);
  });

  it("rejects when both fields are wrong", async () => {
    expect(await verifyCredentials({ username: "x", password: "y" }, expected)).toBe(false);
  });

  // The constant-time (double-HMAC) compare must reject differing-length inputs
  // without an early-exit, so prefix/length variations are rejected like any other mismatch.
  it("rejects a password that is a prefix of the real one", async () => {
    expect(
      await verifyCredentials({ username: "admin", password: "s3cret-pa55wor" }, expected),
    ).toBe(false);
  });

  it("rejects a password that extends the real one", async () => {
    expect(
      await verifyCredentials({ username: "admin", password: "s3cret-pa55word-extra" }, expected),
    ).toBe(false);
  });
});
