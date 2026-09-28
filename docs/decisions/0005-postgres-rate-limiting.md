# 0005 — Rate limiting in Postgres

## Decided

`lib/rate-limit.ts`, backed by the `RateLimit` table: fixed windows, one row per
key, counted and rolled over in a **single atomic upsert**. Rules live in
`RATE_LIMITS` and cover login (per IP and per account), registration, reset
request, reset redemption and change-password.

It **fails open**: a database error lets the request through.

## What it beat

An in-memory `Map`, which is the obvious implementation and is what most
tutorials show.

It does not work on Vercel. Each request may land on a **different, possibly
cold, serverless instance**, so an in-process counter is per-instance and
short-lived. An attacker does not need to defeat it; ordinary traffic
distribution already does. A limiter that silently limits nothing is worse than
none, because it is believed.

Redis or Upstash would be the conventional answer and is genuinely better suited
— it is built for this, with native TTLs. It was not chosen because it adds a
service, a dependency, credentials and a second failure mode to a project that
already has a Postgres it must talk to anyway. At this traffic, one indexed
upsert on a table with a primary-key lookup is not the bottleneck.

## Why the atomic upsert matters

Read-then-write would let two concurrent attempts both read the same stale count
and both write `count + 1`, which is exactly the situation a credential-stuffing
run creates. Counting and window rollover happen in one statement so that race
does not exist.

## Why it fails open

A closed failure means a database blip locks every user out of signing in. An
open failure means the limiter is briefly absent while the database is already
broken — at which point login is failing anyway.

The same reasoning applies to the Have I Been Pwned check in `lib/auth/pwned.ts`.
Both are **defence in depth, not the defence**: the real protections are bcrypt
at 12 rounds, enumeration resistance, and 2FA.

This is a deliberate choice with a real cost. If an attacker can induce database
errors, they can disable rate limiting.

## Rows accumulate

Expired rows are pruned opportunistically on a small fraction of requests, the
same approach `lib/auth/cleanup.ts` uses for expired tokens. **Do not add a cron
for this** — the work is cheap and can be arbitrarily late, which is exactly
what makes piggybacking on traffic the right shape for it.

This governs rate-limit pruning, not the application. The alert runner does have
a scheduler, for the opposite reasons — it is expensive and its whole value is
speed. See [0006](0006-alert-scheduling.md).

## What would change our mind

- **Traffic where the upsert is measurable** against connection-pool pressure.
- Needing something a fixed window cannot express — a sliding window, or a token
  bucket with burst allowance.
- Redis arriving for another reason. Once it exists, moving this to it is
  obvious; adding it *only* for this is not.

## See also

- [ARCHITECTURE.md › RateLimit](../ARCHITECTURE.md#ratelimit)
- [ARCHITECTURE.md › Someone is locked out](../ARCHITECTURE.md#someone-is-locked-out)
- [`specs/auth-email-and-oauth.md`](../specs/auth-email-and-oauth.md)
