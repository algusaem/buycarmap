# 0004 — JWT sessions

Superseded by [0018](0018-better-auth.md), 2026-10-04: Better Auth's
server-side Postgres sessions replace the `passwordChangedAt` revocation
clock this ADR chose, so revocation is immediate rather than bounded by the
five-minute revalidation described below. Kept for its "what it costs" /
"what would change our mind" record of why that clock existed in the first
place.

## Decided

NextAuth with `session.strategy: "jwt"`. The session lives in a signed cookie;
there is no server-side session record. Expiry is 7 days, down from NextAuth's
30-day default.

Revocation is handled by a **clock**: `User.passwordChangedAt`. The `jwt`
callback stamps `pwdAt` at sign-in and re-reads the user row at most every five
minutes. If the password changed after the stamp — or the account is gone — it
**throws**, and NextAuth's session route clears the cookie.

## What it beat

Database sessions via the Prisma adapter, which the `Session` model is already
shaped for.

Database sessions are strictly better at revocation: delete the row, the session
is over, immediately. That is a real advantage and it was given up on purpose.

What decided it was **the cost per request**. On Vercel, every authenticated
request against a database session is a query against Postgres from a possibly
cold serverless instance, on a connection budget shared with the actual work. A
JWT is verified in-process with no I/O at all. For an app whose authenticated
surface is small — favorites, account settings — paying a round trip on every
request to make an uncommon event instant is the wrong trade.

The five-minute revalidation is the compromise: it costs one query per session
per five minutes rather than one per request, and bounds the revocation window to
something a user would describe as "it took a moment".

## What it costs

Stated plainly, because these are the sharp edges:

- **Revocation is not instant.** Up to five minutes. Anything claiming "sign out
  everywhere" should not promise better.
- **Every password-changing flow must bump `passwordChangedAt`.** Forget it and
  that flow silently signs nobody out. This is an invariant maintained by
  discipline, not by the type system, which makes it exactly the kind of thing
  that breaks.
- **The `Session` model is dead weight** — nothing writes to it — but the
  adapter's type contract requires it to exist. It looks like an oversight and
  is not.
- **Revoking one device is impossible.** The clock is per-user, so it is all
  sessions or none.

## What would change our mind

- A requirement for **per-device session management** — "sign out this phone".
  The clock cannot express it, and bolting on a device table would be most of a
  session store anyway.
- **Instant revocation** becoming a stated security requirement rather than a
  nice-to-have.
- Moving off serverless, which removes the per-request-query objection entirely.

## See also

- [ARCHITECTURE.md](../ARCHITECTURE.md#path-2--sign-in-and-revocation)
- [ARCHITECTURE.md › User](../ARCHITECTURE.md#user)
- [`specs/auth-email-and-oauth.md`](../specs/auth-email-and-oauth.md)
