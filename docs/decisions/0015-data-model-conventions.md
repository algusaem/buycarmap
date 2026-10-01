# 0015 — Data model conventions

Status: Accepted · Date: 2026-10-01 · Resolves ADR 0007 row 18

## Context

[ADR 0007](0007-adopt-core-rules.md) row 18 lists phase 8's deviation: `cuid()` ids (and natural
string keys on `RateLimit` and `SourceHealth`), camelCase table and column names, `timestamp`
without time zone, no `createdById` / `updatedById` / `deletedAt` / `version`, free-text
`AlertPollJob.status`, `onDelete: Cascade` on every relation, and no branded ids.
[docs/specs/core-data-model.md](../specs/core-data-model.md) closes it. This record makes
permanent the owner's decisions behind that spec and the migration that implements it.

## Decided

**Every model is re-keyed now, users included.** `cuid()` ids become `uuid(7)`, and every foreign
key moves with its parent. Every signed-in user is signed out once when this ships — their JWT
carries the old id, which matches no row, and that is treated as a revoked session, the same as
any other revocation. Users are signed out once again when phase 11 moves to Better Auth; this is
accepted as the cost of re-keying rather than leaving `cuid()` ids in place until then.

**snake_case renames happen in the same migration as the re-key**, not across two releases behind
compatibility views. Production sees a few seconds of errors while `prisma migrate deploy` runs and
the new code has not yet rolled out — a one-step migration instead of the usual expand/contract
(`RULES.md` §11) — because the two are the same breaking change (both touch every table), and a
compatibility view over a renamed, re-keyed table would have to re-key inside the view too.

**Every standard column on every model**, applying `STACK.md` §9 to the letter rather than only to
the models that use a given column today: `createdAt`, `updatedAt`, `createdById`, `updatedById`,
`deletedAt`, `version`. Where a column has no use yet — `deletedAt` on a rate-limit row,
`createdById` on a row only the cron ever writes — it exists for uniformity and stays unused
(DATA-14), rather than special-casing models that don't need it today and having to add it later
under the same migration cost this one is paying once.

**Soft-deleted rows are kept for 30 days.** `Favorite` and `Alert` rows get `deletedAt` set instead
of being removed, so a mistaken deletion can be undone; `server/retention/service.ts` erases them
30 days after `deletedAt`, opportunistically, from the same paths that already prune expired auth
rows (`maybePruneExpiredAuthRows`) — no new scheduler. Account deletion is unaffected: it still
erases at once, because erasure is the user's right and nothing about soft-deleting other people's
rows changes that (`RULES.md` §12).

**Unsubscribe tokens move off the id.** An unsubscribe link already sent has to keep working after
the id it was built from changes. `Alert` gains `unsubscribeSubject`, and the migration copies each
alert's *old* (pre-migration) id into it before the id column itself is replaced, so
`unsubscribeTokenFor` can be rebuilt from a stored value instead of the primary key. New alerts set
`unsubscribeSubject` to their own (newly generated) id — generated in the service before the insert,
not in a follow-up update, so there is no second write and no transaction needed for it.

**The migration is one hand-written SQL script**, because none of its steps are expressible through
`prisma migrate dev`'s inferred diff: the UUIDv7 backfill has to run in `createdAt` order, every
foreign key has to be rewritten through a join against its parent's new id before the old columns
drop, and the table/column renames have to happen in the same transaction as the type changes so
there is no window where the schema matches neither the old nor the new code. It creates its own
`uuid_generate_v7(timestamptz)` function (Postgres 17 has no built-in one) using `pgcrypto` for the
random bits, so ids keep sorting in creation order the way the `cuid()`s they replace did.

## What would change our mind

Deduplicating the same car across sources, when it lands, is a separate spec and does not touch
this migration. Moving the auth tables to Better Auth's schema (phase 11) re-keys `User` sessions a
second time regardless of anything decided here.
