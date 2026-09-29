# Auth completion — transactional email, password reset, OAuth

Key: AUTH
Status: Implemented
Last updated: 2026-09-28

---

## Problem

Authentication needed completing — transactional email, password reset and OAuth — on a security layer where a silent regression would be a security incident rather than a bug.

## Acceptance criteria

Fifteen load-bearing properties. These are not everything auth does — that is
several hundred tests — but they are the claims where a silent regression would
be a security incident rather than a bug.

- [x] AUTH-1 · node — Registering reveals nothing about whether an address already has an account
- [x] AUTH-2 · node — No account exists until the address is confirmed from the inbox
- [x] AUTH-3 · unit — A password that fails the strength policy is rejected
- [x] AUTH-4 · unit — A breach-service outage does not block sign-up
- [x] AUTH-5 · node — Changing a password revokes every session issued before it
- [x] AUTH-6 · unit — Failed sign-ins are counted per account and cleared on success
- [x] AUTH-7 · unit — A correct password alone does not sign in an account with two-factor enabled
- [x] AUTH-8 · node — A TOTP code cannot be reused inside its own window
- [x] AUTH-9 · unit — One step of clock drift either way is accepted
- [x] AUTH-10 · node — A recovery code works exactly once
- [x] AUTH-11 · node — A password reset leaves two-factor enrolment intact
- [x] AUTH-12 · node — OAuth cannot auto-link a new provider to an account with two-factor enabled
- [x] AUTH-13 · node — An email change requires the current password and is confirmed from the new address
- [x] AUTH-14 · component — The only remaining way to sign in cannot be disconnected
- [x] AUTH-15 · node — Expired tokens are pruned from every token table

## Worked examples

- **AUTH-1** — Email configured; register("Ada", ada@example.com, "harbour-lentil-quilt" ×2) → { success: true, pending: true }, no user.create, one pendingRegistration.create; a taken address returns exactly the same result and also sends one email.
- **AUTH-2** — Pending pending-1 (ada@example.com, hash "already-bcrypt-hashed", name "Ada", token "a-raw-confirmation-token", expires in 1 h); verifyRegistration("a-raw-confirmation-token") → { success: true, email: "ada@example.com" }, user created with that email, that hash, name "Ada" and emailVerified set.
- **AUTH-5** — user-1, current password "the-old-password"; changePassword → "harbour-lentil-quilt" → { success: true }, password and passwordChangedAt updated, session.deleteMany({ where: { userId: "user-1" } }).
- **AUTH-6** — ada@example.com, password "wrong" → rate limit consumed on key "login:email:ada@example.com" with limit 8; password "correct" → that key is reset.
- **AUTH-7** — ada@example.com with 2FA enabled, password "correct", no code → throws "totpRequired".
- **AUTH-8** — (clock 1_800_000_000_000 ms, current step 60_000_000 (1_800_000_000_000 / 30_000)). twoFactorLastStep = 60_000_000, code for step 60_000_000 → { valid: false, method: null }, nothing updated; twoFactorLastStep = 59_999_999, code for step 60_000_000 → { valid: true, method: "totp" }. The code itself is derived from a random secret, so no literal code exists.
- **AUTH-10** — Recovery code "ABCDE-FGHJK-MNPQR" → row rc-1 (user-1, usedAt null) → { valid: true, method: "recoveryCode" } and marked used only where usedAt is null; once used → { valid: false, method: null }.
- **AUTH-11** — Valid reset token "a-raw-reset-token" for user-1, new password "harbour-lentil-quilt" → the user update touches exactly password and passwordChangedAt; no two-factor field.
- **AUTH-12** — ada@example.com with 2FA enabled and no linked accounts; OAuth signIn via google (providerAccountId g-1) → false; with no existing user → true.
- **AUTH-13** — user-1 ada@example.com; requestEmailChange("new@example.com", "the-current-password") → the link goes to new@example.com, never ada@example.com; a wrong current password → { success: false, error: "currentPasswordIncorrect" }, no email.
- **AUTH-14** — providers ["google"], hasPassword false → Disconnect disabled, text "This is your only way to sign in. Set a password before disconnecting it."

## Data model

`prisma/migrations/20260801120000_auth_hardening/` — **not yet applied.** Local
and production share one Neon database (see the `neon-db-setup` memory), so
review it before running `prisma migrate deploy`.

It renames `User.avatarUrl` to `image` (the adapter writes the OAuth picture to
that exact field), makes `password` nullable for OAuth-only accounts, adds
`emailVerified` and `passwordChangedAt`, reshapes the never-written `Session`
table to the adapter's column names, and adds `Account`, `VerificationToken`,
`PasswordResetToken`, `EmailVerificationToken`, `PendingRegistration` and
`RateLimit`.

## Permissions

Every action that touches user data calls `getCurrentUser()` from
`lib/auth/session.ts`; `proxy.ts` only decodes the JWT and cannot see
revocations, so it is UX, not a security boundary (see Decisions › Cross-cutting
conventions). Changing a password revokes every session issued before it
(AUTH-5).

An account with two-factor enabled cannot be signed in with a correct password
alone (AUTH-7), a password reset leaves its two-factor enrolment intact
(AUTH-11), and OAuth cannot auto-link a new provider to it (AUTH-12). An email
change requires the current password and is confirmed from the new address
(AUTH-13). The only remaining way to sign in cannot be disconnected (AUTH-14).
Changing a password requires the current one, and deleting the account requires
a typed confirmation plus the password (see Decisions › What is built › Account
management).

## Edge cases

- AUTH-1 — registering an address that already has an account.
- AUTH-3 — a password that fails the strength policy.
- AUTH-4 — a breach-service outage.
- AUTH-6 — repeated failed sign-ins, then a success.
- AUTH-7 — a correct password with no second factor.
- AUTH-8 — a TOTP code reused inside its own window.
- AUTH-9 — one step of clock drift either way.
- AUTH-10 — a recovery code used a second time.
- AUTH-14 — disconnecting the only remaining way to sign in.
- AUTH-15 — expired tokens.
- A database error in the rate limiter — see Decisions › What is built › Rate limiting.
- Missing, expired and already-used reset tokens — see Decisions › What is built › Password reset (Iteration B).
- An email provider error, or email unconfigured — see Decisions › What is built › Email (Iteration A).
- A mail scanner fetching the confirmation link — see Decisions › Registration enumeration: closed by verify-first signup.
- Registration with no email configured — see Decisions › The remaining case: no email configured.
- Sign-in with an unverified address — see Decisions › Iteration C — Email verification.

## Out of scope

Nothing is excluded beyond what the other specs own: favorites, alerts and search are specified in their own files.

## Contracts

### Configuration you must supply

Nothing below is required for the app to run — each degrades cleanly — but
without email, password reset is unusable **and registration falls back to a
mode that leaks whether an address is registered** (see Decisions and rationale › Registration enumeration).

```
RESEND_API_KEY=...      # https://resend.com → API Keys
EMAIL_FROM="BuyCarMap <no-reply@yourdomain.com>"   # domain must be verified (SPF/DKIM)
APP_URL=https://...     # base for links inside emails

GOOGLE_CLIENT_ID=...  GOOGLE_CLIENT_SECRET=...
GITHUB_ID=...         GITHUB_SECRET=...
```

OAuth callback URLs to register in each console, for both local and production:
`${APP_URL}/api/auth/callback/google` and `.../github`.

Full list with commentary in `.env.example`.

## Decisions and rationale

### About this spec

> Converted to the current spec template in Wave C of the adoption plan. The
> prose below is the original and is unchanged — it was already rationale-first,
> which is what the template exists to produce. What it lacked was a criteria
> table, so the security properties it asserts in paragraphs could not be tied
> to the tests that hold them up. That table is the Acceptance criteria
> section; the original sections follow.

### What is built

The pages, the backends behind them, and the security layer they sit on are all
built. What remains is configuration you have to supply, plus one deliberate
gap documented under Registration enumeration below.

#### Password policy (NIST SP 800-63B)
Length and blocklists rather than composition rules. Three layers:

| Layer | File | Rejects |
| --- | --- | --- |
| Length | `server/auth/schema.ts` | under 12 or over 72 characters |
| Strength | `lib/auth/password-strength.ts` | score below 2 of 4 — common passwords (incl. leetspeak), sequences, keyboard runs, repeats, the user's own name/email |
| Breach | `lib/auth/pwned.ts` | anything in the Have I Been Pwned corpus |

`lib/auth/password-policy.ts` composes the last two. The breach check uses the
k-anonymity range API: only the first five characters of the SHA-1 leave the
process, and it **fails open** so an HIBP outage cannot block signups.
`components/auth/PasswordStrengthMeter.tsx` shows the same scoring live — a
hint only; the server gate is authoritative.

#### Rate limiting
`server/rate-limit/service.ts`, backed by the `RateLimit` table. Postgres rather than
memory because Vercel's instances would reset a Map constantly. Counting and
window rollover happen in one atomic upsert, so concurrent attempts cannot both
read a stale count. Fails open on database error.

| Surface | Limit |
| --- | --- |
| Login per IP | 20 / 15 min |
| Login per account | 8 failures / 15 min (cleared on success) |
| Register per IP | 5 / hour |
| Reset request per IP / per email | 10 / 4 per hour |
| Reset redemption per IP | 15 / hour |
| Change password per account | 10 / hour |

#### Session hardening and revocation
7-day expiry (was NextAuth's 30-day default), `useSecureCookies` derived from
`APP_URL` so a misconfigured `NEXTAUTH_URL` cannot downgrade cookies.

JWTs cannot be deleted server-side, so `User.passwordChangedAt` acts as a
revocation clock: the `jwt` callback stamps `pwdAt` at sign-in and re-reads the
row at most every 5 minutes. If the password changed after the stamp — or the
account is gone — it throws, and NextAuth's session route clears the cookie.
**Any flow that changes a password must bump `passwordChangedAt`.**

#### Verify-first registration
No `User` row until the address is confirmed from the inbox — see Registration enumeration below for why
this is what closes the enumeration hole. Falls back to immediate creation when
email is unconfigured.

#### Password reset (Iteration B)
`/forgot-password` → `/reset-password?token=…`. Tokens are 256-bit CSPRNG
values stored only as SHA-256 digests, single-use, one-hour TTL, with prior
tokens invalidated on each new request. Redemption updates the password, marks
the token used, clears sessions and lifts the login lockout — all in one
transaction. Missing, expired and already-used tokens return one identical
error.

#### Email (Iteration A)
`lib/email/client.ts` wraps Resend's REST API with plain `fetch` — no SDK, so
MSW intercepts it like every other outbound call. `sendEmail` never throws:
letting a provider error surface would make "did the send succeed?" an
enumeration oracle. Unconfigured, it no-ops with a warning. Templates
(`lib/email/templates/`) are bilingual plain-string builders with inline styles,
since mail clients strip `<style>` and ignore CSS variables.

#### Account management
`/account` — profile, email (verification badge, re-send link, and address
change — see Iteration C — Email verification), change password (requires the current one, signs out every
other device, keeps this one via silent re-auth), connected OAuth providers
(unlink, refused when it would leave the account unreachable), sign out
everywhere, delete account (typed confirmation plus password).

#### OAuth (Iteration D)
Google and GitHub register only when both halves of their env pair are present;
`OAuthButtons` renders nothing at all — divider included — when none are.

**Account-linking policy: auto-link on verified email**
(`allowDangerousEmailAccountLinking`). Both providers release only verified
addresses, and anyone controlling the mailbox could already take the account
over through password reset, so linking grants no new capability. The
alternative is a dead-end `OAuthAccountNotLinked` error for any user who
registered with a password first.

#### Transport and headers
`next.config.ts` sets CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy` and `Permissions-Policy` (geolocation kept for the map).
`script-src` keeps `'unsafe-inline'`: nonces require per-request middleware
rendering, which would cost the app its static optimization. The directives
that block clickjacking, plugin injection and form exfiltration are enforced.

### Iteration C — Email verification

`emailVerified` is stamped by `verifyRegistration` when a signup link is
redeemed, so verify-first accounts are verified the moment they exist. Accounts
from the no-email fallback start unverified and can confirm from `/account`:
`requestEmailVerification` mails a link, `confirmEmail` redeems it at
`/confirm-email`. The same token model carries email *changes* — `newEmail` null
confirms the current address, set moves the account to that one.

Login is deliberately **not** gated on verification. Blocking would need a
rejection message that still does not reveal whether the account exists, and
would strand every account created before this shipped. `EmailForm` nudges
instead, with a badge and a re-send button.

### Registration enumeration: closed by verify-first signup

Signup used to answer "an account with this email already exists", which turned
the form into a membership oracle — feed it a list of addresses and it tells you
which belong to users, which is exactly what makes targeted phishing work.

**With email configured, registration is now verify-first.** `register`
(`server/registration/actions.ts`) writes a `PendingRegistration` row rather than a
`User`, emails a confirmation link, and returns `{ success: true, pending: true }`.
A taken address takes the other branch — it gets the "you already have an
account" email instead — but returns the *same value*, so the caller cannot tell
the branches apart. The `User` row is created only when the link is confirmed
through `verifyRegistration` (`server/registration/actions.ts`).

Why this actually closes it, where immediate creation could not: if the account
existed the moment you submitted, an attacker could simply try to log in with
the password they just chose. Success would mean the address had been free,
failure that it was taken — the oracle survives the response wording. Creating
nothing until the mailbox is proven removes the difference at the source. It
also avoids squatting: an attacker cannot occupy an address they do not control,
because their pending row never becomes an account.

Confirmation is a **POST** — a button on `/verify-email`, not the link click
itself. Corporate mail scanners fetch every link in an inbox; an
account-creating GET would let a scanner consume the token before the recipient
ever opened the page.

Supporting measures kept: per-IP rate limiting (5/hour), and bcrypt run
*before* any existence check so response time cannot substitute for the message
(the original code returned early for existing addresses, which made timing a
reliable oracle on its own).

#### The remaining case: no email configured

Verify-first cannot work without a way to deliver the link, so when
`RESEND_API_KEY`/`EMAIL_FROM` are absent, `register` falls back to immediate
creation and does report `emailTaken`. The alternative would be a deployment
where nobody can register at all. That path logs a warning on every use and is
the only place the leak survives — configuring email closes it with no code
change.

### Cross-cutting conventions (do not violate)

- **Server actions over API routes** for all mutations; validate with Zod
  `safeParse`, return typed `{ success, error? }` where `error` is an
  `AUTH_ERROR` **code**, never prose — server code cannot read the client i18n
  context and the default locale is Spanish. Forms resolve codes through
  `translateAuthError`. When calling `setError`, pass the raw code.
- **Authorization**: `getCurrentUser()` from `lib/auth/session.ts` in every
  action that touches user data. `proxy.ts` only decodes the JWT and cannot see
  revocations — it is UX, not a security boundary.
- **i18n**: new strings need keys in both locales plus the `Translations` type.
- **Toasts** via Sonner. Field-fixable errors go on the field instead.
- **TypeScript**: `RULES.md` §7.
- **Tests**: Vitest two-project split (`*.node.test.ts` for actions and
  anything needing Node globals), MSW for all network — including HIBP and
  Resend, whose handlers are in `test/msw/handlers.ts`.
