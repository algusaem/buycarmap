# Account data export

Key: EXPORT
Status: Implemented
Last updated: 2026-10-15

---

## Problem

A signed-in user can see their profile on `/account`, their saved cars on
`/favorites` and their alerts on `/alerts`, and can delete all of it with
`deleteAccount` — but cannot take a copy of what BuyCarMap stores about them.
Some of it is shown nowhere at all: the IP address recorded against each
session, the date each OAuth provider was linked, the exact criteria an alert
was saved with, and the listings an alert has already found and mailed.

`RULES.md` §12 requires the application to export a person's data, and
`docs/privacy/deletion.md` records the gap as an open issue
([#20](https://github.com/algusaem/buycarmap/issues/20)). A person exercising
their right of access today has to ask by email, and nothing in the product
answers.

In scope: a "Download my data" section on `/account` that gives the signed-in
user one JSON file holding every personal field `docs/privacy/data-inventory.md`
lists for them, minus the secrets named below; the server action behind it, its
authorization, its rate limit and its failure paths.

## Acceptance criteria

- [x] EXPORT-1 · node — For a signed-in caller, `exportMyData()` succeeds and returns a JSON string whose top-level keys are exactly `exportedAt`, `profile`, `pendingEmailChange`, `signInMethods`, `sessions`, `favorites`, `alerts` and `alertMatches`, with `exportedAt` the ISO 8601 UTC time the export was built
- [x] EXPORT-2 · node — `profile` holds exactly the caller's `email`, `name`, `image`, `locale`, `emailConfirmed`, `twoFactorEnabled`, `twoFactorEnabledAt` and `createdAt`; a field with no value is present as `null`, never omitted
- [x] EXPORT-3 · node — `signInMethods.password` is `true` exactly when the caller has a credential password, and `signInMethods.providers` lists each linked OAuth provider as `{ provider, linkedAt }`; the credential row never appears as a provider
- [x] EXPORT-4 · node — `sessions` lists every one of the caller's sessions as exactly `{ createdAt, expiresAt, ipAddress, userAgent }`
- [x] EXPORT-5 · node — `favorites` lists each of the caller's saved listings with its stored snapshot fields and `createdAt`, oldest first; a soft-deleted favorite is not exported
- [x] EXPORT-6 · node — `alerts` lists each of the caller's alerts as exactly `{ label, criteria, active, createdAt }`, oldest first, with `criteria` the saved search as stored; an inactive (unsubscribed) alert is exported, a soft-deleted one is not — each alert is exactly `{ label, placeName, criteria, active, createdAt }`, with `placeName` the place name stored on the alert, `null` when it has none (`Alert.placeName`, ALERTUI-46) (amended 2026-10-15, ALERTUI — redesign-alerts.md)
- [x] EXPORT-7 · node — `alertMatches` lists the matches of the caller's exported alerts with the `label` of the alert each belongs to as `alertLabel`, their stored snapshot fields, `createdAt` and `notifiedAt`, oldest first; matches of a soft-deleted alert are not exported
- [x] EXPORT-8 · node — No secret value appears anywhere in the export: no password hash, OAuth provider account id, OAuth access, refresh or id token, session token, two-factor secret or backup code, unsubscribe token hash or subject, or password-reset or email-verification token hash
- [x] EXPORT-9 · node — No row belonging to another user appears in the caller's export
- [x] EXPORT-10 · node — A caller with no favorites, no alerts and no linked provider still gets every top-level key, with `favorites`, `alerts`, `alertMatches` and `signInMethods.providers` as empty arrays
- [x] EXPORT-11 · node — A caller with no session gets `{ success: false, error: "unauthorized" }`, and no user data is read and no rate-limit budget is consumed
- [x] EXPORT-12 · node — A caller who has spent the per-user budget gets `{ success: false, error: "rateLimited" }` and no user data is read; the budget is keyed on the caller's user id
- [x] EXPORT-13 · node — When a database read fails, the caller gets `{ success: false, error: "generic" }` and no partial export
- [x] EXPORT-14 · component — The "Download my data" section on `/account` renders one button; activating it calls `exportMyData` once and downloads the returned string as an `application/json` file named `buycarmap-data-<YYYY-MM-DD>.json`, the date being the UTC date of `exportedAt`, with no success toast — the button sits in the «Tus datos» card (PAGES-36) (amended 2026-10-16, PAGES — redesign-pages.md).
- [x] EXPORT-15 · component — While the export runs, the button is disabled and busy, shows a spinner and keeps its label, and a second activation starts no second export — "disabled" is `aria-disabled` with a press ignored, not the native `disabled`, so the button keeps the focus (amended 2026-10-16, PAGES — redesign-pages.md)
- [x] EXPORT-16 · component — When `exportMyData` fails, the translated error code is shown as an error toast, no file is downloaded, and the button is usable again
- [x] EXPORT-17 · component — The button has an accessible name, is activated from the keyboard with Enter and with Space, and the section has no axe violations
- [x] EXPORT-18 · e2e — A signed-in user on `/account` activates "Download my data" and receives a file named `buycarmap-data-<YYYY-MM-DD>.json` whose parsed `profile.email` is their own address
- [x] EXPORT-19 · node — `pendingEmailChange` is exactly `{ newEmail, expiresAt }` from the caller's newest email-verification token that carries a `newEmail`, is unused and has not expired, or `null` when the caller has none; the token's hash never appears

Nineteen criteria: fourteen on the server action (`node`, written as
`server/account/actions.integration.test.ts` cases against real Postgres, the
same file and harness as the other account actions), four on the section
(`component`), one end to end. EXPORT-18 runs only in the database-backed suite
(`pnpm test:e2e:db`, `E2E_DB=1`), gated with `const dbTest = process.env.E2E_DB
? test : test.skip;` as `e2e/auth.spec.ts` and `e2e/favorites.spec.ts` are, and
seeded with `e2e/fixtures/db.ts`'s `seedUser` under the `e2e.local` domain that
global teardown sweeps. It is therefore not run in CI; what it adds over
EXPORT-1 and EXPORT-14 is that a real browser receives a real download from a
real session.

## Worked examples

The seed for EXPORT-1..9, EXPORT-13 and EXPORT-19, written with `test/factories/*`
overrides. The marker strings are chosen so that a substring search of the
exported JSON proves absence.

**Ada** (the caller): `email` `ada@example.test`, `name` `Ada Lovelace`,
`image` `null`, `locale` `en`, `emailConfirmed` `true`, `twoFactorEnabled`
`true`, `twoFactorEnabledAt` `2026-09-03T10:00:00.000Z`, `createdAt`
`2026-09-01T10:00:00.000Z`.

- Credential account: `password` `hashed:ada-secret`.
- Google account: `provider` `google`, `providerAccountId` `google-ada-123`,
  `access_token` `ada-access-token`, `refresh_token` `ada-refresh-token`,
  `id_token` `ada-id-token`, `createdAt` `2026-09-02T10:00:00.000Z`.
- `TwoFactor`: `secret` `ada-totp-secret`, `backupCodes` `ada-backup-codes`.
- Session: `sessionToken` `ada-session-token`, `expires`
  `2026-11-10T00:00:00.000Z`, `ipAddress` `203.0.113.7`, `userAgent`
  `Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0`,
  `createdAt` `2026-10-10T00:00:00.000Z`.
- `PasswordResetToken` `tokenHash` `ada-reset-hash`; `EmailVerificationToken`
  `tokenHash` `ada-verify-hash` (no `newEmail`).
- Email changes (`EmailVerificationToken` rows carrying a `newEmail`):
  `ada.new@example.test` (`tokenHash` `ada-change-hash`, `expiresAt`
  `2026-10-11T10:30:00.000Z`, `createdAt` `2026-10-11T09:00:00.000Z`, unused);
  `ada.older@example.test` (`tokenHash` `ada-older-change-hash`, `expiresAt`
  `2026-10-11T10:00:00.000Z`, `createdAt` `2026-10-11T08:00:00.000Z`, unused,
  superseded by the newer one); `ada.expired@example.test` (`tokenHash`
  `ada-expired-change-hash`, `expiresAt` `2026-10-11T09:00:00.000Z`,
  `createdAt` `2026-10-11T09:20:00.000Z`, unused);
  `ada.used@example.test` (`tokenHash` `ada-used-change-hash`, `expiresAt`
  `2026-10-11T11:00:00.000Z`, `createdAt` `2026-10-11T09:10:00.000Z`, `usedAt`
  `2026-10-11T09:15:00.000Z`).
- Favorites: `wallapop-ada-1` (`createdAt` `2026-09-05T10:00:00.000Z`) and
  `cochesnet-ada-2` (`createdAt` `2026-09-06T10:00:00.000Z`), both live;
  `wallapop-ada-gone` with `deletedAt` `2026-09-07T10:00:00.000Z`.
- Alerts: `Ada Golf alert` (`active` `true`, `criteria`
  `{ "brand": "volkswagen", "model": "golf", "maxPrice": 15000 }`,
  `unsubscribeTokenHash` `ada-unsub-hash`, `unsubscribeSubject`
  `ada-unsub-subject`, `createdAt` `2026-09-10T10:00:00.000Z`);
  `Ada paused alert` (`active` `false`, `createdAt` `2026-09-11T10:00:00.000Z`);
  `Ada removed alert` with `deletedAt` `2026-09-12T10:00:00.000Z`.
- Matches: `cochesnet-ada-match` on `Ada Golf alert` (`notifiedAt`
  `2026-10-09T08:00:00.000Z`); `wallapop-ada-removed-match` on
  `Ada removed alert`.

**Bob** (another user): `email` `bob@example.test`, a session with `ipAddress`
`198.51.100.4`, favorite `wallapop-bob-1`, alert `Bob alert` with match
`wallapop-bob-match`, and a pending email change to `bob.new@example.test`
(`expiresAt` `2026-10-11T11:30:00.000Z`, `createdAt` `2026-10-11T09:25:00.000Z`,
unused) — newer than any of Ada's.

Results, with the clock at `2026-10-11T09:30:00.000Z`:

- **EXPORT-1** — Ada calls `exportMyData()` → `success: true`; the parsed data's
  keys are `["exportedAt","profile","pendingEmailChange","signInMethods","sessions","favorites","alerts","alertMatches"]`
  and `exportedAt` is `"2026-10-11T09:30:00.000Z"`.
- **EXPORT-2** — `profile` =
  `{ "email": "ada@example.test", "name": "Ada Lovelace", "image": null, "locale": "en", "emailConfirmed": true, "twoFactorEnabled": true, "twoFactorEnabledAt": "2026-09-03T10:00:00.000Z", "createdAt": "2026-09-01T10:00:00.000Z" }`.
- **EXPORT-3** — `signInMethods` =
  `{ "password": true, "providers": [{ "provider": "google", "linkedAt": "2026-09-02T10:00:00.000Z" }] }`.
- **EXPORT-4** — `sessions` =
  `[{ "createdAt": "2026-10-10T00:00:00.000Z", "expiresAt": "2026-11-10T00:00:00.000Z", "ipAddress": "203.0.113.7", "userAgent": "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0" }]`.
- **EXPORT-5** — `favorites.map(f => f.listingId)` =
  `["wallapop-ada-1","cochesnet-ada-2"]`; each entry's keys are exactly
  `listingId, source, title, subtitle, image, brand, model, location, fuel, url, price, mileage, year, lat, lng, createdAt`.
- **EXPORT-6** — `alerts.map(a => a.label)` = `["Ada Golf alert","Ada paused alert"]`;
  the first is
  `{ "label": "Ada Golf alert", "criteria": { "brand": "volkswagen", "model": "golf", "maxPrice": 15000 }, "active": true, "createdAt": "2026-09-10T10:00:00.000Z" }`
  and the second has `"active": false`.
- **EXPORT-7** — `alertMatches.map(m => m.listingId)` = `["cochesnet-ada-match"]`,
  with `"alertLabel": "Ada Golf alert"` and `"notifiedAt": "2026-10-09T08:00:00.000Z"`;
  each entry's keys are `alertLabel`, then the EXPORT-5 keys (ending in
  `createdAt`), then `notifiedAt`.
- **EXPORT-8** — the returned JSON string contains none of `hashed:ada-secret`,
  `google-ada-123`, `ada-access-token`, `ada-refresh-token`, `ada-id-token`,
  `ada-session-token`, `ada-totp-secret`, `ada-backup-codes`, `ada-unsub-hash`,
  `ada-unsub-subject`, `ada-reset-hash`, `ada-verify-hash`, `ada-change-hash`.
- **EXPORT-9** — the returned JSON string contains none of `bob@example.test`,
  `198.51.100.4`, `wallapop-bob-1`, `Bob alert`, `wallapop-bob-match`,
  `bob.new@example.test`; nor
  (EXPORT-5..7) `wallapop-ada-gone`, `Ada removed alert`,
  `wallapop-ada-removed-match`.
- **EXPORT-10** — Grace, an OAuth-only user with one GitHub link, no favorites
  and no alerts → `signInMethods.password` `false`, `providers` has one
  `github` entry, `favorites`, `alerts` and `alertMatches` are `[]`, and
  `pendingEmailChange` is `null`. A credential user with no linked provider →
  `providers` is `[]`.
- **EXPORT-11** — no session → `{ success: false, error: "unauthorized" }`;
  `consumeRateLimit` not called.
- **EXPORT-12** — `consumeRateLimit` resolves `{ allowed: false }` for key
  `export-data:user:<Ada's id>` → `{ success: false, error: "rateLimited" }`;
  no favorite, alert or session is read.
- **EXPORT-14** — `exportMyData` resolves
  `{ success: true, data: '{"exportedAt":"2026-10-11T09:30:00.000Z", …}' }` →
  one download named `buycarmap-data-2026-10-11.json`, of type
  `application/json`, whose text is exactly `data`. With `exportedAt`
  `2026-10-11T23:30:00.000Z` (01:30 on 12 October in Madrid) the name is still
  `buycarmap-data-2026-10-11.json`.
- **EXPORT-16** — `exportMyData` resolves `{ success: false, error: "rateLimited" }`
  → an error toast with the `authErrors.rateLimited` text, no download.
- **EXPORT-19** — Ada's `pendingEmailChange` =
  `{ "newEmail": "ada.new@example.test", "expiresAt": "2026-10-11T10:30:00.000Z" }`;
  none of `ada.older@example.test`, `ada.expired@example.test`,
  `ada.used@example.test` or `ada-change-hash` appears in the JSON, and Bob's
  newer `bob.new@example.test` is not chosen. With only Ada's expired and used
  changes left, `pendingEmailChange` is `null`.

## Data model

No schema change. The export reads `User`, `Account`, `Session`, `Favorite`,
`Alert` with its `AlertCriteria.criteria`, `AlertMatch`, and the `newEmail` and
`expiresAt` of `EmailVerificationToken` (`prisma/schema.prisma`). It never
reads `TwoFactor`, `PasswordResetToken`, `PendingRegistration`, `Verification`,
`AlertSeenListing`, `AlertPollJob` or `SourceHealth`.

### What is exported, field by field

| Export key | Source | Fields |
| --- | --- | --- |
| `profile` | `User` | `email`, `name`, `image`, `locale`, `emailConfirmed`, `twoFactorEnabled`, `twoFactorEnabledAt`, `createdAt` |
| `pendingEmailChange` | The newest `EmailVerificationToken` with a `newEmail`, `usedAt` null, `expiresAt` later than the export time and `deletedAt` null; `null` when there is none | `newEmail`, `expiresAt` |
| `signInMethods.password` | `Account` where `provider = "credential"` | `true` when its `password` is not null; the hash itself never |
| `signInMethods.providers[]` | `Account` where `provider != "credential"` | `provider`, and `createdAt` as `linkedAt` |
| `sessions[]` | `Session` | `createdAt`, `expires` as `expiresAt`, `ipAddress`, `userAgent` |
| `favorites[]` | `Favorite`, `deletedAt` null | `listingId`, `source`, `title`, `subtitle`, `image`, `brand`, `model`, `location`, `fuel`, `url`, `price`, `mileage`, `year`, `lat`, `lng`, `createdAt` |
| `alerts[]` | `Alert`, `deletedAt` null | `label`, `placeName` (`null` when none), `criteria` (the linked `AlertCriteria.criteria` JSON), `active`, `createdAt` |
| `alertMatches[]` | `AlertMatch` of an exported alert, `deletedAt` null | the alert's `label` as `alertLabel`, the `favorites[]` snapshot fields, `createdAt`, `notifiedAt` |

### What is not exported, and why

| Field | Why |
| --- | --- |
| `Account.password`, `PendingRegistration.password` | Password hashes: secrets |
| `Account.providerAccountId` | The identity link a provider sign-in resolves through; treated as a credential identifier, not shown |
| `Account.access_token`, `refresh_token`, `id_token` (and their `expires_at`, `token_type`, `scope`, `session_state`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`) | OAuth tokens and their metadata: secrets |
| `Session.sessionToken` | A live bearer credential |
| `TwoFactor.secret`, `TwoFactor.backupCodes` | Second-factor secrets |
| `Alert.unsubscribeTokenHash`, `Alert.unsubscribeSubject` | Unsubscribe-link machinery |
| `PasswordResetToken.tokenHash`, `EmailVerificationToken.tokenHash`, `PendingRegistration.tokenHash` | Link-token hashes |
| `EmailVerificationToken.newEmail` of a used, expired, superseded or soft-deleted token | No longer a change in progress; the export carries the current address and the one pending change |
| `PendingRegistration.email`, `name` | Not linked to a `User`, so not the caller's account data |
| Every `id`, `userId`, `alertId`, `criteriaId`, `createdById`, `updatedById`, `updatedAt`, `deletedAt`, `version` | Internal keys and bookkeeping, not personal data |

## Permissions

Only a signed-in user can export, and only their own data. `exportMyData` calls
`getCurrentUser()` first and returns `unauthorized` without one (EXPORT-11).
Every read is scoped in the query, never filtered afterwards (`RULES.md` §10):
`User` by the session's own id, and `Account`, `Session`, `Favorite`,
`Alert` and `EmailVerificationToken` with `ownedBy(user)` from `lib/auth/permissions.ts`; `AlertMatch` is
reached only through the caller's own alerts. The action takes no argument, so
there is no identifier for a caller to tamper with. EXPORT-9 is the integration
test proving another user's rows never arrive.

There is no admin export of another user's data.

## Edge cases

- EXPORT-2 — a profile field with no value (`name`, `image`, `locale`) is `null`, not missing.
- EXPORT-3, EXPORT-10 — an OAuth-only account (`password: false`) and an account with no provider (`providers: []`).
- EXPORT-5, EXPORT-6, EXPORT-7 — soft-deleted favorites, alerts and the matches of a soft-deleted alert are left out; an unsubscribed alert stays in.
- EXPORT-10 — a user with nothing saved.
- EXPORT-19 — several email changes started in a row (only the newest unused, unexpired one counts), one that expired, one already confirmed, and none at all (`null`).
- EXPORT-11 — a caller with no session, or a revoked one (`getCurrentUser()` reads the session row).
- EXPORT-12 — the per-user budget is spent. When Redis is unreachable `consumeRateLimit` fails open, as for every other rule (`docs/ARCHITECTURE.md` › Rate limiting).
- EXPORT-13 — a database failure mid-export.
- EXPORT-14 — the UTC date in the filename can differ from the user's local date near midnight; see Decisions.
- EXPORT-15 — a double click.
- EXPORT-16 — the action fails.
- A row written while the export is being built may or may not appear; the next export includes it. The reads are not wrapped in one transaction, since nothing is written.

## Out of scope

- **Data held only by processors**: Resend's delivery logs, Sentry events, Upstash
  rate-limit keys (`docs/privacy/processors.md`). The export covers what
  BuyCarMap's own database holds.
- **Other formats**: CSV, a ZIP, a human-readable page. JSON only.
- **Emailing the export** or preparing it in the background.
- **An admin export of another user**, or any export not started by the person
  themselves.
- **Importing** an export back.
- **Re-entering the password** before the download; see Decisions.

## Contracts

### Server action

In `server/account/actions.ts`, following the file's conventions —
`getCurrentUser()` first, then the rate limit, then the reads in
`server/account/service.ts`:

```ts
export interface ExportResult extends AccountResult {
  data?: string; // the export, JSON.stringify'd, present only when success is true
}

export async function exportMyData(): Promise<ExportResult>;
```

Order: no session → `unauthorized` (EXPORT-11); budget spent → `rateLimited`
(EXPORT-12); a read throws → `generic`, logged with the Pino logger
(`lib/logger.ts`) naming no personal data and never the export (EXPORT-13);
otherwise `{ success: true, data }`. Error codes are the existing `AUTH_ERROR`
values; no new code.

Dates are serialised as ISO 8601 UTC strings, `criteria` as the stored JSON,
numbers as numbers.

### Rate limit

A new `RATE_LIMITS` entry in `server/rate-limit/service.ts`:

```ts
exportDataPerUser: { name: "exportDataPerUser", limit: 5, windowMs: 60 * 60 * 1000 }
```

consumed with the key `export-data:user:<userId>`, the same shape as
`change-password:user:<userId>`.

### Component

`DataExportCard`, a client component in `components/account/`: the «Tus datos»
`AccountCard` on `/account`, between «Sesiones» and «Eliminar cuenta»
([PAGES-36](redesign-pages.md)). It calls `exportMyData()`, builds a `Blob` of
type `application/json` from `data`, and downloads it under
`buycarmap-data-${exportedAt.slice(0, 10)}.json`. On failure it shows
`toast.error(translateAuthError(messages, result.error))`, the error toast of an
action with no form (FRONT-15).

### i18n

New keys in `messages/en.json` and `messages/es.json`: `account.export.title`,
`account.export.description` and `account.export.submit`. Errors use the
existing `authErrors.unauthorized`, `authErrors.rateLimited` and
`authErrors.generic`.

### Docs that ship with the implementation

- `docs/privacy/deletion.md` — its "No export" section is replaced by a pointer to this spec.
- `docs/privacy/data-inventory.md` — has no export column or note today, so it needs no change.
- `docs/privacy/processors.md` — no change: per-user rate-limit keys already reach Upstash (`changePasswordPerUser`), and the one-hour window does not lengthen the retention it states.
- `docs/ARCHITECTURE.md` › Authentication — lists no account features, so no change.
- Root `README.md` — the spec index row for this spec lands with the spec. The new files fall under the existing `server/account/**`, `components/account/**` and `app/account/**` ownership rows, so the ownership map needs no new row.

## Decisions and rationale

### A Server Action returning a string, not a route handler

`RULES.md` §9 keeps route handlers for what a Server Action cannot do. A
download is the classic case for a route handler, but here the file is small
(a user's own rows) and the browser can turn a string into a file with a
`Blob`, so the action works and keeps the export inside the same
`getCurrentUser()` → rate limit → service path as every other account action.
A route handler would add a second authorization surface to keep in step for
no gain.

### Secrets are left out even though they are "about" the user

A hash, a token or a TOTP secret is data about the user, but exporting it hands
whoever holds the file — a shared download folder, a synced drive — something
that can be replayed or ground offline. None of it is information a person can
read or act on. The export carries the facts the secrets protect instead: that
a password exists, which providers are linked and when, which sessions are
open. `providerAccountId` is excluded on the same footing: it is the lookup key
a provider sign-in resolves through, and the provider and link date already
tell the user what is linked.

### Every personal field in the inventory is exported

The right of access covers every personal field
`docs/privacy/data-inventory.md` lists for the caller, so the export also
carries `User.twoFactorEnabledAt`, even though `twoFactorEnabled` is the live
flag the account page shows, and the address an account is moving to while an
email change is pending (`pendingEmailChange`), never the token hash that
confirms it. Only the newest unused, unexpired change is still in progress: an
older one is superseded, and an expired or used one changes nothing any more.
Each alert match carries its alert's `label` as `alertLabel`, so a match can be
read without the internal ids the export leaves out.

### Soft-deleted rows are left out

`docs/privacy/deletion.md` says every read excludes a soft-deleted row, its
owner included; the export is a read, and a user who removed a favorite does
not expect it back in their file. The rows still exist for up to 30 days, but
only as an undo buffer, and are erased by `server/retention/service.ts`.

### The filename uses the UTC date of `exportedAt`

The filename is derived from the export's own `exportedAt`, so the name and the
content can never disagree, and the component test is deterministic. Using the
user's local date would need their time zone on the server or a second clock
read on the client; near midnight the UTC date can be a day off the local one,
which is harmless for a filename.

### 5 per hour, per user

Exporting is a handful of indexed reads, but it assembles everything stored
about a person, so it is bounded like the other signed-in sensitive actions
(`RULES.md` §16). A person downloads once and maybe retries; five covers a
retry after a failed save with room to spare, and one hour matches every other
per-user and per-email rule (`changePasswordPerUser`,
`emailVerificationPerUser`, `resetRequestPerEmail`), sitting between their 4 and
10. Keyed on the user id because the action requires a session, as
`changePasswordPerUser` is.

### No password re-entry

`deleteAccount` asks for the password because it destroys the account. The
export changes nothing and carries no credential, and everything in it is the
signed-in user's own data; asking again would add friction without protecting
anything a session holder could not already reach. The rate limit bounds
repeated scraping from a stolen session.

### The loading button keeps its label

`RULES.md` §19 says a loading button shows a spinner and keeps its original
label. The sibling account cards swap the label for "…ing" text; new code
follows the rule, not the pattern next to it (`CLAUDE.md`), so this section
needs no "submitting" key.

### No success toast

The browser's own download UI is the confirmation. A toast on top would repeat
it, and for a file that has not yet been saved — the user may still cancel the
save dialog — it would claim more than is true.
