# Car alerts

Key: ALERT
Status: Implemented
Last updated: 2026-09-28

---

## Problem

The cars worth buying are gone in hours. Someone hunting for a specific car —
a manual diesel Golf under €12,000 within 50 km of Valencia — has no way to be
told when one appears. Their only option is to open the site and run the same
search again, repeatedly, forever, and to be lucky about when they do it.

This is worse here than on any single marketplace, because the whole point of
this app is that the listing could show up on any of three sites. Wallapop,
coches.net and Milanuncios each have their own saved-search notifications, and
using all three means three accounts, three inboxes and three sets of filters
that do not mean quite the same thing. The one thing this app does that none of
them can — search all three at once — is exactly the thing that cannot currently
be automated.

Favorites solved the adjacent problem: keeping a car you have already found.
This is about the cars you have not found yet.

In scope: Saving a set of search criteria as an alert; a background poller
that discovers listings matching it that the alert has not been shown before;
an email telling the user about them; managing and unsubscribing from alerts.

## Acceptance criteria

ALERT-1's e2e half, ALERT-13 and ALERT-14 are proven only by the database-backed suite
(`pnpm test:e2e:db`, `E2E_DB=1`), which CI does not run.

- [x] ALERT-1 · node + e2e — A signed-in user can save the current search criteria as an alert, and it is listed against their account on the next request
- [x] ALERT-2 · node — Creating an alert records every listing currently matching the criteria as already-seen, and sends no email
- [x] ALERT-3 · node — Two users saving identical criteria share one criteria record, so the criteria are polled once rather than twice
- [x] ALERT-4 · node — A caller with no session cannot create, list or delete an alert, and nothing is written
- [x] ALERT-5 · node — A user cannot delete or deactivate an alert belonging to a different user
- [x] ALERT-6 · node — Criteria that fail `searchSchema` are rejected with an error code and nothing is written
- [x] ALERT-7 · node — Saving criteria the user has already saved reports success and leaves exactly one alert
- [x] ALERT-8 · node — Creating an alert beyond the per-user cap is rejected with a distinct error code, and the existing alerts are untouched
- [x] ALERT-9 · node — A request to the run endpoint without the shared secret is refused, and enqueues and processes nothing
- [x] ALERT-10 · node — A run enqueues every active criteria set last polled longer ago than the poll interval, and skips those polled more recently
- [x] ALERT-11 · node — Enqueuing a criteria set that already has a pending job leaves one job, not a second
- [x] ALERT-12 · node — A worker processes at most the configured slice, returns within its time budget, and leaves the remainder queued
- [x] ALERT-13 · e2e — Two workers draining the queue concurrently never both process the same job
- [x] ALERT-14 · e2e — The criteria set waiting longest is claimed before one that was polled more recently
- [x] ALERT-15 · node — A listing matching the criteria that is not in the seen-set produces a pending match for every active subscriber, and is recorded as seen
- [x] ALERT-16 · node — A listing already in the seen-set produces no new match, however many runs it appears in
- [x] ALERT-17 · node — When one source fails, matches from the surviving sources are still produced, and nothing from the failed source is recorded as seen
- [x] ALERT-18 · node — When every source fails, the job is retried with backoff and nothing is recorded as seen
- [x] ALERT-19 · node — A job that exhausts its retry budget is marked failed, stops being retried, and does not block the rest of the queue
- [x] ALERT-20 · node — A source that returns zero results having previously returned some is recorded as unhealthy rather than treated as "nothing new"
- [x] ALERT-21 · node — Several matches for one user in one run produce a single email, not one per listing
- [x] ALERT-22 · unit — The email renders each listing from the stored snapshot, making no request to any source API
- [x] ALERT-23 · node — A match already notified is not emailed again on any later run
- [x] ALERT-24 · node — When the send fails, the match stays un-notified and is retried on the next run rather than being lost
- [x] ALERT-25 · node — With email unconfigured, matches are still recorded and the run reports that nothing was sent, rather than silently succeeding
- [x] ALERT-26 · node — Following the unsubscribe link in an email deactivates exactly that alert, with no session required
- [x] ALERT-27 · node — An unsubscribe link with an unknown, malformed or already-used token changes nothing and reports the same response as a valid one
- [x] ALERT-28 · component — The alerts page lists the user's alerts with a readable summary of the criteria and how many matches each has found
- [x] ALERT-29 · component — With no alerts saved, the page shows an empty state offering a route to create one from a search
- [x] ALERT-30 · node — Visiting the alerts page without a session redirects to sign-in, carrying the intended path
- [x] ALERT-31 · node — A run reports the age of the oldest un-polled criteria set, so a lap exceeding the freshness target is observable rather than silent
- [x] ALERT-32 · node — The email is written in the locale stored on the user, falling back to the default when none is stored
- [x] ALERT-33 · node — Changing the language while signed in persists the choice to the account, not only to the cookie
- [x] ALERT-34 · node — Creating an alert with no locale yet stored records the one the request resolves to, so the first email is not a guess
- [x] ALERT-35 · node — While the active criteria count is within the request-rate ceiling, every criteria set is polled at the base interval
- [x] ALERT-36 · node — When the criteria count would exceed the ceiling, the interval stretches by the same factor for every criteria set, so none is polled preferentially
- [x] ALERT-37 · node — A run reports the interval in force, so a stretched cadence is visible rather than inferred from the lap age
- [x] ALERT-38 · node — Criteria naming no brand, no maximum price and no location are rejected with a distinct error code, and nothing is written
- [x] ALERT-39 · component — Selecting an alert lists what it has found, newest first, rendered from stored snapshots with no request to any source API
- [x] ALERT-40 · component — An alert that has found nothing shows an empty state explaining it is watching, not a blank list
- [x] ALERT-41 · node — A criteria set whose subscribers are all inactive is not enqueued, and stops consuming upstream requests
- [x] ALERT-42 · node — Deleting the last alert that references a criteria set stops it being polled at once (DATA-10); the criteria set and its seen-list are deleted when the last alert referencing it is purged (DATA-12, 30 days after deletion), so a restored alert keeps its seen-list

Forty-two criteria: thirty-five on the server boundary, four on rendering, one on
the email template, two on real Postgres. Nine cover the management surface, ten
the queue and cadence, six discovery, ten delivery, five the UI.

**ALERT-13 and ALERT-14 are the two `e2e` criteria, and they are the ones that
cannot be faked.** Both are properties of the claim query — its exclusivity and
its ordering — and Prisma is mocked throughout Vitest, so any node-level test
would run against a fake that supplied the very behaviour under test. ALERT-14
was specified as `node` when this spec was drafted; writing the tests exposed
that as wrong, because `ORDER BY "enqueuedAt"` lives in SQL and a fake sorting
its own rows proves only that the fake sorts.

Both need `pnpm test:e2e:db`, which **does not run in CI** (see
[ARCHITECTURE.md › The database-backed suite](../ARCHITECTURE.md#the-database-backed-suite)) — so a green CI does not prove exclusivity or
fairness. That is the same trade the favorites spec made for its cascade, and it
is why the unique constraints in Data model exist as a second, independent guard rather
than as documentation.

## Worked examples

- **ALERT-4** — No session; createAlert({brand:"Audi", model:"A3", maxPrice:20000, latitude:40.4168, longitude:-3.7038, distanceInKm:50}, "Audi A3 under 20k") → { success: false, error: "unauthenticated" }; 0 alerts, 0 criteria rows.
- **ALERT-5** — Ada (user-ada) owns "Ada's search"; Grace (user-grace) calls deleteAlert(<Ada's id>) → success: true (nothing leaked), Ada still has 1 alert.
- **ALERT-9** — ALERTS_CRON_SECRET="cron-secret"; POST /api/alerts/run with no Authorization → 401, no source searched, job stays "pending"; "Bearer not-the-secret" → 401; "Bearer cron-secret" → 200.
- **ALERT-26** — Alert stored with unsubscribeTokenHash = sha256("raw-token-ada"); GET /api/alerts/unsubscribe?token=raw-token-ada, no session → 200, that alert active=false; unsubscribing raw-token-one leaves the raw-token-two alert active.
- **ALERT-27** — GET ?token=some-token-nobody-issued → 200, Ada's alert stays active; token=garbage returns the same status and body as token=raw-token-ada.

## Data model

### Schema

Six new models. `User` gains `alerts Alert[]` and one new column:

| Field | Type | Notes |
| --- | --- | --- |
| `locale` | `String?` | `es` · `en`, validated against `LOCALES` on write. Written by the language switcher (ALERT-33) and backfilled on alert creation (ALERT-34); null falls back to `DEFAULT_LOCALE` (ALERT-32) |

**`AlertCriteria`** — one deduplicated question, polled once however many users
subscribe.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | |
| `criteriaHash` | `String @unique` | SHA-256 of the canonicalised `SearchInput` — keys sorted, `undefined` dropped, arrays sorted, so equivalent filters hash alike |
| `criteria` | `Json` | The `SearchInput` itself, re-validated with `searchSchema` on read; never trusted as typed |
| `lastPolledAt` | `DateTime?` | Null until the first successful poll. Drives ALERT-10 and ALERT-14 |
| `createdAt` | `DateTime @default(now())` | |

**`Alert`** — a user's subscription.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | |
| `userId` | `String` | Indexed; cascade on user delete |
| `criteriaId` | `String` | Indexed; cascade |
| `label` | `String` | Human summary shown on the alerts page (ALERT-28) |
| `active` | `Boolean @default(true)` | Unsubscribe flips this rather than deleting, so the seen-set survives a re-subscribe |
| `unsubscribeTokenHash` | `String @unique` | SHA-256; the raw token exists only in the email |
| `createdAt` | `DateTime @default(now())` | |

Constraints: `@@unique([userId, criteriaId])` makes ALERT-7 true in the database
rather than in a read-then-write race; `@@index([userId])`, `@@index([criteriaId])`.

**`AlertSeenListing`** — the dedup memory. Deliberately holds no snapshot: these
rows are numerous and mostly never emailed, and the snapshot belongs on the
delivery row.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | |
| `criteriaId` | `String` | Cascade |
| `listingId` | `String` | The normalized source-prefixed id — `wallapop-abc123`, already unique across sources |
| `source` | `String` | Which source produced it, so ALERT-17 can update per source |
| `firstSeenAt` | `DateTime @default(now())` | |

Constraints: `@@unique([criteriaId, listingId])` — the backstop that makes
ALERT-16 hold even if two workers race past `SKIP LOCKED`; `@@index([criteriaId])`.

**`AlertMatch`** — one row per user per newly discovered listing, carrying the
snapshot because no source client can fetch a single listing by id, so an email
built from a reference alone would have nothing to render. Fields derived
field-by-field from `CarListing`, which has fifteen; `id` becomes `listingId`
and the other fourteen are copied.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | |
| `alertId` | `String` | Indexed; cascade |
| `listingId` | `String` | Normalized id |
| `source`, `title`, `subtitle`, `image`, `brand`, `model`, `location`, `fuel`, `url` | `String` | Snapshot. `subtitle`, `image` and `fuel` may be empty strings, matching `CarListing` |
| `price`, `mileage`, `year` | `Int` | Snapshot; zero means unknown, as in `CarListing` |
| `lat`, `lng` | `Float` | Snapshot |
| `notifiedAt` | `DateTime?` | Null means pending delivery. ALERT-23, ALERT-24 |
| `createdAt` | `DateTime @default(now())` | |

Constraints: `@@unique([alertId, listingId])` — the delivery-side guard against
a duplicate email; `@@index([alertId, notifiedAt])` for the drain query.

**`AlertPollJob`** — the queue. One row per criteria set, reused rather than
appended, which is what makes ALERT-11 a unique constraint instead of a check.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | |
| `criteriaId` | `String @unique` | One live job per criteria set |
| `status` | `String` | `pending` · `running` · `failed` |
| `attempts` | `Int @default(0)` | ALERT-18, ALERT-19 |
| `availableAt` | `DateTime @default(now())` | Backoff: a retried job is not claimable until this passes |
| `lockedAt` | `DateTime?` | Lease timestamp; a stale lease is reclaimable so a killed worker does not strand a job |
| `lastError` | `String?` | |
| `enqueuedAt` | `DateTime @default(now())` | Claim order for ALERT-14 |

Constraints: `@@index([status, availableAt, enqueuedAt])` — the claim query's
index, and the reason oldest-first is cheap.

**`SourceHealth`** — global, not per criteria: a broken parser breaks every
criteria set at once.

| Field | Type | Notes |
| --- | --- | --- |
| `source` | `String @id` | `Wallapop` · `Coches.net` · `Milanuncios` |
| `lastOkAt` | `DateTime?` | Last run that returned at least one result |
| `consecutiveEmptyRuns` | `Int @default(0)` | ALERT-20's signal |
| `updatedAt` | `DateTime @updatedAt` | |

## Permissions

Only a signed-in user can create, list or delete an alert, and nothing is written
for a caller with no session (ALERT-4). A user cannot delete or deactivate an
alert belonging to a different user (ALERT-5). Every server action calls
`getCurrentUser()` first (see Contracts › Server actions); `setLocale` no-ops for
a signed-out caller (ALERT-33).

The run endpoint is a machine caller: it requires the shared secret
`ALERTS_CRON_SECRET` in an `Authorization: Bearer` header, compared in constant
time, and not a user session (ALERT-9). The unsubscribe link needs no session:
its token is a bearer credential that deactivates exactly the alert it was
issued for (ALERT-26), and an unknown, malformed or already-used token changes
nothing (ALERT-27).

The alerts pages redirect a visitor with no session to sign-in (ALERT-30);
`/api/alerts/unsubscribe` is deliberately not protected (see Contracts ›
Routing). Signed-out visitors cannot have alerts (see Out of scope).

## Edge cases

- ALERT-4 — a caller with no session.
- ALERT-5 — deleting or deactivating another user's alert.
- ALERT-6 — criteria that fail `searchSchema`.
- ALERT-7 — saving criteria the user has already saved.
- ALERT-8 — creating an alert beyond the per-user cap.
- ALERT-9 — a run request without the shared secret.
- ALERT-11 — enqueuing a criteria set that already has a pending job.
- ALERT-12 — more queued work than one worker's slice and time budget.
- ALERT-13 — two workers draining the queue concurrently.
- ALERT-16 — a listing already in the seen-set.
- ALERT-17 — one source fails.
- ALERT-18 — every source fails.
- ALERT-19 — a job that exhausts its retry budget.
- ALERT-20 — a source that returns zero results having previously returned some.
- ALERT-24 — the email send fails.
- ALERT-25 — email unconfigured.
- ALERT-27 — an unknown, malformed or already-used unsubscribe token.
- ALERT-29 — no alerts saved.
- ALERT-30 — the alerts page without a session.
- ALERT-32 — no locale stored on the user.
- ALERT-36 — the criteria count would exceed the request-rate ceiling.
- ALERT-38 — criteria naming no brand, no maximum price and no location.
- ALERT-40 — an alert that has found nothing.
- ALERT-41 — a criteria set whose subscribers are all inactive.
- A new listing ranked beyond the first page — see Decisions › "New" cannot mean "published recently", so it means "not seen before".
- A source that returns zero ads on a parse failure — see Decisions › A silently empty source is the dangerous failure.
- A source flapping, then recovering — see Decisions › Partial upstream failure must not poison the seen-set.
- A killed worker holding a job — see Data model › Schema (`AlertPollJob.lockedAt`).

## Out of scope

**Out of scope, deliberately:**

- **Real-time or push delivery.** No upstream offers webhooks or a stream, so
  discovery is polling and the freshness floor is the poll interval. A WebSocket
  would make the last hop instant while the first hop stayed minutes long. See
  Decisions and rationale.
- **Price-drop alerts on a specific listing.** That is favorites plus polling,
  a different feature with a different data model. Nothing here blocks it.
- **In-app notification centre, badges, or web push.** Email is the only
  *notification* channel. The matches page (ALERT-39) shows what an alert has
  found on demand; it does not tell anyone anything has arrived.
- **Per-source alert criteria.** The project invariant is one shared filter set
  driving all three sources, and an alert is a saved `SearchInput` for exactly
  that reason.
- **Alerts for signed-out visitors.** Delivery is email, and the address comes
  from the account.
- **Guaranteeing that every matching listing is found.** See the honesty note in
  Decisions and rationale — detection is best-effort and the spec says so rather than implying
  completeness.

## Contracts

### The runner needs its own way to reach the upstreams

The three source clients cannot be used here. `lib/wallapop/client.ts` builds its
URL with `new URL(BASE_URL, window.location.origin)`, and the other two do the
same: they call the proxy routes from the browser, which is the whole point of
those routes existing. A cron has no `window` and no origin to resolve against.

So `server/alerts/search.ts` exports `searchAllSources(criteria)`, which calls the
three upstreams directly — the same requests `app/api/*/route.ts` forwards, with
the same required headers — and returns more than a merged list:

```ts
interface AlertSearchResult {
  listings: CarListing[];
  /** Sources whose request failed. Nothing from these is recorded as seen. */
  failedSources: string[];
  /** Per-source result counts, before merging. */
  perSourceCounts: Record<string, number>;
}
```

Both extra fields are load-bearing, and a flat `CarListing[]` carries neither.
**ALERT-17** needs `failedSources`, because a source that failed must contribute
nothing to the seen-list — otherwise listings that appeared during the outage are
never new again. **ALERT-20** needs `perSourceCounts`, because after merging,
"Milanuncios returned nothing" and "Milanuncios returned nothing *this time*"
are indistinguishable, which is precisely the silent-death failure that criterion
exists to catch.

This is why the alert path can force `order_by=newest` on Wallapop without
touching the interactive search path — they no longer share a client.

### The claim query

The one piece of raw SQL, because Prisma cannot express `SKIP LOCKED`:

```sql
SELECT id FROM "AlertPollJob"
WHERE status = 'pending' AND "availableAt" <= now()
ORDER BY "enqueuedAt" ASC
LIMIT $1
FOR UPDATE SKIP LOCKED
```

`SKIP LOCKED` rather than plain `FOR UPDATE` is the whole point: plain locking
makes concurrent workers queue behind each other, which is a slower version of
one worker. Skipping means worker two takes the next job instead of waiting.

### Route handlers

`app/api/alerts/run/route.ts` — the only new route, because this is a machine
caller and not a user mutation, so the "prefer server actions" rule does not
apply. The run itself is `runAlerts` in `server/alerts/service.ts`. Authorised by a constant-time comparison against `ALERTS_CRON_SECRET` in
an `Authorization: Bearer` header (ALERT-9), **not** by `getCurrentUser()`.

Returns a summary rather than `204`, because ALERT-31 and ALERT-25 are only
observable if the run says what it did:

```
{ claimed, polled, matched, emailed, skippedNoEmail, oldestPendingAgeMs, failures[] }
```

`app/api/alerts/unsubscribe/route.ts` — `GET` with a token, session-free
(ALERT-26, ALERT-27).

### Server actions

`server/alerts/actions.ts`, following the favorites actions' shape exactly —
`getCurrentUser()` first, Zod `safeParse`, typed `{ success, error?: Code }`
where the error is a **code**:

- `createAlert(criteria, label)` — ALERT-1, ALERT-2, ALERT-3, ALERT-4, ALERT-6, ALERT-7, ALERT-8, ALERT-34
- `listAlertsForPage()` in `server/alerts/queries.ts` — ALERT-4, ALERT-28
- `deleteAlert(alertId)` — ALERT-4, ALERT-5
- `setLocale(locale)` — ALERT-33, in `server/locale/actions.ts`. It no-ops for
  a signed-out caller, since the cookie already carries the preference for them

Codes in `server/alerts/schema.ts`: `unauthenticated`, `invalidCriteria`,
`criteriaTooBroad`, `tooManyAlerts`, `unexpected`.

`criteriaTooBroad` is distinct from `invalidCriteria` on purpose — the criteria
are structurally valid and the user needs to be told to narrow them, not that
they made a mistake (ALERT-38).

### Environment

| Variable | Absent means |
| --- | --- |
| `ALERTS_CRON_SECRET` | The run endpoint refuses every request, so alerts never fire. Optional, like every other feature flag in `lib/env.ts` — it disables a feature rather than blocking boot |

Delivery additionally needs `RESEND_API_KEY` + `EMAIL_FROM`; without them
ALERT-25 applies. Add `isAlertsConfigured` alongside `isEmailConfigured`.

### Constants

| Name | Value | Why |
| --- | --- | --- |
| Base poll interval | 5 min | GitHub's cron floor |
| Upstream request ceiling | 60 req/min | The budget the cadence stretches to respect (ALERT-35, ALERT-36). Unmeasured — see the third open question |
| Effective interval | `max(base, criteria × 3 ÷ ceiling)` | Uniform across every criteria set |
| Worker slice | 25 criteria sets | Bounded so ALERT-12 holds inside the Vercel invocation timeout |
| Worker time budget | 45 s | Returns before the platform kills it, leaving the remainder queued |
| Retry budget | 3 attempts | Then `failed` (ALERT-19) |
| Backoff | 5 / 15 / 45 min | Deliberately longer than the poll interval — a failing upstream should be polled less, not more |
| Alerts per user | 20 | A proxy for the real constraint — total distinct criteria sets |
| Empty runs before unhealthy | 3 | ALERT-20 |

### Scheduling

`.github/workflows/alerts.yml`, `*/5 * * * *`, a matrix of K jobs each POSTing
to the run endpoint with the secret. Public repository, so Actions minutes are
unlimited; the alert count does not affect the workflow's cost because the
workflow only ever makes one request per job.

**This needs an ADR** —
[`0005-postgres-rate-limiting.md`](../decisions/0005-postgres-rate-limiting.md)
currently says, under "Rows accumulate", that there is no scheduler and no cron
should be added. That is scoped to pruning rate-limit rows, but a reader will
land on it and conclude the two contradict. `docs/decisions/0006-alert-scheduling.md`
must record the choice and amend that line to say what it actually governs.

### i18n

All new keys in `en.ts`, `es.ts` and `types.ts`: the alerts page title, the
criteria summary, the empty state and its call to action, the create-alert
control, the four error codes in `lib/i18n/errors.ts`, and the unsubscribe
confirmation page.

The email body resolves through `getTranslationsSync(locale)` with the locale
read from `User.locale` — the one path that cannot use `getTranslations()`,
because there is no request to read a cookie or `accept-language` from.

### Routing

`/alerts` and `/alerts/[id]` join `PROTECTED_PREFIXES` and the `matcher` in
`proxy.ts` (ALERT-30). `/api/alerts/unsubscribe` must **not** be protected — it
is followed from an inbox with no session.

`/alerts/[id]` is the matches view (ALERT-39, ALERT-40). It renders from
`AlertMatch` snapshots, which is what makes it work when a source is down and
what stops a match count linking nowhere.

## Decisions and rationale

### "New" cannot mean "published recently", so it means "not seen before"

This is the single fact the whole data model falls out of, and it is not
obvious — every other alerting system in the world works on timestamps.

`CarListing` ([`interfaces/listing.ts`](../../interfaces/listing.ts)) has no
published-date field, and it has none because the sources will not reliably give
one. Worse, they cannot be ordered by recency in the case that matters:
[`lib/wallapop/client.ts`](../../lib/wallapop/client.ts) switches `order_by` from
`newest` to `most_relevance` the moment a location is supplied, which is every
real alert; [`lib/cochesnet/client.ts`](../../lib/cochesnet/client.ts) records
that its time filter is not wired and recency is left to site default ordering;
the Milanuncios client sends no ordering parameter at all.

So an alert cannot ask "what appeared since 09:05?". It can only ask "what is
here now?", compare against what it saw last time, and treat the difference as
new. That requires a **persisted seen-set per criteria set**, and it makes the
seen-set the load-bearing structure rather than an optimisation.

Two consequences worth stating plainly:

**The first poll of a new alert must seed silently.** Everything matches on run
one. Without ALERT-2 the user's reward for creating an alert is an email
containing every Golf in Valencia.

**Detection is best-effort, and the spec will not pretend otherwise.** Under
relevance ordering a genuinely new listing can land on page four and be invisible
to a page-one poll. This is mitigated, not solved: the alert path sends
`timeFilter: "today"` — already supported by `searchSchema` and wired in the
Wallapop client — and forces `order_by=newest` for Wallapop even when a location
is set, which is a deliberate divergence from the interactive search path, where
relevance is the better ranking for a human reading a list. coches.net and
Milanuncios stay relevance-ordered until their date sorts are wired, which is
separate work against `docs/specs/data-sources.md`. An alert will therefore
sometimes miss a car. Claiming completeness we cannot deliver would be worse than
saying so.

### Criteria are deduplicated; alerts are subscriptions to them

The naive model is one row per user alert, polled independently. It does not
scale, and the thing it fails to scale against is not our compute — it is the
upstreams.

Every poll is three requests to reverse-engineered APIs behind bot protection.
A hundred users watching "BMW 3 Series under €15,000 in Madrid" would be three
hundred requests per lap for one distinct question. Getting the deployment's IP
blocked would not merely break alerts; it would break **search**, which is the
product. Upstream tolerance — not Vercel, not GitHub — is the real ceiling, and
deduplication is what buys headroom against it.

So `AlertCriteria` is keyed by a hash of the canonicalised `SearchInput` and
polled once. `Alert` is a user's subscription to one. Fan-out to subscribers
happens after discovery, against the database, costing nothing upstream
(ALERT-3).

### A Postgres queue, not an in-process loop and not Redis

The user asked for a queue by name, and the reason it is the right shape is
worth recording: it decouples *lap time* from *criteria count*. A single
sequential poller degrades from "every alert every five minutes" to "every alert
every N × five minutes" as alerts accumulate — the freshness target quietly
rots and nothing announces it. With a queue, the same work is drained by K
parallel workers, and K is a number that can be raised.

Postgres rather than Redis or a hosted queue, on exactly the reasoning in
[`0005-postgres-rate-limiting.md`](../decisions/0005-postgres-rate-limiting.md):
this project already has a Postgres it must talk to, and adding a service brings
a dependency, credentials and a second failure mode for a workload that is a few
hundred rows. `SELECT … FOR UPDATE SKIP LOCKED` is the standard mechanism and is
what makes ALERT-13 true in the database rather than in hopeful application code.

An in-process `setInterval` was never viable, for the same reason that ADR
rejected an in-memory rate limiter: Vercel gives no long-lived process, and
several instances each running their own timer is a duplicate-email generator.

### The freshness budget, and why it is a criterion rather than a hope

The target is **ten minutes from a listing appearing upstream to the email
arriving**. That decomposes:

| Segment | Budget | Bounded by |
| --- | --- | --- |
| Listing appears → next poll | ≤ 5 min | GitHub's minimum cron granularity |
| Poll → match recorded | ≤ 2 min | Slice size and worker count |
| Match recorded → email sent | ≤ 3 min | Notification drain in the same run |

Two things follow. The queue must be claimed **oldest-waiting first**
(ALERT-14), because a fair queue bounds worst-case lag while an arbitrary one
bounds only the average — and it is the worst case the target is about. And the
lap has to be **observable**: ALERT-31 makes each run report the age of the
oldest un-polled criteria set, so exceeding the target shows up in the run
output instead of as a user quietly getting stale alerts.

Scheduled GitHub Actions runs drift under load, sometimes by several minutes.
The cadence is approximate and the target is a design goal measured by ALERT-31,
not a guarantee to make to users.

### The cadence adapts to total load, not to how useful an alert is

Five-minute polling costs three upstream requests per criteria set per lap —
288 laps a day. Ten criteria is about six requests a minute and unremarkable. A
hundred is sixty a minute, and five hundred is three hundred a minute, all from
the deployment's single IP.

These are reverse-engineered endpoints behind bot protection, so there is no
published quota to stay under: there is an undocumented threshold, and the way
you learn where it is, is by crossing it. Crossing it blocks the IP that also
serves ordinary searches, so the failure mode is not "alerts stop" — it is **the
product stops**. That asymmetry is why the cadence is bounded by a configured
request rate rather than by a constant interval.

Above the ceiling the interval stretches **uniformly** (ALERT-36). The obvious
alternative — poll criteria sets that match often at five minutes and demote the
quiet ones to hourly — was considered and rejected, because it optimises exactly
backwards. An alert that matches once a month is usually the rare car the user
set the alert *for*; a broad one that matches hourly is the one they would
happily hear about late. Tiering by match rate delays the valuable alert to
speed up the disposable one.

Uniform stretching also keeps the system honest. ALERT-31 reports the lap age
and ALERT-37 the interval in force, so degradation is a number someone can watch
rather than something discovered when a user asks why their alert is slow.

### A floor on how vague an alert may be

Nothing else stops someone saving "every car in Spain". Its seed poll is
thousands of listings, it matches on nearly every lap, and it consumes the
shared upstream budget that protects search — while being useless as an alert,
because an alert that fires constantly is noise.

ALERT-38 requires at least one of brand, maximum price or location. That is a
deliberately low bar: it rejects only the degenerate case, and any alert a person
actually wants clears it without thinking. Capping matches per run instead was
rejected because it silently drops listings the user asked to be told about,
which is the one thing this feature must not do.

### Discovery and delivery are separate stages

The tempting design polls, and emails, in one step. It has a bug that loses
mail: `sendEmail` never throws and returns `false` on failure
([`lib/email/client.ts`](../../lib/email/client.ts)), so a Resend outage would
leave listings marked seen with nobody told, and they would never be new again.
The user silently misses exactly the cars they asked to be told about.

So discovery writes `AlertMatch` rows with `notifiedAt` null, and a separate
drain sends and stamps them. A failed send leaves the row pending and the next
run retries it (ALERT-24); a successful one cannot be sent twice (ALERT-23). It
also means an unconfigured mailer degrades honestly — matches accumulate and the
run says so (ALERT-25) — rather than the feature appearing to work.

### Partial upstream failure must not poison the seen-set

`Promise.allSettled` across three sources means one failing is routine, not an
outage — the search path already treats it that way. For alerts the subtlety is
different and sharper: if Wallapop errors and we record only what the other two
returned, nothing breaks. But if we were to mark the *criteria* as fully polled,
Wallapop listings that appeared during the outage would never be new again.

Hence ALERT-17: the seen-set is updated **per source**, and a source that failed
contributes nothing to it. The cost is that a source flapping produces a burst of
"new" listings when it recovers, which is the right way round — a late alert
beats a lost one.

### A silently empty source is the dangerous failure

Per [the runbook](../ARCHITECTURE.md#a-source-returns-nothing), a Milanuncios parse failure returns zero
ads rather than an error. In search that is fewer results. In alerts it is
indistinguishable from "nothing new", so an alert can be dead for weeks while
looking perfectly healthy — the worst failure mode this feature has, because
nothing surfaces it.

ALERT-20 tracks per-source health globally rather than per criteria, because a
broken parser breaks every criteria set at once; recording it a thousand times
would be a thousand copies of one fact.

### Unsubscribe is a signed token, not an alert id

The link lands in an inbox and must work with no session, so the id in it is a
bearer credential. A raw alert id would let anyone with one link enumerate and
deactivate other people's alerts. It is stored as a SHA-256 digest for the same
reason as `PasswordResetToken`: the raw value exists only in the email, so a
database leak does not hand over working unsubscribe links. Unlike a reset token
it does **not** expire — an unsubscribe link in a year-old email must still work,
because the alternative is a user who cannot make the mail stop.

ALERT-27 requires an invalid token to return the same response as a valid one,
matching the enumeration resistance the auth surfaces already hold to.

### A cap on alerts per user

Nobody asked for this, and it is recorded here rather than assumed. Each alert
is a standing claim on a rate-limited upstream, so an unbounded count is a way
for one account to consume the shared budget that protects search. Twenty per
user is a guess — high enough that no genuine user meets it, low enough to bound
the damage. The number belongs in Contracts › Constants and the reasoning is in the open questions.

### The user's locale has to be stored, because a cron has no request

Every other email in this system is sent from a request whose locale
`i18n/request.ts`'s `resolveLocale()` can resolve — a cookie, then
`accept-language`, then the default. The alert email is sent by a cron with
neither, and the default locale is `es`, so falling back would quietly mail
Spanish to every English-speaking user.

So `User` gains a `locale` column. The question is what writes it, and the
answer is **the language switcher the user already has** — `lib/hooks/useLocaleSwitcher.ts`
sets a cookie today, and for a signed-in user that same action persists to the
account (ALERT-33). It is the only signal that is an actual stated preference
rather than an inference.

Writing it at registration instead was considered and rejected twice over: it
records a guess from `accept-language` at one arbitrary moment, it ignores the
user later changing their mind, and it drags `auth-email-and-oauth.md` into this
spec's blast radius for no benefit.

That leaves the user who never touches the switcher — their browser says `en`,
the site renders in English through `getLocale()`, but nothing was ever
persisted, so the email would arrive in Spanish. Rather than a backfill on every
authenticated request, ALERT-34 captures the resolved locale **when an alert is
created**: a request context where `getLocale()` works, at precisely the moment
the answer starts to matter, costing one write per user.

A null locale still falls back to `DEFAULT_LOCALE` rather than blocking the send
(ALERT-32) — an alert in the wrong language beats no alert.

### An unused criteria set is deleted, seen-list and all

Unsubscribing deactivates an alert; deleting one is what releases the criteria
set. A criteria set nobody actively subscribes to stops being polled (ALERT-41),
and once no alert references it at all it is deleted together with its seen-list
(ALERT-42). A deleted alert is soft-deleted and still counts as referencing it
until it is purged 30 days later (`docs/specs/core-data-model.md`, DATA-12), so a
restored alert keeps its seen-list.

Retaining orphaned seen-lists — pruned after some idle period — was specified
first, on the reasoning that it saves re-notifying everything if someone
re-subscribes. That reasoning is wrong: ALERT-2 already seeds silently, so a
rebuilt seen-list emails nobody. The only thing retention buys is skipping one
seed poll, which is three requests once, and it costs a cleanup path plus rows
that accumulate forever. Deleting is both simpler and no worse.

An **inactive** alert keeps its criteria set, so its matches page still renders
and re-enabling it does not lose history. Only deletion releases it.

### Cascades and constraints are schema properties, not criteria

Deleting a user must delete their alerts and matches; a criteria set with no
remaining subscribers must stop being polled. Those are `onDelete: Cascade` and
a unique index, enforced by Postgres, and Vitest mocks Prisma — so a criterion
for them would test that Prisma was called correctly and prove nothing. They are
specified in Data model and left to review, exactly as the favorites spec did.

## Open questions

All settled. Kept as a record of what was decided and what would reopen it.

1. ~~Is twenty alerts per user right?~~ **Settled 2026-08-03: twenty.** It is a
   proxy for the real constraint, which is total distinct criteria sets — that
   is what the upstreams see. Reopen by watching `AlertCriteria` row count once
   live: a high deduplication ratio means the cap can rise.
2. ~~What language is the alert email in?~~ **Settled 2026-08-03: store it on
   the user, written by the existing language switcher.** `User.locale`
   (ALERT-33), backfilled from the request when an alert is created (ALERT-34),
   falling back to `DEFAULT_LOCALE` when null (ALERT-32). Writing it at
   registration was rejected — it records a guess at one arbitrary moment,
   ignores the user changing their mind, and would pull the auth spec into this
   one. Deriving it from the criteria's region was rejected too: wrong for
   exactly the user this app serves, someone in Spain who does not read Spanish.
   `cross-cutting.md` owns the switcher and should link here.
3. ~~Is 60 upstream requests/minute the right ceiling?~~ **Settled 2026-08-03:
   start at 60/min.** Roughly one request a second across three sources —
   comparable to a handful of people browsing, and enough for about a hundred
   criteria sets before the interval stretches. It is unmeasured, because nobody
   has published what these three tolerate. Reopen by watching the nightly
   `contract-live` job, which is the existing alarm for a source going wrong.
4. ~~Should a criteria set with no active subscribers be deleted or left?~~
   **Settled 2026-08-03: deleted** (ALERT-41, ALERT-42). The retention argument
   was wrong — seeding is already silent, so a rebuilt seen-list notifies nobody
   and retention only saves one poll. See Decisions and rationale.
   Amended 2026-10-01 by `docs/specs/core-data-model.md` (soft delete).
5. ~~Does forcing `order_by=newest` for Wallapop in the alert path belong here or
   in `data-sources.md`?~~ **Settled 2026-08-03: `data-sources.md`.** It changes
   a shared client's contract, and that spec owns it. **This spec cannot be
   implemented without a new criterion there** covering the alert path's
   ordering, plus its test — `data-sources.md` is `Implemented`, so editing it
   means `pnpm spec:check` demands the test in the same change.
