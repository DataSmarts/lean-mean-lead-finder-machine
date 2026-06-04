export const SECRET_DATA_KEYS = new Set([
  "password",
  "token",
  "api_key",
  "apikey",
  "secret",
  "access_token",
  "refresh_token",
  "session",
  "email",
  "authorization",
  "cookie",
]);

export const SECRET_HEADER_KEYS = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);

export const REDACTED = "[redacted]";
