# Data model conventions (migration phase 8)

Key: DATA
Status: Implemented
Last updated: 2026-10-01

---

## Problem

The 17 Prisma models predate the core and deviate from `STACK.md` §9 in every convention (`docs/decisions/0007-adopt-core-rules.md` row 18):

- **Ids.** Ids are `cuid()` text, and `RateLimit` and `SourceHealth` are keyed by a natural string. Nothing in TypeScript stops an alert id being passed where a user id is expected.
- **Naming and types.**
  - Table and column names are camelCase in Postgres.
  - The 31 `DateTime` columns are `timestamp` without time zone.
  - `AlertPollJob.status` is free text. Only a comment lists `pending · running · failed`.
- **Missing columns.** No model has `createdById`, `updatedById`, `deletedAt` or `version`, so:
  - a deletion is irreversible the moment it happens;
  - two tabs editing the same profile silently overwrite each other.
- **Relations.** All 12 relations use `onDelete: Cascade`, and nothing records why.

This is phase 8 of ADR 0007: row 18.

## Acceptance criteria

`unit` means a Vitest test with no database; `node` means a `*.integration.test.ts` against the Testcontainers Postgres unless stated; `e2e` means Playwright.

### Ids

- [x] DATA-1 · unit — Every model's primary key is `id String @id @default(uuid(7)) @db.Uuid`, and every foreign key to it is `@db.Uuid`.
  - `RateLimit` and `SourceHealth` gain such an `id`. Their natural keys (`key`, `source`) become `@unique`.
  - `VerificationToken` gains an `id`. Its `[identifier, token]` stays `@@unique`.
  - A test reads `prisma/schema.prisma` and fails on any `cuid()` or any `@id` that is not a UUID.
- [x] DATA-2 · node — The migration converts every existing id to a UUIDv7 and rewrites every foreign key to match.
  - Every row survives, and so does every relation: a user's favorites, alerts and matches still belong to that user.
  - Rows get UUIDv7 values in `createdAt` order, so ids sort like the rows they replace.
  - The migration is proven on a migrated copy of a fixture database holding one of each relation, checking counts and joins before and after. It is then rehearsed on a Neon branch of production before merge (Contracts).
- [x] DATA-3 · unit — `lib/ids.ts` exports a branded type per model: `UserId`, `AlertId`, `FavoriteId` and so on, each `string & { readonly __brand: "<Model>Id" }`.
  - Every function in `server/*/service.ts` and `server/*/queries.ts` that takes an entity id takes its branded type.
  - Every Zod schema that accepts an id from the client parses it with `z.uuid().brand<"<Model>Id">()`.
  - A type-level test (`expectTypeOf`) proves that passing an `AlertId` where a `UserId` is expected does not compile.
- [x] DATA-4 · node — Every signed-in user is signed out once when this ships: their JWT carries the old id, `getCurrentUser()` finds no user with it, and it treats that as a revoked session (existing behaviour). Signing in again works. The PR states the one-time sign-out.

### Names and types

- [x] DATA-5 · unit — Every model maps to a snake_case plural table (`@@map("alert_poll_jobs")`) and every multi-word field to a snake_case column (`@map("created_at")`). TypeScript names do not change. A test fails on any model without `@@map` or any multi-word field without `@map`.
- [x] DATA-6 · node — Every `DateTime` column is `@db.Timestamptz(3)`. The migration converts existing values with `AT TIME ZONE 'UTC'`, so an instant is unchanged: a row created at `2026-09-30 10:00:00` UTC reads back as the same instant.
- [x] DATA-7 · node — `AlertPollJob.status` is a Prisma enum `AlertPollJobStatus { pending running failed }`. Existing rows convert with a cast. A value outside the enum is rejected by the database.

### Standard columns

- [x] DATA-8 · unit — Every model has `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt` and `version Int @default(1)`.
  - `createdById` and `updatedById` are nullable FKs to `User` with `onDelete: SetNull`. Null means the system wrote the row: the cron, the rate limiter, sign-up before the user exists.
  - A test fails on any model missing one of these.
- [x] DATA-9 · node — Services set `createdById` on create and `updatedById` on update to the signed-in user's id wherever one exists, and leave them null for system writes.

### Soft delete

- [x] DATA-10 · node — Deleting a favorite or an alert sets `deletedAt` instead of removing the row. Every read in `server/*/queries.ts` and `server/*/service.ts` excludes rows with `deletedAt` set, through one helper in `lib/db/`. A user never sees, and the alert runner never polls, something deleted.
- [x] DATA-11 · node — Saving a favorite or creating an alert that matches a soft-deleted row (the same `[userId, listingId]` or `[userId, criteriaId]` unique) restores that row, clearing `deletedAt` and bumping `version`, instead of failing on the unique constraint.
- [x] DATA-12 · node — Soft-deleted rows are erased 30 days after `deletedAt` (owner's decision, 2026-10-01). The purge is opportunistic, run from the same paths that already prune expired auth rows (`maybePruneExpiredAuthRows`), with no new scheduler. `docs/privacy/data-inventory.md` records the 30-day retention for every soft-deletable personal field.
- [x] DATA-13 · node — Deleting an account still erases at once, as today. The user row and every row that belongs to it are removed, not soft-deleted (`RULES.md` §12). `createdById`/`updatedById` pointing at that user become null.
- [x] DATA-14 · node — System rows are still removed outright when pruned: expired tokens, rate-limit windows, finished poll jobs and stale seen listings. `deletedAt` exists on them for uniformity and is never set.

### Optimistic locking

- [x] DATA-15 · node — The two form-based edits of a `User`, `updateProfile` and `changePassword`, assert the `version` the form rendered and increment it, in one `updateMany({ where: { id, version } })`.
  - When no row matches, the action returns `AUTH_ERROR.conflict` and changes nothing.
  - Every other write still increments `version` (two-factor, `setLocale`, the system writes) without asserting it, because nothing the user edits by hand is at stake there.
  - Alerts and favorites have no update today, only create and delete.
- [x] DATA-16 · unit + e2e — On `conflict` the UI shows a translated message, in both locales, telling the user that the item changed elsewhere and to reload. The e2e test opens `/account` in two pages, saves a new name in the first, saves another in the second, and sees the message there. The first name stays.

### Relations

- [x] DATA-17 · unit — The 12 existing `onDelete: Cascade` relations stay, because each child is meaningless without its parent. Each carries a one-line schema comment saying so. Any other relation is `Restrict` unless its comment justifies otherwise. A test fails on a `Cascade` without a comment on the line above.

### Docs

- [x] DATA-18 · unit — `docs/ARCHITECTURE.md` › Data model describes ids, naming, the standard columns, soft delete and purge, optimistic locking and the cascade rule. `docs/privacy/data-inventory.md` and `docs/privacy/deletion.md` record the 30-day soft-delete retention and that account deletion still erases at once. ADR 0015 records the decisions below. ADR 0007 marks row 18 `Resolved in phase 8`.

## Worked examples

- **DATA-1**: `model Favorite { id String @id @default(cuid()) … }` → the test fails, naming `Favorite`.
- **DATA-2**: the fixture has user U (cuid `clx…a`), with favorite F, alert A on criteria C, match M on A, and a seen listing S on C. After the migration:
  - the row counts are equal: 1 each;
  - `F.userId = U.id`, `A.userId = U.id`, `A.criteriaId = C.id`, `M.alertId = A.id`, `S.criteriaId = C.id`;
  - every id matches `^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.
- **DATA-6**: the old `timestamp` value `2026-09-30 10:00:00` → `timestamptz` `2026-09-30T10:00:00.000Z`.
- **DATA-10**: user A deletes favorite F → `F.deletedAt` is set, and A's favorites page and `listFavorites` no longer include F.
- **DATA-11**: A saves the same listing again → the same row comes back, with `deletedAt = null` and `version = 2`.
- **DATA-12**: F deleted 31 days ago → erased on the next prune. Deleted 29 days ago → kept.
- **DATA-15**: user U at `version 3`, name "Ana".
  - Page 1 saves "Ana María", sending `version 3` → saved, `version 4`.
  - Page 2 then saves "Anita", sending `version 3` → `{ success: false, error: "conflict" }`. The name stays "Ana María" at `version 4`.

## Data model

All 17 models change: ids, names, types, standard columns. There is one hand-written migration. It is **not compatible with the previous code**: the table renames and the id type change break the old code for the seconds between `migrate deploy` and the new code going live. The owner accepted this on 2026-10-01, and the migration does it in one step rather than expand/contract. No column is dropped without its data moving first.

## Permissions

No change. Soft-deleted rows are invisible to everyone, their owner included. Restoring happens only through DATA-11.

## Edge cases

- **An unsubscribe link in an email sent before the migration.** The token is an HMAC of the alert's old id, and its hash is stored on the alert. The migration copies each alert's old id into a new `unsubscribeSubject` column, and tokens are then derived from that column instead of the id. Old links keep working, and new alerts use their UUID as the subject.
- **A user signed in on several devices.** Every device is signed out once (DATA-4).
- **The OAuth adapter.** NextAuth's Prisma adapter keeps working on the mapped tables, because it uses the Prisma model names. It creates users with the UUIDv7 default.
- **A soft-deleted alert's criteria set.** When no active, non-deleted alert uses it, the runner stops polling it, exactly as with an unsubscribed alert today.
- **`version` on a create.** It starts at 1. A restore through DATA-11 increments it.

## Out of scope

- **Re-keying in two phases (expand/contract)** for this migration: the owner accepted the downtime window.
- **Moving the auth tables to Better Auth's schema**: phase 11.
- **Lookup tables.** No fixed set needs translated labels today, so enums are enough.
- **`EXPLAIN` checks at volume**: issue tracked from phase 7.

## Contracts

- **The migration.** One hand-written SQL migration. It:
  1. creates a `uuid_generate_v7()` SQL function, because Postgres 17 has no built-in;
  2. adds the new uuid columns and fills them in `createdAt` order;
  3. rewrites the FKs through joins and swaps the columns;
  4. renames the tables and columns;
  5. converts the timestamps and the status enum;
  6. adds the standard columns and `unsubscribeSubject`.

  It never drops a column before its data has been copied. Approval of this spec authorises the destructive steps and the raw SQL (`RULES.md` §1, §11).
- **Rehearsal before merge (manual action by the owner).**
  1. Create a Neon branch of production.
  2. Run `prisma migrate deploy` against it from this branch.
  3. The checks of DATA-2 run against it: row counts and joins before and after.
  4. The branch is deleted afterwards.

  The merge happens only after the rehearsal passes.
- **Backup.** Right before merging, the owner creates a Neon branch of production named `pre-phase-8`. It is the restore point, beyond the 6-hour point-in-time window (`docs/operations/backups.md`).
- **New code.** `conflict` is added to `AUTH_ERROR`, with copy in both locales.

## Decisions and rationale

### Every model is re-keyed now, users included (owner's decision, 2026-10-01)

Users are signed out once in this phase, and will be again when phase 11 moves to Better Auth.

### snake_case renames in one step (owner's decision, 2026-10-01)

The tables are renamed in the same migration, accepting a few seconds of errors while production deploys, instead of compatibility views across two releases.

### Every standard column on every model (owner's decision, 2026-10-01)

`STACK.md` §9 is applied to the letter. Where a column has no use today, for example `deletedAt` on a rate-limit row or `createdById` on a system row, it exists for uniformity and is documented as unused (DATA-14).

### Soft-deleted rows are kept for 30 days (owner's decision, 2026-10-01)

That leaves a margin to undo a mistaken deletion. Account deletion still erases at once, because erasure is the user's right.

### Unsubscribe tokens move off the id

An unsubscribe link has to outlive the migration. Deriving it from a stored subject instead of the primary key keeps every link already sent working.
