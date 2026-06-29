import { z } from "zod";

import { DEFAULT_ENRICH_BATCH_SIZE, DEFAULT_ENRICH_REUSE_DAYS } from "@/lib/config/defaults";

// Vars required by Trigger.dev tasks and shared Next.js code.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url(),
  GOOGLE_MAPS_API_KEY: z.string().min(1),
  HUNTER_API_KEY: z.string().min(1),
  HUNTER_LIMIT: z.coerce.number().int().positive().default(5),
  ENRICH_REUSE_DAYS: z.coerce.number().int().positive().default(DEFAULT_ENRICH_REUSE_DAYS),
  ENRICH_BATCH_SIZE: z.coerce.number().int().positive().default(DEFAULT_ENRICH_BATCH_SIZE),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1).default("google/gemini-3-flash-preview:online"),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

// Web-only vars — not available in Trigger.dev workers, only in the Next.js runtime.
const webEnvSchema = envSchema.extend({
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

function makeParsed<T>(schema: z.ZodType<T>, source: Record<string, string | undefined>): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const tree = z.treeifyError(result.error);
    throw new Error(`Invalid environment configuration:\n${JSON.stringify(tree, null, 2)}`);
  }
  return result.data;
}

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  return makeParsed(envSchema, source);
}

export function parseWebEnv(source: Record<string, string | undefined> = process.env): WebEnv {
  return makeParsed(webEnvSchema, source);
}

function makeProxy<T extends object>(parse: () => T): T {
  let _parsed: T | undefined;
  return new Proxy({} as T, {
    get(_, prop: string | symbol) {
      if (!_parsed) _parsed = parse();
      return _parsed[prop as keyof T];
    },
  });
}

// Lazy proxy: validation runs on first property access, not at module load.
// This prevents build-time failures (Vercel, Trigger.dev) when env vars are
// absent from the build environment but present at runtime.
export const env: Env = makeProxy(parseEnv);

// Use webEnv in Next.js-only code (auth, session, Telegram webhook).
// Do NOT import this in Trigger.dev task files.
export const webEnv: WebEnv = makeProxy(parseWebEnv);
