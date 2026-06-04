import { z } from "zod";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const sessionPayloadSchema = z.object({
  sub: z.literal("admin"),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().nonnegative(),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export type SessionInvalidReason = "malformed" | "bad-signature" | "expired";

export type SessionVerification =
  | { readonly valid: true; readonly payload: SessionPayload }
  | { readonly valid: false; readonly reason: SessionInvalidReason };

export interface Credentials {
  readonly username: string;
  readonly password: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function currentTimeSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function hmacSha256(keyBytes: Uint8Array<ArrayBuffer>, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(signature);
}

async function signSegment(secret: string, payloadSegment: string): Promise<Uint8Array> {
  return hmacSha256(encoder.encode(secret), payloadSegment);
}

export async function createSessionToken(params: {
  secret: string;
  nowSeconds?: number;
  ttlSeconds?: number;
}): Promise<string> {
  const iat = params.nowSeconds ?? currentTimeSeconds();
  const payload: SessionPayload = {
    sub: "admin",
    iat,
    exp: iat + (params.ttlSeconds ?? SESSION_TTL_SECONDS),
  };
  const payloadSegment = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await signSegment(params.secret, payloadSegment);
  return `${payloadSegment}.${base64UrlEncode(signature)}`;
}

export async function verifySessionToken(params: {
  token: string;
  secret: string;
  nowSeconds?: number;
}): Promise<SessionVerification> {
  const parts = params.token.split(".");
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    return { valid: false, reason: "malformed" };
  }
  const [payloadSegment, signatureSegment] = parts;

  let providedSignature: Uint8Array;
  try {
    providedSignature = base64UrlDecode(signatureSegment);
  } catch {
    return { valid: false, reason: "malformed" };
  }

  const expectedSignature = await signSegment(params.secret, payloadSegment);
  if (!constantTimeEqual(providedSignature, expectedSignature)) {
    return { valid: false, reason: "bad-signature" };
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(decoder.decode(base64UrlDecode(payloadSegment)));
  } catch {
    return { valid: false, reason: "malformed" };
  }

  const parsed = sessionPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return { valid: false, reason: "malformed" };
  }

  const now = params.nowSeconds ?? currentTimeSeconds();
  if (parsed.data.exp <= now) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload: parsed.data };
}

export async function verifyCredentials(
  submitted: Credentials,
  expected: Credentials,
): Promise<boolean> {
  // Constant-time compare via double-HMAC under a per-call random key: equal-length
  // digests, no length leak, and no early-exit. Web Crypto has no timing-safe primitive.
  const ephemeralKey = crypto.getRandomValues(new Uint8Array(32));
  const [submittedUser, expectedUser, submittedPass, expectedPass] = await Promise.all([
    hmacSha256(ephemeralKey, submitted.username),
    hmacSha256(ephemeralKey, expected.username),
    hmacSha256(ephemeralKey, submitted.password),
    hmacSha256(ephemeralKey, expected.password),
  ]);
  const usernameMatches = constantTimeEqual(submittedUser, expectedUser);
  const passwordMatches = constantTimeEqual(submittedPass, expectedPass);
  return usernameMatches && passwordMatches;
}
