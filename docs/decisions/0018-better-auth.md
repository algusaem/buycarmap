# 0018 — Better Auth and the permissions layer

Status: Accepted · Date: 2026-10-04 · Resolves ADR 0007 row 25 · Supersedes [0004](0004-jwt-sessions.md)

## Context

[ADR 0007](0007-adopt-core-rules.md) named row 25 as a deviation phase 11 closes: NextAuth 4 with
stateless JWT sessions and a hand-written revocation clock (`User.passwordChangedAt`, [0004](0004-jwt-sessions.md)),
and no central `can(user, action, resource)` permissions layer (`RULES.md` §10, §16; `STACK.md` §1,
§10) — the app has no roles, so every action repeated its own `userId === user.id` comparison.

[`docs/specs/core-better-auth.md`](../specs/core-better-auth.md) (BAUTH-1 through BAUTH-18) is the
spec; this records the decisions behind it.

## Decided

### Better Auth, keeping our stricter rules

Better Auth 1.7.7 replaces NextAuth: `lib/auth/auth.ts` is the one Better Auth instance (the only
module besides `lib/auth/auth-client.ts` that imports `better-auth`), backed by the Prisma adapter,
`lib/auth/hash.ts`'s bcrypt for password hashing/verification, and `lib/ids.ts`'s `uuidv7()` for new
ids. `app/api/auth/[...all]/route.ts` serves it; NextAuth, its route and `lib/auth/options.ts` are
gone.

Better Auth does not cover every property `docs/specs/auth-email-and-oauth.md` requires — it
creates the `User` row at sign-up (breaking verify-first registration, AUTH-2), its rate limiter
keys on IP and path only (no per-account lockout, AUTH-6), and its breach-check plugin fails closed
(AUTH-4). Those rules stay ours: registration, email verification, password reset and email change
keep their own server actions, token tables and behaviour unchanged (BAUTH-7).

**Disabled paths, amended 2026-10-04 after the security review.** The allowlist flipped from naming
the flows to disable to naming the ones to keep: `lib/auth/auth.ts`'s `ALLOWED_HTTP_PATHS` lists
exactly `/sign-in/social`, `/callback/:id`, `/sign-in/email`, `/get-session`, `/sign-out`, `/ok` and
`/error`, and `disabledPaths` is computed at module load as every other path a throwaway instance
built from the same options actually serves (`discoverServedPaths`) — not hand-maintained, so a
Better Auth upgrade that adds a path disables it automatically instead of leaving it reachable by
omission. `/change-password` is disabled by this now too: the `hooks.before` check that used to run
`validateNewPassword()`'s breach check for it was removed, since our own `changePassword` server
action already runs that check on every call, through `auth.api`, regardless of the HTTP path's
state. `/sign-in/email` is the one flow that stays both reachable and checked through
`hooks.before` — the per-account lockout — so a direct call to it is bound the same way our server
action is (BAUTH-6).

Better Auth's own `disabledPaths` check compares the raw request URL against the list as a literal
string, before any route matching — which never matches a parameterized path. A concrete request
like `/reset-password/<a-real-token>` sailed straight past `disabledPaths.includes("/reset-password/:token")`
and reached Better Auth's own token-reset handler for real, found during the review. `hooks.before`
now also refuses any path outside the allowlist whenever `ctx.request` is set — present only for a
request the HTTP router actually dispatched, never for our own server actions' direct `auth.api.*`
calls — and by the time any hook runs, `ctx.path` is already the endpoint's registered pattern, not
the raw URL, so this second check is not fooled by a concrete value standing in for `:token`.

### Server-side session creation and cookie signing

`server/auth/actions.ts`'s `signIn` server action calls `auth.api.signInEmail` only after our own
`authorizeCredentials` has already checked the password, the per-account lockout and (for a
two-factor account) the code — Better Auth never sees a request it would otherwise have to
re-validate from scratch. `lib/auth/auth.ts`'s `createSessionCookie`/`signSessionToken` mint a real
Better Auth session directly through `auth.$context`'s internal adapter and sign its cookie with
`better-call`'s own `serializeSignedCookie`, for the one flow (registration confirmation) that signs
a user in outside any request Better Auth's own router handled. Both exist so every session this
app issues — through the router or around it — is one Better Auth itself can read back with
`auth.api.getSession`, which is what makes revocation immediate rather than bounded by a clock.

### Postgres sessions, immediate revocation

Sessions are stored in Postgres (`session.storeSessionInDatabase`), with no cookie cache
(`cookieCache.enabled: false`). `lib/auth/session.ts`'s `getCurrentUser()` keeps its signature and
calls `auth.api.getSession` on every request, which is what [0004](0004-jwt-sessions.md)'s
five-minute revalidation window could not do: revoking a session (`signOutEverywhere`, a password
change or reset) ends it on the very next request, not whenever a cached cookie or a stale JWT claim
happens to expire. Authentication must not depend on Redis being up, so this stays Postgres rather
than moving to a session store that would add a dependency the sign-in path cannot afford to be
down.

### The `can()` permissions layer

`lib/auth/permissions.ts` exports `can(user, action, resource)` and `ownedBy(user)` — the one home
for authorization logic (`RULES.md` §10). There are no roles: every user-owned resource is readable
and writable only by its owner, so `can()` reduces to one ownership comparison per resource shape
(`user`, or `account` / `favorite` / `alert` / `recoveryCode` / `session` scoped by `userId`). Every
ownership check in `server/*/actions.ts`, `queries.ts` and `service.ts` goes through `can()` or
`ownedBy()` instead of comparing `userId` inline (BAUTH-17) — `/account`'s session list
(`listMySessions`/`revokeMySession`) is the first feature built directly on it.

### Auto-linking requires a verified local email, and never onto two-factor

A new OAuth provider auto-links onto an existing local account only when both sides' email are
verified (`accountLinking.requireLocalEmailVerified`) — otherwise control of a mailbox, or a
provider that releases an unverified address, could take over a local account by signing in with a
provider for the same address. `databaseHooks.account.create.before` additionally refuses an
implicit link (no live session on the request — the shape a sign-in callback's auto-link runs with)
for any local account with two-factor on, which `requireLocalEmailVerified` alone cannot express. An
explicit link made from `/account` while already signed in is never blocked this way, because the
owner can already clear the second factor from a session that already proved it.

**Two fixes from the 2026-10-04 security review, both in this same gate.** `account.accountLinking`
no longer names `google`/`github` in `trustedProviders` — that option made Better Auth skip checking
the provider's own `emailVerified` claim entirely for the listed providers
(`better-auth/dist/oauth2/link-account.mjs`'s `isTrustedProvider` bypass), which is exactly the
unverified-address takeover this gate exists to prevent; removing it means Better Auth's own check
now genuinely enforces both halves, so the hook's `mayAutoLink` (`lib/auth/linking.ts`) no longer
takes a `providerEmailVerified` flag at all — it only still checks two-factor, the one refusal Better
Auth has no option for. Separately, the hook used to read the legacy `users.email_verified`
DateTime — always null for a row Better Auth creates — instead of `emailConfirmed`, the boolean
column its own field mapping actually writes, and had no notion of "this `User` row was only just
created for this very sign-up": together, those two bugs refused the account-creation step of every
brand-new OAuth sign-up, leaving a committed `User` row with no way to ever sign in. The hook now
reads `emailConfirmed`, and allows unconditionally when the local user has no password and no other
`accounts` row — the shape only a first sign-up through this very provider can have.

### Better Auth's two-factor plugin, and AUTH-8 withdrawn

Two-factor moves onto Better Auth's own `twoFactor` plugin (`lib/auth/auth.ts`), with AUTH-9's
parameters (SHA-1, 6 digits, 30s step, ±1 step drift — the plugin's own fixed defaults) and today's
backup-code count. Its `user.twoFactorEnabled` field and `two_factors` table map directly onto
columns and a table this phase's migration already creates under those exact names, so no renaming
is needed in `lib/auth/auth.ts`'s field mapping.

**The plugin now runs enrolment and sign-in, not just the registration above.**
`server/two-factor/actions.ts`'s `startTwoFactorSetup`, `confirmTwoFactorSetup`, `disableTwoFactor`
and `regenerateRecoveryCodes` call the plugin's own `enableTwoFactor`, `verifyTOTP`,
`disableTwoFactor` and `generateBackupCodes` endpoints directly, rather than `lib/auth/two-factor/*`
(deleted). Sign-in's second step is the same split BAUTH-3 uses for the password: `server/auth/
actions.ts`'s `signIn` calls `auth.api.signInEmail`, and a two-factor account resolves to
`twoFactorRedirect` instead of a session — the plugin sets its own challenge cookie through
`nextCookies` — which `verifySignInTotp`/`verifySignInBackupCode` then finish by calling the
plugin's `verifyTOTP`/`verifyBackupCode`. `TWO_FACTOR_ENCRYPTION_KEY` is gone: the plugin encrypts
with `BETTER_AUTH_SECRET`, which every environment already requires, so two-factor is always
available rather than hidden behind a missing key.

The plugin keeps no replay store: a TOTP code stays valid for the rest of its 30-second window even
once accepted, where our own `twoFactorLastStep` column refused a second use of the same step.
**AUTH-8, "a TOTP code cannot be reused inside its own window", is withdrawn** as of 2026-10-04
(`docs/specs/auth-email-and-oauth.md`) — the owner accepted this loss in exchange for less code of
our own to maintain. Its test is deleted rather than kept red, and `spec:check`'s checklist format
(`- [ ]`/`- [x] <id> …`) requires a test for every criterion it still recognises as declared, so the
withdrawn line drops its checkbox entirely rather than keeping one with nothing behind it.

### Two-factor re-enrolment at cutover

The migration switches `twoFactorEnabled` off for every user who had the old `twoFactorEnabledAt`
set — the new column starts `false` for everyone, including them, rather than attempting to migrate
a secret the old column encrypted under a different key into the plugin's own format. Each affected
user is mailed once, in their own locale, through a new `TwoFactorResetEmail` component
(`server/two-factor/reenrol.ts`'s `notifyTwoFactorReset`, run by `scripts/notify-2fa-reset.mjs` /
`pnpm auth:notify-2fa-reset`), asking them to set it up again from `/account`. The script is
idempotent: a new `users.two_factor_reset_notified_at` column (added by its own expand-only
migration, `20261004000100_two_factor_reset_notice`) is set right after sending, so a second run
finds nothing left to notify.

### Other fixes from the 2026-10-04 security review

**The two-factor sign-in challenge takes no email.** `verifySignInTotp`/`verifySignInBackupCode`
(`server/auth/actions.ts`) used to accept one, only to scope a per-account rate-limit key
(`two-factor:user:<id>`) — but the signed two-factor challenge cookie Better Auth itself set is what
actually identifies the account, so that email was never a security decision, only a free way for a
caller to enumerate which addresses have two-factor on, and to lock a real account's budget out from
a different IP than its own. A new `twoFactorPerIp` rule (20 per 15 min, `server/rate-limit/service.ts`)
is consumed on every call instead, on top of the plugin's own per-challenge and per-account lockout
(both bound to the cookie). `LoginForm`'s second step no longer sends one either.

**A failed sign-in was counted twice.** `lib/auth/auth.ts`'s `hooks.after` already consumes
`loginPerEmail`'s budget once for every failed `/sign-in/email` call; `signIn`'s own `catch` block
consumed it a second time, so 4 real failures counted as 8 and tripped the 8-attempt lockout before
a legitimate 5th attempt ever ran. The second consumption is gone.

**Logging redaction gained three paths.** `ipAddress`, `userAgent` and `backupCodes` (plus their
`*.`-nested forms) are now in `lib/logger.ts`'s `REDACT_PATHS` — an IP or user agent is personal data
(`RULES.md` §12) and a backup code is a credential exactly like a password or TOTP code, and none of
the existing patterns matched any of the three. Better Auth's own `logger` option is now routed
through this same Pino logger too, so its diagnostic lines get the same JSON formatting,
request-id correlation and redaction as everything else, rather than writing straight to the console.

**BAUTH-17 reaches `server/favorites/*` and `server/alerts/*`.** Their `service.ts` ownership
filters (`where: { userId, ... }`) now build that filter through `ownedBy()`
(`lib/auth/permissions.ts`) instead of a bare object literal — the create payloads that also set
`userId` on a new row are unchanged, since `ownedBy()` is a query filter, not a write.

**`BETTER_AUTH_SECRET` reuses the current `NEXTAUTH_SECRET` value**, not a freshly generated one —
the alert unsubscribe tokens are HMACs keyed on it, and a new secret would stop every link already
sent from matching its stored hash. This was already the plan (see Contracts in
[`docs/specs/core-better-auth.md`](../specs/core-better-auth.md)); the review's fix was recording it
here and in `docs/ARCHITECTURE.md`/`README.md`, which still named the old variable.

**A second review pass fixed three more gaps.** The `credential` accounts row BAUTH-14's dual-write
adds for every password user was already excluded from the two-factor/email checks above, but not
from `/account`'s own "connected accounts" list and count, nor from `unlinkAccount`
(`server/account/actions.ts`) — nothing stopped a direct call from deleting it, which would have
broken `auth.api.signInEmail` (which reads this row, not `User.password`) while the account page
kept showing a password as set. `findAccountOverview` now excludes `provider = "credential"` from
what it returns, `ConnectedAccounts` filters it again regardless of what it is passed, and
`unlinkAccount` refuses it outright with the same `lastSignInMethod` code, before ever reaching the
"would strand the account" check — which itself now counts OAuth rows only, never the credential
row, against whether a password exists. Separately, BAUTH-9 is amended: a brand-new user created
through a provider is now allowed only when the provider itself reports the email as verified.
`databaseHooks.user.create.before` (`lib/auth/auth.ts`) refuses the user creation itself when it does
not, before Better Auth's adapter ever writes the row — cleaner than refusing in the account-creation
hook after a `User` row already exists with nothing there to delete it, which is what the first
review pass's own brand-new-sign-up bypass did, with no email check of its own. Finally, Better
Auth's `logger` option, routed through Pino in the first pass, still logged every argument Better
Auth passed it; it now keeps only an `Error` instance, as Pino's own `err` key, and drops everything
else — Better Auth passes raw error objects, and on at least one path (`link-account.mjs`'s "Unable
to link account") a second argument alongside them that could carry request data.

### Expand-only migration, and the contract issue

Everything this phase needs — the columns Better Auth's adapter reads under mapped names
(`email_confirmed`, `two_factor_enabled`, `accounts.password`, the session IP/user-agent columns),
the new `verifications` and `two_factors` tables (including the plugin's own enrolment-verified flag
and failed-attempt lockout columns, added with the table rather than in a second migration), and one
backfilled `credential` account per existing password — lands in `20261004000000_better_auth`,
compatible with the previous code (`RULES.md` §11). The old columns and tables
(`users.password`, `users.email_verified`, `users.password_changed_at`, `verification_tokens`,
`two_factor_recovery_codes`, `users.two_factor_secret`) stay until a later PR drops them — tracked in
[issue #62](https://github.com/algusaem/buycarmap/issues/62)
rather than attempted here, the same expand/contract split [0017](0017-upstash-qstash-react-email.md)'s
`RateLimit` table followed.

## What it beat

**Migrating the old TOTP secrets into the plugin's own encrypted format at cutover**, rejected
because the two use different keys and schemes; re-enrolling from a fresh QR code is simpler and no
less secure than a silent migration of secret material across formats.

**A home-grown two-factor replay guard kept alongside the plugin**, rejected as exactly the kind of
parallel system this migration exists to close — the owner chose less code over keeping AUTH-8.

## What it costs

- **AUTH-8 is gone.** A TOTP code observed over someone's shoulder stays valid for the rest of its
  30-second window, where it previously could not be reused at all.
- **Every user who had two-factor on re-enrols once**, from a fresh QR code — their old backup
  codes and secret are not carried over.
- **The old auth columns and tables are dead weight until the follow-up PR** that drops them.

## What would change our mind

- Better Auth shipping its own replay store for the `twoFactor` plugin — would reopen AUTH-8.
- A requirement to migrate 2FA secrets across the cutover without re-enrolment — would need a shared
  encryption scheme between the old and new storage, not attempted here.

## See also

- [docs/specs/core-better-auth.md](../specs/core-better-auth.md) — BAUTH-1 through BAUTH-18
- [docs/specs/auth-email-and-oauth.md](../specs/auth-email-and-oauth.md) — AUTH-1 through AUTH-15,
  AUTH-8 withdrawn
- [ARCHITECTURE.md › Authentication](../ARCHITECTURE.md#authentication)
- [0004](0004-jwt-sessions.md) — superseded by this ADR
- [0007](0007-adopt-core-rules.md) — row 25, resolved by this phase
