
# CODING STANDARDS FOR AI DEV AGENTS

Apply these rules in every file you touch. No exceptions.

---

## 1. DRY — Don't Repeat Logic, Not Structure

Eliminate duplicated **logic**. Do not manufacture abstractions just to avoid duplicated **structure**.

> Three similar lines of code are not the same thing as three identical pieces of logic.

**❌ Over-abstracted:** Extracting a helper for two `for` loops that happen to look alike but operate on unrelated domains.

**✅ Correct DRY:** A database retry policy repeated in five service methods → extract once. A `user.full_name` string built in three places → extract once.

**Rule of thumb:** If removing the abstraction would require changing logic in more than one place, it's real duplication. If it would just require copying a line, it's structural similarity — leave it.

---

## 2. Readable Over Clever

Write code a teammate can understand in 10 seconds. If you need to think to parse it, rewrite it.

**❌ Clever:** `return not not user and user.active`

**✅ Readable:** `return user is not None and user.active`

**❌ Clever:** `result = [f(x) for x in data if x] or default`

**✅ Readable:**
```python
filtered = [f(x) for x in data if x]
return filtered if filtered else default
```

Explicit beats implicit. Verbose beats mysterious.

---

## 3. Minimal Comments — Why, Never What

Code explains **what**. Comments explain **why** — only when the reason is non-obvious from the code itself.

**Write a comment when:**
- A constraint isn't visible in the code (e.g. a third-party bug, a regulatory requirement, a subtle invariant)
- You're doing something that looks wrong but is intentionally so
- A performance trade-off sacrifices clarity for speed

**Never write a comment when:**
- The identifier name already says it
- You're restating what the next line does
- You're narrating the implementation ("loop through users", "check if null")

**❌ Noise:**
```python
# Get the user by ID
user = get_user(user_id)

# Check if user is active
if user.active:
```

**✅ Signal:**
```python
# Stripe requires idempotency keys on retries; reuse the original request ID
response = stripe.charge(amount, idempotency_key=original_request_id)
```

No multi-line comment blocks. No docstrings that restate the function signature. One short line max, only when the why is genuinely non-obvious.

---

## 4. Self-Documenting Names

Names are the primary documentation. A well-named function, variable, or class needs no comment.

**❌ Cryptic:** `d`, `tmp`, `data2`, `process()`, `handle()`

**✅ Clear:** `days_until_expiry`, `pending_invoices`, `send_password_reset_email()`

Rules:
- Booleans read as assertions: `is_active`, `has_permission`, `can_retry`
- Functions named for their effect or return value: `fetch_user_by_id`, `calculate_discount`
- No abbreviations unless universally known in the domain (`url`, `id`, `db` are fine; `usr`, `acct`, `calc` are not)

---

## 5. No Dead Code

Never commit commented-out code, unused imports, unreachable branches, or TODO stubs with no ticket reference.

**❌:** `# user = get_user_legacy(id)` left as a "just in case"

**✅:** Delete it. Git history exists for a reason.

Every `TODO` or `FIXME` must reference a ticket: `# TODO: ENG-123 — remove once legacy API is sunset`

---

## 6. No Defensive Boilerplate for Impossible Cases

Don't add error handling, fallbacks, or null checks for scenarios that cannot happen given your system's contracts. Trust framework guarantees and internal APIs.

**❌ Unnecessary:**
```python
if user is None:  # user was just fetched and would have raised if missing
    return
```

**✅ Correct:** Validate at the boundary (user input, external APIs). Trust the result inside the system.

Only validate where the contract is genuinely uncertain.