import { neon } from "@neondatabase/serverless";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

// Pooled HTTP client — serverless/Vercel app paths (route handlers, server actions).
// IMPORTANT: neon-http does not support interactive transactions (single-shot HTTP).
// All transactional writes run in Trigger.dev tasks via dbDirect (see §11).
const neonSql = neon(env.DATABASE_URL);
export const db: NeonHttpDatabase<typeof schema> = drizzleHttp(neonSql, { schema });

// Direct TCP client — Trigger.dev tasks (serverful, full transaction support) + seed.
// drizzle.config.ts also uses DATABASE_URL_UNPOOLED for migrations (§11).
const pgClient = postgres(env.DATABASE_URL_UNPOOLED, { prepare: false });
export const dbDirect: PostgresJsDatabase<typeof schema> = drizzlePg(pgClient, { schema });

// The transaction handle passed to a dbDirect.transaction(...) callback. Repos accept it too,
// so the same factory works inside a transaction (used by Discover's per-page write).
export type DbTransaction = Parameters<
  Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]
>[0];

// Accepted by every repo factory. Covers both clients for standard CRUD, plus a live transaction.
// Interactive transactions only exist on dbDirect (postgres-js); neon-http is single-shot HTTP.
export type AppDatabase =
  | NeonHttpDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>
  | DbTransaction;
