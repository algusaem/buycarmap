# Better Auth and the permissions layer (migration phase 11)

Key: BAUTH
Status: Implemented
Last updated: 2026-10-04

---

## Problem

Authentication runs on NextAuth 4 with stateless JWT sessions and a hand-written revocation clock (`passwordChangedAt`, ADR 0004). Authorization is an ownership check repeated in every action, with no central layer (`docs/decisions/0007-adopt-core-rules.md` row 25). The core asks for two things:

- **Better Auth with server-side sessions** (`STACK.md` §10). A revoked session ends on the next request, and a user can list and revoke their sessions.
- **One permissions layer**, `can(user, action, resource)` (`RULES.md` §10).

Better Auth 1.7.7 does not cover everything `docs/specs/auth-email-and-oauth.md` requires. Measured against the code, on 2026-10-04:

- It creates the `User` at sign-up, which breaks verify-first registration (AUTH-2).
- Its rate limiter keys on IP and path only, so there is no per-account lockout (AUTH-6).
- Its breach-check plugin fails closed (AUTH-4).
- Its email-change and verification links are GET-consumable JWTs.

The owner decided on 2026-10-04 to keep those rules in our code, and to adopt Better Auth's `twoFactor` plugin even though it does not stop a TOTP code being reused inside its window (AUTH-8).

This is phase 11 of ADR 0007: row 25.

## Acceptance criteria

`unit` means a Vitest test with no database; `node` means a `*.node.test.ts` or `*.integration.test.ts`; `component` means a component test; `e2e` means Playwright.

### Sessions and sign-in

- [x] BAUTH-1 · node — `lib/auth/auth.ts` exports one Better Auth instance. It is the only module that imports `better-auth`, apart from `lib/auth/auth-client.ts`.
  - Database: the Prisma adapter.
  - Sessions: stored in Postgres (`session.storeSessionInDatabase`), with no cookie cache.
  - Passwords: hashed and verified by `lib/auth/hash.ts` (bcrypt), so every existing password keeps working.
  - Ids: new ids come from `lib/ids.ts`'s `uuidv7()`.
  - Plugins: `nextCookies` and `twoFactor`.
  - `app/api/auth/[...all]/route.ts` serves it. NextAuth, its route and its options module are removed.
- [x] BAUTH-2 · node — `getCurrentUser()` in `lib/auth/session.ts` keeps its signature and returns `null` for no session, an expired session or a revoked session. Revoking a session through `signOutEverywhere`, a password change or a password reset ends it on the very next request. AUTH-5 is now proven by the session row disappearing.
- [x] BAUTH-3 · node — Sign-in with email and password goes through our server action, which calls `auth.api.signInEmail`.
  - It keeps AUTH-6's per-account lockout and today's per-IP limit, using `server/rate-limit/service.ts`.
  - It keeps the identical generic failure response.
  - A two-factor account gets the `twoFactorRedirect` step, not a session (AUTH-7).
- [x] BAUTH-4 · node — `/account` lists the user's active sessions, with device, browser and last use, and can revoke one, or every other one.
- [x] BAUTH-5 · node — `proxy.ts` checks for the session cookie with `getSessionCookie` from `better-auth/cookies`. It is a presence check for redirects only; authorization stays in `getCurrentUser()`, as `CLAUDE.md` › Authentication requires.

### Direct endpoint safety

- [x] BAUTH-6 · node — No Better Auth HTTP endpoint lets a client skip a rule our server actions enforce.
  - Only the paths the browser needs stay reachable over HTTP, and every other Better Auth path is in `disabledPaths`. Our server actions still reach the disabled ones through `auth.api`, where our rules wrap them. The allowlist (amended 2026-10-04 after the security review):
    - `/sign-in/social` and `/callback/:id` (Google and GitHub);
    - `/sign-in/email` (the no-email registration fallback signs in through the client);
    - `/get-session`, `/sign-out`, `/ok` and `/error`.
  - `/sign-in/email` called directly runs the same checks as our action through `hooks.before`: today's per-IP limit and the per-account lockout. Each failed attempt is counted once.
  - Better Auth's own rate limiter is enabled in every environment where Upstash is configured, stores its counters in Upstash through `lib/platform/rate-limit.ts`, and uses today's per-IP values.
  - A test lists every path the instance serves over HTTP and fails on any path outside the allowlist. A test calls `/sign-in/email` directly, with the right password, after 8 failures, and is refused because of the lockout.

### Flows that stay ours

- [x] BAUTH-7 · node — Registration, email verification, password reset and email change keep their server actions, token tables and behaviour, so AUTH-1, 2, 3, 4, 11, 13 and 15 pass unchanged.
  - Where a flow signs the user in (registration confirmation), it creates the session through Better Auth.
  - Where it sets a password, it writes the `credential` account's hash.
  - A password reset revokes every session, as AUTH-5 requires.

### OAuth and linking

- [x] BAUTH-8 · node — Google and GitHub sign-in work through Better Auth's social providers, on the callback paths they use today (`/api/auth/callback/google`, `/api/auth/callback/github`), so the providers' consoles need no change.
- [x] BAUTH-9 · node — Linking follows AUTH-12 and the owner's 2026-10-04 decision:
  - a new provider is linked automatically only when the provider itself reports the email as verified, so no provider is listed in `trustedProviders`, and the local account's email is verified (`requireLocalEmailVerified`);
  - a provider is never linked automatically to an account with two-factor on;
  - a first sign-in with a provider for an address with no local account, whether through the OAuth callback or any other provider sign-in, creates the user and its provider account only when the provider reports the email as verified; ID-token sign-in is disabled, so nobody can claim an address through a provider that never verified it. Later sign-ins with that provider keep working. Amended 2026-10-04;
  - explicit linking from `/account` is not offered: no UI links a provider today, and `/link-social` is not on the allowlist. Amended 2026-10-04.
  - The tests drive the real OAuth callback, with the provider's token and userinfo endpoints faked through MSW.
- [x] BAUTH-10 · component — Unlinking keeps AUTH-14: the only remaining way to sign in cannot be disconnected.

### Two-factor

- [x] BAUTH-11 · node — Two-factor uses Better Auth's `twoFactor` plugin (owner's decision, 2026-10-04):
  - TOTP is SHA-1, 6 digits, 30 s and ±1 step (AUTH-9);
  - backup codes work once (AUTH-10);
  - enrolment, confirmation, disabling and regenerating codes keep today's UI flow and copy.
- [x] BAUTH-12 · node — AUTH-8, "a TOTP code cannot be reused inside its own window", is withdrawn: the plugin has no replay store. The owner accepted the loss on 2026-10-04. The auth spec marks AUTH-8 withdrawn, with the date and the reason, and its test is deleted.
- [x] BAUTH-13 · node — Users who had two-factor on before the cutover have it switched off by the migration and receive one email, in their locale, asking them to enrol again. The rehearsal on a production copy reports how many users that is.

### Data

- [x] BAUTH-14 · node — One migration, compatible with the previous code (expand only):
  - adds the columns Better Auth needs: `users.email_confirmed` (boolean, backfilled from `email_verified IS NOT NULL`), `users.two_factor_enabled`, `accounts.password`, `accounts.access_token_expires_at`, `accounts.refresh_token_expires_at`, and `sessions.ip_address` and `user_agent`. Better Auth's `token`/`expiresAt` are mapped onto the existing `sessions.session_token`/`expires` columns in Prisma (lib/auth/auth.ts), not added as new ones — this corrects the criterion's original wording, which listed them as additions;
  - adds the new `verifications` and `two_factors` tables;
  - gives `accounts.type` a default;
  - inserts one `credential` account per user with a password, with `provider = "credential"`, `provider_account_id = users.id` and `password = users.password` (the existing `accounts` columns, mapped to Better Auth's `providerId`/`accountId` in Prisma, not renamed).

  The old columns and tables (`users.password`, `users.email_verified`, `verification_tokens`, `two_factor_recovery_codes`, the NextAuth-only session columns) stay until a later PR drops them, tracked in an issue.
- [x] BAUTH-15 · node — Every user is signed out once at cutover, because NextAuth's cookies are not Better Auth's. Signing in again works with the same password. The PR states it.

### Permissions

- [x] BAUTH-16 · unit — `lib/auth/permissions.ts` exports `can(user, action, resource)` and `ownedBy(user)`, the only home for authorization logic (`RULES.md` §10).
  - `action` is `"read"`, `"update"` or `"delete"`.
  - `resource` is `{ type: "user"; id }` or `{ type: "account" | "favorite" | "alert" | "recoveryCode" | "session"; userId }`.
  - `can` allows only when the resource belongs to the user.
  - `ownedBy` returns `{ userId: user.id }` for query filtering.
- [x] BAUTH-17 · node — Every ownership check in `server/*/actions.ts`, `queries.ts` and `service.ts` goes through `can()` or `ownedBy()`. A test fails on an inline `userId === user.id` comparison outside `lib/auth/permissions.ts`. Each protected action keeps a test proving another user is refused (`RULES.md` §10).

### Docs and configuration

- [x] BAUTH-18 · unit — The docs and configuration record the change:
  - `BETTER_AUTH_SECRET` replaces `NEXTAUTH_SECRET` and `BETTER_AUTH_URL` replaces `NEXTAUTH_URL`, in the env schema and `.env.example`, and `TWO_FACTOR_ENCRYPTION_KEY` is removed;
  - the alert unsubscribe HMAC keys on `BETTER_AUTH_SECRET`, and links already sent keep working because only their hash is stored;
  - ADR 0018 records Better Auth, the kept rules, the disabled paths, the withdrawn AUTH-8, Postgres sessions and the permissions layer, and marks ADR 0004 superseded;
  - `docs/ARCHITECTURE.md` › Authentication and `CLAUDE.md` › Authentication describe the new system;
  - ADR 0007 row 25 ends `Resolved in phase 11`.

## Worked examples

- **BAUTH-2**: user U is signed in on two browsers, and changes the password in one. The other browser's next request gets `getCurrentUser() === null`.
- **BAUTH-3**: nine wrong passwords for `ana@example.test` from nine different IPs, and the tenth attempt is refused even with the right password, because `loginPerEmail` allows 8 per 15 min. This is today's value.
- **BAUTH-6**:
  - `POST /api/auth/sign-up/email` → 404;
  - `POST /api/auth/change-password` with a breached password → refused with the same code our action returns.
- **BAUTH-9**: a local account `ana@example.test` with two-factor on; a Google sign-in for the same verified address → not linked, and no session.
- **BAUTH-13**: the rehearsal reports N users with two-factor on before the cutover. After the migration, `two_factor_enabled = false` for those N users, and one email is queued per user.
- **BAUTH-14**: user U with `password = $2b$12$…` → one `accounts` row with `provider = "credential"`, `provider_account_id = U.id` and `password = $2b$12$…`. Signing in with the old password succeeds.
- **BAUTH-16**:
  - `can(ana, "delete", { type: "favorite", userId: ana.id })` → `true`;
  - `can(ana, "delete", { type: "favorite", userId: bob.id })` → `false`.

## Data model

See BAUTH-14. Expand only; the contract steps are a later PR.

## Permissions

- **Owner-only.** No roles exist: every user-owned resource is readable and writable only by its owner, through `can()`.
- **Token-bearer flows.** Password reset redemption, email confirmation and alert unsubscribe stay authorised by their single-use tokens, not by a session.

## Edge cases

- **A user signed in at cutover.** They are signed out once (BAUTH-15).
- **In-flight links.** Reset, verification and email-change links sent before the cutover keep working, because those flows and their token tables do not change.
- **An OAuth-only user.** They still cannot request a password reset, as today, because the reset flow stays ours.
- **A user without a verified email** created by the no-email fallback cannot be auto-linked to Google (BAUTH-9). They keep signing in with their password; explicit linking is not offered.
- **Better Auth's `version` blindness.** Better Auth writes do not bump `version`. Profile edits keep going through our `updateProfile` action (DATA-15), which does.

## Out of scope

- **Dropping the old auth columns and tables**: a later PR.
- **Passkeys, magic links and other Better Auth plugins.**
- **Roles and admin.** None exist.

## Contracts

- **New dependency**: `better-auth`, named in `STACK.md` §1. `next-auth` is removed.
- **Env**:
  - new: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`;
  - removed: `NEXTAUTH_SECRET`, `NEXTAUTH_URL` and `TWO_FACTOR_ENCRYPTION_KEY`.
- **Owner's manual actions**:
  1. Set `BETTER_AUTH_SECRET` to the current `NEXTAUTH_SECRET` value, not a new one. The alert unsubscribe tokens are HMACs keyed on it, and new digests for existing alerts must keep matching their stored hashes (amended 2026-10-04). and `BETTER_AUTH_URL` (`https://buycarmap.vercel.app`) in Vercel, Production and Preview.
  2. Remove the old variables after the deploy.
- **Rehearsal.** The migration is rehearsed on a Neon branch of production before merge, as in phase 8.
- **Approval.** This approved spec authorises the auth changes (`RULES.md` §1) and the withdrawal of AUTH-8.

## Decisions and rationale

### Better Auth, keeping our stricter rules (owner's decision, 2026-10-04)

Better Auth provides the session, sign-in, OAuth and linking machinery, and server-side, revocable sessions. Verify-first registration, the per-account lockout, the fail-open breach check and the POST-only email confirmation are security properties it does not have, so they stay ours. Its endpoints for those flows are disabled, so they cannot be called around us.

### Better Auth's two-factor plugin (owner's decision, 2026-10-04)

Less code of our own, at the cost of TOTP replay protection inside a 30-second window, and of re-enrolment for anyone who had two-factor on.

### Auto-linking requires a verified local email (owner's decision, 2026-10-04)

This prevents taking over an unverified local account by signing in with a provider for the same address.

### Sessions in Postgres

Authentication must not depend on Redis being up, and the session row is what makes revocation immediate.
