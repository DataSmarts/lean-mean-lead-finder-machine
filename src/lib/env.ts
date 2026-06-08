import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url(),
  GOOGLE_MAPS_API_KEY: z.string().min(1),
  HUNTER_API_KEY: z.string().min(1),
  HUNTER_LIMIT: z.coerce.number().int().positive().default(5),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1).default("google/gemini-3-flash-preview:online"),
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const tree = z.treeifyError(result.error);
    throw new Error(`Invalid environment configuration:\n${JSON.stringify(tree, null, 2)}`);
  }
  return result.data;
}

let _parsed: Env | undefined;

function getEnv(): Env {
  if (!_parsed) {
    _parsed = parseEnv();
  }
  return _parsed;
}

// Lazy proxy: validation runs on first property access, not at module load.
// This prevents build-time failures (Vercel, Trigger.dev) when env vars are
// absent from the build environment but present at runtime.
export const env: Env = new Proxy({} as Env, {
  get(_, prop: string | symbol) {
    return getEnv()[prop as keyof Env];
  },
});
