# Architecture — Lean Mean Lead Finder Machine

## 1. Purpose

Lead Finder turns a **(neighborhood + city + country + niche)** input into a list of enriched, contactable leads. It rebuilds the legacy n8n + Google Sheets pipeline (`legacy/*.json`) as a proper TypeScript application with durable execution, a relational database, and an admin dashboard.

The pipeline runs in stages:

1. **Discover** — Google Geocoding → Google Places (`searchText`), paginated, deduped by place ID.
2. **Approve** — a human approves (via Telegram or the dashboard) before any paid enrichment runs.
3. **Enrich** — for **every** discovered business, run **both** Hunter.io and an AI agent (OpenRouter) **in parallel**, then **merge** their results into unified contact records that retain **field-level provenance**.

## 2. Goals & Non-Goals

**Goals**
- Durable, resumable, observable pipeline (no lost progress on redeploy/crash).
- Relational source of truth in Neon Postgres; everything schema-tracked in migrations.
- Single-admin dashboard: start runs, watch live progress, browse a consolidated leads view, export CSV.
- Human-in-the-loop approval before spending money; runs also schedulable.

**Non-Goals (v1)**
- Multi-tenant / multi-user accounts (single admin).
- The Neon **Data API** — see §4. Reads/writes are server-side via Drizzle; the Data API can be added later if browser-direct/reactive reads are ever wanted.
- Public/marketing site, billing, CRM sync.

## 3. Stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Framework | Next.js (App Router) |
| Hosting | Vercel |
| Database | **Neon** serverless Postgres |
| ORM / migrations | **Drizzle ORM** + Drizzle Kit |
| Background work | **Trigger.dev** Cloud |
| Approval channel | Telegram Bot API |
| Observability | Sentry (errors + performance only) |
| Validation | Zod (boundary validation) |

> **Divergence from `TECH_STACK_GUIDE.md`:** the guide defaults to Supabase Postgres; we use **Neon** (serverless, scale-to-zero, native Vercel fit). Consequence: no Supabase Auth/Storage/Studio — auth is handled in-app (§8) and data access uses a Postgres driver, not `supabase-js`. Approved by the project owner.

**New dependencies introduced (flagged per the no-new-deps rule):** `drizzle-orm`, `drizzle-kit`, `postgres` (postgres.js driver for the worker/direct connection), `@trigger.dev/sdk`, `@sentry/nextjs`, `zod`. All are stack-implied or directly required by the decisions below.

## 4. Why no Neon Data API (v1)

The Data API is a PostgREST-compatible REST layer that authenticates via **JWT + Row-Level Security** and lives on its own endpoint (`*.data-api.neon.tech`). It shines for browser-direct, reactive reads. But:

- The chosen auth is a **simple admin username/password from env vars**. A bare password cannot be safely exposed to the browser, and the Data API's own endpoint can't be hidden behind the Next.js auth gate — so browser-direct use would require minting/JWKS-registering custom JWTs and RLS policies on every table. That is real complexity for a single-admin tool.
- The pipeline already needs a **direct server-side DB connection** (Trigger.dev tasks, transactions, calling external APIs) that the Data API cannot serve.

So v1 uses **server-side Drizzle** for everything. This is a clean seam: enabling the Data API later is additive (add RLS + a JWT mint step) and changes nothing about the pipeline.

## 5. High-Level Architecture

```
                       ┌─────────────────────────────────────────────┐
   Browser (admin) ──▶ │  Next.js on Vercel                           │
   (cookie session)    │   /(dashboard) pages · /api routes · actions │
                       │        │ thin controllers                    │
                       │        ▼                                     │
                       │   Services ──▶ Repos (Drizzle) ──▶ Neon ◀────┼──┐
                       │        └────▶ Clients (Google/Hunter/OR/TG)  │  │ pooled
                       └─────────┬───────────────────────────────────┘  │
                                 │ tasks.trigger("leadRun.orchestrate")  │
                                 ▼                                       │ direct
                       ┌─────────────────────────────────────────────┐  │
   Telegram  ◀────────▶│  Trigger.dev tasks                           │──┘
   (approval)          │   discover → [waitpoint] → enrich → finalize │
   Cron schedule ─────▶│   (call the SAME services as the app)        │
                       └─────────────────────────────────────────────┘
```

- **App** uses the **pooled** Neon connection (`DATABASE_URL`).
- **Trigger.dev tasks** and **migrations** use the **direct** connection (`DATABASE_URL_UNPOOLED`).
- Tasks **call services**, never reimplement business logic.

## 6. Data Model

### 6.1 Dedupe & re-run policy (decided)

- **Businesses dedupe globally** by `google_place_id` (one row per real-world place across all runs). Per-run membership + pipeline status live on the `run_businesses` link table.
- **Re-run policy:** when a run re-discovers a known business, **reuse its contacts if enriched within 30 days; otherwise re-enrich.** Threshold configurable. *(Decided on the owner's behalf after the clarifying question was interrupted — flag to change.)*

### 6.2 Tables

`presets` — saved niche/location combos that scheduled runs iterate.
```
id uuid pk · name · neighborhood? · city · country · niche · max_results(120)
is_active(bool) · cron? · created_at · updated_at
```

`runs` — one pipeline execution (input is snapshotted so editing a preset never rewrites history).
```
id uuid pk · preset_id? · trigger_source(dashboard|schedule|api) · status(enum)
neighborhood? · city · country · niche · max_results
geocode_lat? · geocode_lng?
businesses_found · businesses_enriched · businesses_failed · contacts_found   (counters)
approval_token(unique) · approved_at? · approved_by? · rejected_at?
trigger_run_id? · error? · created_at · updated_at · started_at? · finished_at?
```
`run_status`: `queued | discovering | awaiting_approval | rejected | enriching | completed | failed | canceled`

`businesses` — global business identity.
```
id uuid pk · google_place_id (UNIQUE) · name · website_uri? · website_domain?
formatted_address? · national_phone? · international_phone? · rating? · user_rating_count?
price_level? · types(text[]) · first_seen_run_id? · last_seen_run_id? · created_at · updated_at
```

`run_businesses` — link + per-run pipeline state (the fan-out unit).
```
id uuid pk · run_id → runs · business_id → businesses
enrich_status(enum) · ai_status(enum) · hunter_status(enum)
ai_error? · hunter_error? · attempts · enriched_at? · created_at · updated_at
UNIQUE (run_id, business_id)
```
`business_enrich_status`: `queued | ai_running | hunter_running | enriched | partial | failed | skipped`
(`partial` = one source succeeded, the other failed.)

`discovery_pages` — pagination cursor + idempotency for Discover (replaces the legacy global DataTable row).
```
id uuid pk · run_id → runs · page_index · page_token? · results_count · fetched_at
UNIQUE (run_id, page_index)
```

`contacts` — every contact from every source, plus materialized merged rows.
```
id uuid pk · run_id → runs · business_id → businesses
source(ai|hunter) · kind(person|merged)
full_name? · first_name? · last_name? · title? · email?
email_confidence?(int 0-100, Hunter) · email_verification(enum) · seniority? · department?
phone? · linkedin_url? · instagram_url?(ai) · twitter_url? · facebook_url?(ai)
merged_into_id? → contacts        (raw row → its merged row)
field_sources jsonb               (merged rows only: {"email":"hunter","linkedin_url":"ai",...})
raw jsonb                         (original source payload, for audit/correction)
created_at
UNIQUE (run_id, business_id, source, email)
```
`email_verification`: `valid | invalid | accept_all | webmail | disposable | unknown | unverified`

### 6.3 Provenance & merge model

Two levels of provenance:

1. **Row-level** — every raw contact carries `source ∈ {ai, hunter}` and its untouched `raw` payload. Ground truth is never lost.
2. **Field-level** — after both sources finish for a business, a **pure merge service** groups raw rows into people and emits one `kind='merged'` row per person, recording which source won each field in `field_sources`.

**Merge precedence (deterministic, documented):**
- *Identity match:* same person if emails match (case-insensitive), or `last_name` + first-initial match when email is missing.
- *email:* prefer Hunter when `verification=valid` or `confidence ≥ 80`; else any non-null; AI email only if Hunter has none.
- *title / seniority / department / confidence / verification:* Hunter wins (structured, verified).
- *linkedin / instagram / twitter / facebook:* prefer AI; fall back to Hunter for linkedin/twitter.
- *full_name:* prefer the source that supplied the winning email; tie → Hunter.
- AI's literal `"NA"` strings are normalized to `null` at the client boundary, so they never enter the merge.

The leads view reads `kind='merged'` rows (one per person, with source badges); CSV export can emit merged rows (default) or all raw rows (`?raw=1`).

### 6.4 Indexes (key ones)

`runs(status, created_at desc)` · `run_businesses(run_id, enrich_status)` (fan-out worklist) · `businesses(google_place_id)` unique · `businesses(website_domain)` · `contacts(run_id, business_id)` · `contacts(run_id, kind)` · `contacts(lower(email))` · `discovery_pages(run_id, page_index)` unique.

`updated_at` is maintained in the repo layer (not DB triggers) to keep side effects explicit.

## 7. Pipeline (Trigger.dev)

### 7.1 Task graph

```
leadRun.orchestrate(runId)                    ── root; all triggers funnel here
  ├─ discover.run            geocode + paginated Places → upsert businesses + run_businesses
  ├─ [waitpoint] approval    Telegram/dashboard approve|reject (24h timeout → reject)
  ├─ enrich.fanOut           batchTriggerAndWait over run_businesses where enrich_status='queued'
  │     └─ enrich.business   per business: Promise.allSettled([AI, Hunter]) → persist raw → merge
  └─ finalize.run            recompute counters from DB; set status=completed|failed
```

Every task is thin: parse payload → call a service (`discoverService`, `enrichService`, `mergeService`, `runService`) → persist via repos.

### 7.2 One entry point, three triggers

All three converge on `leadRun.orchestrate({ runId })`:
- **Dashboard form** → server action validates (Zod) → `runService.create()` → trigger.
- **Scheduled cron** → Trigger.dev `schedules.task` per active preset → `runService.createFromPreset()` → trigger. (Trigger.dev schedules, not Vercel Cron, per `TECH_STACK_GUIDE.md` §8.)
- **API** (`POST /api/runs`) → same as the form path.

### 7.3 Discover — pagination, limits, idempotency

- Geocode once; cache `lat/lng` on the run (skip if already set on resume).
- Per page, in one transaction: upsert places into `businesses` (`on conflict (google_place_id) do update`), upsert `run_businesses` (`do nothing` = per-run dedupe), insert a `discovery_pages` row, bump `businesses_found`.
- **Resumability:** the two unique constraints make a re-fetched page a no-op; on retry, resume from the highest persisted page.
- Google's `nextPageToken` is invalid for a moment after issue → `wait.for({ seconds: 2 })` between pages (durable wait). Stop at `businesses_found >= max_results` or no token; trim the final page.

### 7.4 Enrich — parallel sources, merge, idempotency

- `enrich.fanOut` batches `enrich.business` (e.g. 25 at a time) to respect provider limits and Trigger.dev concurrency.
- `enrich.business`: mark statuses → run **AI + Hunter in parallel** (`allSettled`, so one failing never aborts the other — preserves legacy `continueErrorOutput`) → persist raw contacts (`on conflict … do update` = idempotent) → `mergeService.merge()` → upsert merged rows + `field_sources` → roll up `enrich_status` (`enriched`/`partial`/`failed`) → atomic counter bumps.
- **Re-run reuse:** if the business was enriched < 30 days ago, skip the source calls and link existing contacts into this run.
- **No website** → skip Hunter (`hunter_status='skipped'`), AI still runs.
- Retries: `enrich.business` configured with bounded exponential retries; safe because all writes are upserts on natural keys.

### 7.5 Telegram approval waitpoint

- After Discover: set `status='awaiting_approval'`, generate `approval_token`, create a Trigger.dev **waitpoint token**, and `sendMessage` with an inline keyboard (`callback_data = approve:<token>` / `reject:<token>`, ≤64 bytes).
- Orchestrator calls `wait.forToken(token, { timeout: "24h" })` — durably suspended, no compute burned.
- **Webhook** `POST /api/telegram/webhook`: verify `X-Telegram-Bot-Api-Secret-Token` == `TELEGRAM_WEBHOOK_SECRET`; look up run by token; approve/reject → update run + **complete the waitpoint** + edit the message + `answerCallbackQuery`. Idempotent (second click is a no-op).
- The **dashboard** run-detail page also exposes Approve/Reject, hitting authenticated routes that complete the same waitpoint. Timeout → treated as reject (configurable).

## 8. Auth (decided: signed session cookie)

*Decided on the owner's behalf after the clarifying question was interrupted — flag to change to HTTP Basic Auth if a styled login page isn't wanted.*

- Single admin; **no user table**. `ADMIN_USERNAME` / `ADMIN_PASSWORD` in env, compared in constant time.
- A styled **login page** (built with the `frontend-design` skill) issues a signed, HTTP-only cookie: `payload {sub:"admin", iat, exp}` + `HMAC-SHA256(payload, SESSION_SECRET)`. `HttpOnly; Secure; SameSite=Lax`. Uses Web Crypto so it runs in Edge middleware (no extra dep).
- `middleware.ts` gates `/(dashboard)` pages and `/api/*` — **except** `/api/telegram/webhook`, which Telegram's servers must reach without a session. That route is instead secured by the secret-token header (and optionally a `chat.id` allowlist). Two gates, neither bypassing the other.
- No NextAuth/Clerk (single admin doesn't justify a provider; `TECH_STACK_GUIDE.md` §8).

## 9. Dashboard

Built with the `frontend-design` skill (beautiful UI). Pages and the data each needs:

1. **Runs list** `/(dashboard)/runs` — runs table (niche, location, trigger source, status badge, counters, timestamps). Data: `runsRepo.list({page, status?})` (counter reads only).
2. **Run detail** `/(dashboard)/runs/[id]` — status + progress bars; Approve/Reject when `awaiting_approval`; per-business table (`run_businesses` ⋈ `businesses`) with nested merged contacts. **Live updates** by polling `GET /api/runs/:id` every ~3s while non-terminal (no SSE/websockets, per hosting guide).
3. **Consolidated leads** `/(dashboard)/leads` — one row per merged contact (business, website, address, person, title, email + verification/confidence badge, source badges, socials). Filters: run, niche/city, source, verification, free-text on name/email/business. CSV export.
4. **New-run form** `/(dashboard)/runs/new` — neighborhood (optional), city, country (select), niche, max results (default 120), optional "save as preset". Zod-validated.
5. **Presets** `/(dashboard)/presets` (optional v1) — CRUD, toggle active, set cron, "Run now".
6. **CSV export** — `/api/runs/:id/export` (and a filtered `/api/leads/export`) stream `text/csv`.

## 10. External API Clients

All extend a shared `http.ts` wrapper: per-call timeout (`AbortController`), retry with exponential backoff + jitter on `429`/`5xx` (respecting `Retry-After`), and translation into **typed domain errors** before reaching Sentry. No secrets/PII logged.

- **Google Geocoding** — `GET /maps/api/geocode/json`; returns `{lat,lng}`; `ZERO_RESULTS → GeocodeNotFoundError`, `OVER_QUERY_LIMIT → GoogleRateLimitError`.
- **Google Places** — `POST /v1/places:searchText` with the exact legacy `X-Goog-FieldMask`; body `{pageSize:20, textQuery, locationBias.circle{radius:50000,center}, pageToken?}`; returns `{places[], nextPageToken?}`.
- **Hunter.io** — `GET /v2/domain-search?domain=&department=executive,management&limit=5`; returns `{organization, pattern, emails[]}`; `HunterRateLimitError` (retryable) vs `HunterQuotaExhaustedError` (non-retryable → fail Hunter, continue run); empty `emails` is not an error.
- **OpenRouter** — `POST /api/v1/chat/completions`, model `OPENROUTER_MODEL` (default `google/gemini-3-flash-preview:online`); system = lead-researcher prompt, `response_format` JSON schema; parse + Zod-validate, normalize `"NA"`→null; invalid JSON → `AiOutputParseError` (bounded retries). *(OpenRouter only — the legacy OpenAI parser node is dropped.)*
- **Telegram** — `sendMessage` / `editMessageText` / `answerCallbackQuery`; `setWebhook` (with `secret_token`) is one-time setup, not app runtime.

Typed errors live in `/lib/errors` (each an `Error` subclass with `code`, `retryable`, sanitized `context`).

## 11. Migrations & DB Workflow

- **Schema** in `src/lib/db/schema/` (one file per aggregate + `enums.ts`), re-exported from `index.ts`.
- `drizzle.config.ts` binds `dbCredentials.url` to **`DATABASE_URL_UNPOOLED`** (direct) — pooled PgBouncer breaks multi-statement DDL.
- `npx drizzle-kit generate` → versioned SQL + snapshot in `/drizzle` (committed, reviewed; never `db push` to prod). `npx drizzle-kit migrate` applies them, run in a **CI/deploy step**, not at app runtime and not inside a serverless function or Trigger.dev deploy.
- **Presets are data, not migrations** — an idempotent `src/lib/db/seed.ts` (`npm run db:seed`) upserts them by name.
- npm scripts: `db:generate`, `db:migrate`, `db:seed`, `db:studio`.

## 12. Folder Layout

```
/drizzle/                        generated SQL migrations (committed)
/drizzle.config.ts               uses DATABASE_URL_UNPOOLED
/trigger.config.ts               dirs: ["./src/trigger"]
/middleware.ts                   auth gate (excludes /api/telegram/webhook)
/src
  /app
    /(dashboard)/runs|runs/[id]|runs/new|leads|presets   pages
    /api/runs|runs/[id]/approve|reject|export|telegram/webhook   route.ts (thin)
    /login/page.tsx
    /actions/{runs,auth}.ts      server actions
  /lib
    /services   run · discover · enrich · ai-enrich · hunter-enrich · merge(PURE) · export · auth
    /db         /schema · client.ts (pooled+direct) · *.repo.ts · seed.ts
    /clients    google-geocoding · google-places · hunter · openrouter · telegram · http
    /errors     domain error types
    /validation Zod schemas (boundary)
    /env.ts     Zod-validated env, fail-fast at boot
  /trigger      orchestrate · discover.task · enrich.task · finalize.task · presets.schedule
  /types        domain.ts + external payload types
```

Layer rules: controllers ≤ ~20 lines (parse → service → respond); services take repos/clients by injection (testable, pure where possible); only `/lib/db` touches Drizzle; only `/lib/clients` touches external HTTP.

## 13. Environment Variables

| Var | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | App | Pooled Neon (app reads/writes) |
| `DATABASE_URL_UNPOOLED` | Migrations, tasks | Direct Neon (DDL + workers) |
| `GOOGLE_MAPS_API_KEY` | App/Tasks | Geocoding + Places |
| `HUNTER_API_KEY` | Tasks | Hunter domain-search |
| `OPENROUTER_API_KEY` | Tasks | OpenRouter completions |
| `OPENROUTER_MODEL` | Tasks | default `google/gemini-3-flash-preview:online` |
| `TELEGRAM_BOT_TOKEN` | Tasks/webhook | Send/answer approval messages |
| `TELEGRAM_CHAT_ID` | Tasks | Where to send prompts (+ allowlist) |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook | Validate `X-Telegram-Bot-Api-Secret-Token` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | App | Dashboard login |
| `SESSION_SECRET` | App/middleware | HMAC session signing |
| `TRIGGER_SECRET_KEY` / `TRIGGER_PROJECT_ID` | App/config | Trigger.dev |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | App/Tasks | Error + perf reporting |
| `APP_BASE_URL` | Tasks | Build links in Telegram messages |

All validated via `src/lib/env.ts` (Zod) at boot. `DATABASE_URL*` already provisioned in `.env.local`.

## 14. Observability & Error Handling

- **Sentry** for uncaught + deliberately-captured exceptions and perf traces, wired into the Trigger.dev task error handler. No separate logger (`TECH_STACK_GUIDE.md` §7).
- External I/O is wrapped so failures become **typed domain errors** with sanitized context before reaching Sentry; never swallow errors; scrub the `raw` contact payloads (PII) before capture.

## 15. Security

- **Rotate leaked secrets before any public push:**
  - The **Neon `neondb_owner` password** (exposed in this session's transcript).
  - A **live Google Maps API key hardcoded in `legacy/(1) Find Leads in Google Maps.json`** — a committed file, so it's in git history. Rotate **and** restrict the key (API + referrer/IP restrictions); consider scrubbing history.
- `.env.local` is gitignored; never log secrets/PII; parameterized queries only (Drizzle).
- Telegram webhook secured by secret-token header; dashboard/API behind the session cookie.

## 16. Risks, Edge Cases & Open Decisions

**Edge cases handled by design:** `nextPageToken` activation delay (durable wait); Places ~60-result ceiling vs `max_results`; businesses with no website (skip Hunter); AI returning prose/`"NA"` (parse-guard + normalize + bounded retries → `partial`); Hunter quota mid-run (fail per business, finish run on AI); approval timeout (→ reject); duplicate Telegram taps / webhook retries (idempotent via token + waitpoint state).

**Decisions made on the owner's behalf (interrupted question — flag to change):**
1. **Auth** → signed session cookie + login page (vs HTTP Basic Auth).
2. **Re-run policy** → reuse enrichment if < 30 days old, else re-enrich (vs always re-enrich, vs fully isolated runs).

**Open decisions to confirm:**
3. **Business dedupe scope** → recommended **global** (one `businesses` row per place + `run_businesses` link). Alternative: strict per-run isolation.
4. **Hunter contact volume** → keep legacy `limit:5` executive/management, or widen (more leads, more cost)?
5. **Provenance storage** → `jsonb` `field_sources` (recommended) vs a separate `contact_field_provenance` table.

## 17. Suggested Build Sequence

Deployable slices (each its own Linear issue):

1. **Foundation** — Next.js + Drizzle + Neon wiring, `env.ts`, schema + first migration, seed, Sentry.
2. **Auth** — middleware, login page, session cookie.
3. **Discover** — Google clients + `discover` task + runs/business persistence; a run can be started from a form and populate businesses.
4. **Approval gate** — Telegram client + waitpoint + webhook + dashboard approve/reject.
5. **Enrich** — Hunter + OpenRouter clients, parallel `enrich.business`, merge service, provenance.
6. **Dashboard** — runs list, run detail (live), consolidated leads, CSV export (frontend-design skill).
7. **Scheduling** — presets + Trigger.dev cron.
