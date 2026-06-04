# Project Context

Lead Finder — a three-stage pipeline that turns a niche + location into a list of enriched, contactable leads:
1. **Discover** — search Google Maps Places API for businesses matching a query (e.g. "family law attorney Houston TX"), paginate up to a configurable max.
2. **Enrich** — for each business, use an AI agent (via OpenRouter) to find the owner/decision-maker: name, title, email, LinkedIn, Instagram, Twitter, Facebook.
3. **Verify** — run each lead's website through Hunter.io to find and validate executive/management email addresses.

Legacy implementation lives in `legacy/` as n8n workflows. The new build replaces that with a proper app and durable storage.

## Stack

TypeScript + Next.js (App Router) + Trigger.dev, deployed on **Vercel**, with **Neon** (serverless Postgres) as the database.

> **Divergence from TECH_STACK_GUIDE.md:** the guide defaults to Supabase Postgres; we use **Neon** instead — serverless, scale-to-zero, native Vercel fit, cheaper at this workload. Approved by the project owner. Consequence: no bundled Supabase Auth/Storage/Studio, so dashboard auth is handled separately, and the data layer uses a Postgres driver (Drizzle or postgres.js), not `supabase-js`.

Defer to [TECH_STACK_GUIDE.md](./TECH_STACK_GUIDE.md) for all other tool decisions.

## Architecture Overview

Standard layout per `TECH_STACK_GUIDE.md`. Pipeline stages (Discover → Enrich → Verify) map to Trigger.dev tasks; each stage produces typed records written to **Neon Postgres** rather than Google Sheets.

## Related Guides

Read these before starting work. They override generic instincts.
- [`TECH_STACK_GUIDE.md`](./TECH_STACK_GUIDE.md) — tools, dependencies, and where work lives.
- [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) — code style rules. Mandatory on every file you touch.
- [`LINEAR_GUIDE.md`](./LINEAR_GUIDE.md) — task and issue workflow. **No issue, no work.** Linear project: `lean-mean-lead-finder-machine`.

---

# Commands

## Install
```bash
npm install
```

## Run
```bash
npm run dev
```

## Test
```bash
npm test
```

## Integration Tests (local, against a real Neon branch)

Run this procedure when you need to execute `*.integration.test.ts` locally (e.g. after implementing DB-touching code, or before opening a PR to `main`).

```bash
# NEON_PROJECT_ID and NEON_ROLE_NAME are set in .env.local (gitignored).
source .env.local

# 1. Create a throwaway Neon branch
npx neonctl branches create --name <branch-name> --project-id "$NEON_PROJECT_ID"

# 2. Get the direct connection string
CONN=$(npx neonctl connection-string \
  --branch <branch-name> \
  --project-id "$NEON_PROJECT_ID" \
  --role-name "$NEON_ROLE_NAME")

# 3. Apply migrations to the branch
DATABASE_URL_UNPOOLED="$CONN" npm run db:migrate

# 4. Run integration tests against it
TEST_DATABASE_URL_UNPOOLED="$CONN" npm test -- --project integration

# 5. Delete the branch when done
npx neonctl branches delete <branch-name> --project-id "$NEON_PROJECT_ID"
```

## Lint / Type Check
```bash
npm run lint && npx tsc --noEmit
```

## Format
```bash
npm run format
```

---

# How You Must Work

## General Behavior
- Prefer clarity over cleverness. See `CODING_STANDARDS.md` — apply it to every file you touch.
- Tasks are scoped to deployable feature slices, not micro-tasks. One issue covers a complete user-visible behavior; you determine the internal sub-tasks. Do not create separate issues for implementation steps.
- Make focused changes. One slice per task; no unrelated edits.
- Before writing code: state the approach, list edge cases, list the files you'll touch. Wait for confirmation.
- Before picking a tool, adding a dependency, or deciding where work lives, consult `TECH_STACK_GUIDE.md`. Deviating requires a stated reason and user approval.
- Before any task, follow the issue workflow in `LINEAR_GUIDE.md`. No issue, no work — including small fixes.
- If unsure about intended behavior, ask. Do not infer and proceed.
- Never modify files outside the scope of the current task without explicit instruction.

## SOLID
- One reason to change per class/function. If you need "and" to describe it, split it.
- Extend through composition and dependency injection. Don't modify existing classes to add new behavior.
- Subtypes must be substitutable for their base types.
- Narrow interfaces — don't force callers to depend on methods they don't use.
- High-level modules depend on abstractions, not concrete collaborators.

## Functions
- One thing per function. Question anything over ~30 lines.
- Max 4 positional parameters. Group related args into a typed object.
- No mutable default arguments.
- Pass typed structured data across boundaries, not raw dicts/maps.
- A class with no state should be module-level functions instead.

## Error Handling
- Never catch without naming the error type.
- Never silently swallow errors. Log or re-raise.
- Define domain-specific error types that carry context. Don't throw raw built-in errors from business logic.
- At service boundaries, use explicit error types rather than exceptions for expected failure states.
- Wrap all external I/O (network, filesystem, database) in explicit error handling.

## State
- Prefer immutable data. Use the language's immutability features wherever data shouldn't change after creation.
- Shared mutable state is a design problem. Isolate it explicitly and flag it when you introduce it.
- Separate pure functions from side-effectful ones. Mark side-effectful functions clearly.

## Testing
- TDD: failing test first, minimum code to pass, refactor. No implementation without a corresponding failing test.
- Every test must verify real behavior. Coverage-only tests are worse than no tests — they create false confidence.
- Cover: happy path, edge cases (empty, boundary, null), failure paths (exceptions, invalid input, external errors).
- Arrange / Act / Assert. One logical assertion per test.
- Mock at the boundary only — external I/O, third-party services. Never mock internal logic.
- Name tests after behavior: `user_cannot_log_in_with_expired_token`, not `test_login_fail`.
- Parametrize edge cases instead of duplicating test bodies.

**Test Strategy — run the right tests at the right time:**
- Feature branch: unit tests only.
- PR against `main`: full suite — unit + integration.
- Do not run integration tests to complete a task. If changed files touch integration-sensitive paths (DB, external APIs, auth), use judgment and run the relevant subset — but default to unit-only during active development.

## Documentation
- No inline comments unless the **why** is genuinely non-obvious from the code. Never explain what a line does — only why it does it this way.
- No multi-line comment blocks. No docstrings that restate the function signature. One short line max.
- Public APIs: document the contract (inputs, outputs, failure modes), not the implementation.
- Every `TODO`/`FIXME` references a ticket. No orphans.

## Security
- Never log secrets, tokens, or PII.
- Never hardcode credentials. Use env vars or a secrets manager.
- Validate external input at the boundary, before it reaches business logic.
- Always parameterized queries. Never interpolate user input into query strings.
- See `TECH_STACK_GUIDE.md` before introducing any new dependency.

## Performance
- Correct first. Don't preemptively optimize.
- When asked to optimize, profile first. Show the evidence.
- Treat N+1 queries as bugs. Fix at the data access layer.
- Put expensive operations behind abstractions that can be cached or made async.

## Language-Specific Rules

- Always annotate types. `any` is forbidden; if unavoidable, suppress on the same line with a comment explaining why.
- Prefer `interface` for object shapes; `type` for unions, intersections, and aliases.
- `strict: true` in tsconfig — no overrides.
- Import order: external packages → internal `@/` aliases → relative paths.
- Never use `namespace`; use ES modules.

---

# Hard Limits
- Never reduce test coverage to make a task easier.
- Never suppress linter or type-checker warnings without an explanatory comment on the same line.
- Never rename, restructure, or refactor code unrelated to the current task.
- Never add a dependency without justification (see `TECH_STACK_GUIDE.md` Section 8).
- Never produce code you cannot walk through line by line if asked.

---

# Definition of Done
Before marking any task complete:
1. Unit tests pass. (Integration tests run only on PR to `main`, not on feature branches.)
2. Lint, type check, and format pass — run every command in the `Commands` section above.
3. New functionality has corresponding tests written before the implementation.
4. Any new warning suppression has an explanatory comment on the same line.
5. No files outside the task scope were modified.
6. Code follows `CODING_STANDARDS.md` — no duplication of logic, no clever tricks, no unnecessary comments.
7. The related Linear issue has been updated per `LINEAR_GUIDE.md`.
