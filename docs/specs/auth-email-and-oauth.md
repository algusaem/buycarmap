# Spec: Auth completion — transactional email, password reset, OAuth

Status: **draft / not started** (except the UI stubs noted below).
Owner: unassigned. Last updated: 2026-07-07.

This spec captures the work still missing to make the auth surface fully
functional. The pages and links already exist; the backends behind them do not.
Read this top-to-bottom before starting — the iterations build on each other
(email infra must land before password reset can actually send anything).

---

## 1. Current state (what already exists)

Built and working:

- `/login`, `/register` — NextAuth 4 Credentials provider, JWT sessions,
  bcrypt hashing (`lib/auth/hash.ts`), register server action
  (`app/actions/register.ts`).
- `/forgot-password` — **UI only.** Real RHF + Zod form
  (`components/auth/ForgotPasswordForm.tsx`, schema
  `forgotPasswordSchema` in `lib/validations/auth.ts`) that posts to the
  `requestPasswordReset` server action (`app/actions/forgot-password.ts`).
  The action **validates the email and returns generic success but sends
  nothing** — it has a `TODO`. On success the form shows a "check your email"
  confirmation that is currently a lie (no mail is sent).
- `/terms`, `/privacy` — real localized content (`components/legal/LegalContent.tsx`,
  i18n `legal.*` keys). No backend needed; done.
- OAuth buttons (`components/auth/OAuthButtons.tsx`) — **dead.** Google and
  GitHub buttons render on `/login` and `/register` with no `onClick` and no
  provider configured. They do nothing.

Schema today (`prisma/schema.prisma`) has only `User`, `Session`,
`SearchHistory`. No token models, no OAuth `Account` model.

NextAuth config lives in `app/api/auth/[...nextauth]/route.ts` (exports
`authOptions`), currently Credentials-only.

---

## 2. Iteration A — Transactional email infrastructure

Everything else depends on this. Land it first.

### Decisions to make
- **Provider**: Resend (recommended — simple API, good DX, generous free tier)
  vs. SMTP via Nodemailer vs. Postmark/SendGrid. Pick one before building.
- **Templating**: `react-email` (`@react-email/components` + `@react-email/render`)
  pairs well with Resend and keeps templates in TSX, consistent with the stack.

### Build
- Add the provider SDK. Remember pnpm: if it ships a build/postinstall step and
  `pnpm install` reports `ERR_PNPM_IGNORED_BUILDS`, allowlist it in
  `pnpm-workspace.yaml` under `onlyBuiltDependencies`.
- `lib/email/client.ts` — thin wrapper exposing `sendEmail({ to, subject, react })`.
  Reads the API key from env. Never call the provider directly from features;
  go through this module (mirrors the `lib/wallapop/*` client pattern).
- `lib/email/templates/*` — one component per email. Start with
  `PasswordResetEmail`. Templates must be **bilingual**: accept a `locale`
  (`"en" | "es"`) prop and pull copy from a locale map. Do **not** import the
  client-side `useTranslation` in emails (server render, no React context) —
  add a small server-side string map (either reuse `lib/i18n/locales/*` by
  importing the raw objects, or a dedicated `lib/email/copy.ts`).
- Fail loudly in logs but **never surface provider errors to the user** in a
  way that reveals account existence (see enumeration note in §3).

### Env vars (add to `.env`, document in the Neon/env memory)
```
EMAIL_PROVIDER_API_KEY=...        # e.g. RESEND_API_KEY
EMAIL_FROM="BuyCarMap <no-reply@buycarmap.com>"
APP_URL=http://localhost:3000     # base for links in emails; prod = real domain
```
Sending domain must be verified with the provider (SPF/DKIM) before prod mail
lands in inboxes.

### Tests
- Unit-test `lib/email/client.ts` and template rendering with **MSW**
  intercepting the provider HTTP endpoint (house rule: never hand-stub
  `fetch`). Assert the rendered HTML contains the reset URL and locale-correct
  copy. Add a contract test only if the provider response shape is parsed.
- Do not send real email in tests. A `CONTRACT_LIVE`-style gate can cover a
  real send nightly if wanted.

---

## 3. Iteration B — Password reset (wire the existing UI to real mail)

Depends on Iteration A.

### Schema
Add a token model. Store a **hash** of the token, not the token itself.

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique          // sha-256 of the random token
  expiresAt DateTime
  usedAt    DateTime?                  // single-use: set on redemption
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```
Add the back-relation `passwordResetTokens PasswordResetToken[]` to `User`.
Then create a **baselined migration** (see the `neon-db-setup` memory for the
Prisma 7 URL-in-config + baseline workflow) and run `prisma generate`.

### Request flow (finish `app/actions/forgot-password.ts`)
1. Validate email (already done).
2. Look up the user. **If not found, still return success** — never reveal
   whether an account exists (enumeration resistance).
3. If found: generate a cryptographically random token
   (`crypto.randomBytes(32).toString("base64url")`), store `sha256(token)` with
   a short expiry (**30–60 min**), invalidate any prior unused tokens for that
   user.
4. Send `PasswordResetEmail` via `lib/email/client.ts` with a link:
   `${APP_URL}/reset-password?token=<raw-token>` in the user's locale
   (read the `locale` cookie server-side via `getLocale()`).
5. Return generic success regardless (the UI already shows the neutral
   "if an account matches…" copy — keep it).

### Reset page (new: `/reset-password`)
- `app/reset-password/page.tsx` — reads `token` from `searchParams` (server
  component, `searchParams` is a Promise in Next 16 — `await` it, like
  `app/map/page.tsx` already does). Pass the token to a client form.
- `components/auth/ResetPasswordForm.tsx` — new-password + confirm fields,
  RHF + Zod. Reuse the password rules from `registerSchema` (min 8, max 72 for
  bcrypt) — factor a shared `passwordField` in `lib/validations/auth.ts`.
- `resetPassword` server action (`app/actions/reset-password.ts`):
  hash the incoming token, look up by `tokenHash`, reject if missing / expired
  / already used, then update `user.password` (via `hashPassword`), mark the
  token `usedAt`, and (recommended) delete the user's `Session` rows so any
  active sessions are invalidated. Return typed `{ success, error? }`.
- On success: toast + redirect to `/login`. Add i18n keys under a new
  `resetPassword.*` namespace in **both** `en.ts` and `es.ts` and the
  `Translations` type.

### Security checklist (must-haves)
- [ ] Token stored hashed, single-use, short TTL.
- [ ] Enumeration-resistant responses on both request and reset.
- [ ] Rate limit the request action (per email + per IP) — even a coarse
      in-memory limiter is better than none; note that Vercel is serverless so
      a shared store (Neon or Upstash) is needed for a real limit.
- [ ] Invalidate existing sessions on successful reset.
- [ ] Constant-ish behaviour whether or not the user exists (avoid timing that
      leaks existence — the extra hash+send for real users is acceptable).

### Tests (house setup: Vitest projects, MSW, colocated)
- `*.node.test.ts` for the two server actions (they need Node globals).
  Cover: unknown email → success + no token row; valid email → token row +
  email send intercepted by MSW; expired token → rejected; used token →
  rejected; happy path → password changed + token consumed + sessions cleared.
- Component test for `ResetPasswordForm` (jsdom): mismatched passwords, weak
  password, submit disabled/loading, success path.
- Extend the `e2e/auth.spec.ts` flow (currently DB-gated / `test.skip`) once a
  disposable Postgres is wired — see the `testing-setup` memory.

---

## 4. Iteration C — Email verification (optional, related)

Not required by any current UI, but natural once email infra exists and often
expected alongside password reset.

- Add `emailVerified DateTime?` to `User` and a `VerificationToken` model
  (same hashed-token pattern as §3).
- Send a verification email on register; add `/verify-email` route that
  redeems the token.
- Decide policy: block login until verified, or allow but nudge. If blocking,
  update `authorizeCredentials` (`lib/auth/authorize.ts`) to reject unverified
  users with a clear, non-enumerating message.
- Full i18n + tests as above.

Defer unless product wants it.

---

## 5. Iteration D — OAuth providers (Google, GitHub)

Makes the dead `OAuthButtons` real. Independent of email infra — can be done in
parallel with A–C.

### Schema
OAuth with NextAuth needs an `Account` model (and, if you switch to the DB
session strategy, adjustments). With the current **JWT** strategy you still
need `Account` to link provider identities to users via the Prisma adapter.

- Add `@auth/prisma-adapter` (NextAuth v4 uses `@next-auth/prisma-adapter`;
  confirm the version that matches NextAuth 4 in this repo).
- Add the adapter's required models (`Account`, and `VerificationToken` if not
  already added in §4). The `User` model already exists — the adapter expects
  certain fields; reconcile (`emailVerified`, `image` vs current `avatarUrl` —
  may need a mapping or an added `image` field).
- Migration + `prisma generate` (baselined workflow).

### NextAuth config (`app/api/auth/[...nextauth]/route.ts`)
- Add `GoogleProvider` and `GitHubProvider` alongside the existing Credentials
  provider. Set `adapter: PrismaAdapter(prisma)`.
- **Account-linking gotcha**: a user who registered with email+password and
  later signs in with Google using the same email will, by default, hit
  `OAuthAccountNotLinked`. Decide the policy (auto-link by verified email vs.
  force one method) and handle it explicitly. Document the choice.

### UI (`components/auth/OAuthButtons.tsx`)
- Convert to a client component that calls
  `signIn("google")` / `signIn("github")` with `callbackUrl: "/"`.
- Add loading state per button; disable while a sign-in is in flight.
- Keep the existing `t.auth.google` / `t.auth.github` labels.

### Env vars
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_ID=...
GITHUB_SECRET=...
```
Register OAuth apps for both providers. Callback URLs:
`${APP_URL}/api/auth/callback/google` and `.../github` — add both the local
and prod URLs in each provider console. **Requires the user to supply real
credentials** — flagged to product; do not build against fake ones expecting
them to work end-to-end.

### Tests
- Provider config unit test (providers array shape, adapter present).
- e2e is hard to run against real Google/GitHub — mock at the NextAuth route
  level or limit e2e to asserting the buttons trigger `signIn` (spy) and the
  redirect kicks off. Don't hit live OAuth in CI.

---

## 6. Cross-cutting conventions (do not violate)

- **Server actions over API routes** for all mutations; place in `app/actions/`.
  Validate with Zod `safeParse`, return typed `{ success, error? }`.
- **i18n**: every new user-facing string (pages **and** emails) needs keys in
  both `lib/i18n/locales/en.ts` and `es.ts`, plus the `Translations` type in
  `lib/i18n/types.ts`. Default locale is `es`.
- **Toasts** via Sonner (`toast.success` / `toast.error`), not inline error text.
- **No `any` / `unknown`**; `interface` over `type`; reusable typings in
  `/interfaces`.
- **Prisma 7 + `@prisma/adapter-pg`**; migrations follow the baselined workflow
  in the `neon-db-setup` memory. Prod and local share one Neon DB — be careful
  running migrations.
- **Tests**: Vitest two-project split (`*.node.test.ts` for route handlers /
  server actions), MSW for all network, colocated, `/check-tests` quality bar
  (hand-derived expectations, a negative path, no mock-the-SUT).

---

## 7. Suggested order & acceptance

1. **A — Email infra** → can send a rendered, localized test email via the
   `lib/email` client (verified by an MSW-intercepted unit test + one real
   manual send).
2. **B — Password reset** → a real user requesting a reset receives an email,
   the link sets a new password, the token is single-use and expires, sessions
   are invalidated, and the "check your email" confirmation is no longer a lie.
3. **C — Email verification** (optional) → register triggers a verify email;
   redemption flips `emailVerified`.
4. **D — OAuth** → Google/GitHub buttons sign a user in and create linked
   accounts; account-linking policy is decided and documented.

Each iteration is shippable on its own and leaves the app in a working state.

### Open questions for product/user
- Which email provider? (Resend recommended.)
- Sending domain + `EMAIL_FROM` identity?
- Will the user provide Google/GitHub OAuth app credentials, or should the
  buttons be hidden until then? (They are dead today.)
- Email verification: required to log in, or optional nudge?
