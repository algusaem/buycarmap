# Deletion

How a person's data is erased, what survives the erasure, and how long a deleted
account can still be restored from backups. The fields themselves are listed in
[data-inventory.md](data-inventory.md).

## Erasing an account

A user deletes their own account from `/account`, through the `deleteAccount`
server action in `server/account/actions.ts` (its database work in
`server/account/service.ts`):

1. It calls `getCurrentUser()` first, so only a signed-in user with a
   non-revoked session can reach it, and it only ever deletes that user.
2. A credentials account must re-enter its current password; a missing or wrong
   password is refused. An OAuth-only account has no password to ask for.
3. It runs `prisma.user.delete` on the user's row and, in the same transaction,
   releases the criteria sets the user's alerts referenced
   ([alerts.md](../specs/alerts.md), ALERT-45).

Every relation owned by the user is `onDelete: Cascade`, so the same delete
removes their `Account` (OAuth links), `Session`, `Favorite`, `Alert` (and each
alert's `AlertMatch` rows), `SearchHistory`, `PasswordResetToken`,
`EmailVerificationToken`, `TwoFactorRecoveryCode` and `TwoFactor` (Better
Auth's own `twoFactor` plugin table, phase 11, [0018](../decisions/0018-better-auth.md))
rows. The cascade is enforced by Postgres, not by application code
([Cascades](../ARCHITECTURE.md#cascades)) — verified directly against
`prisma/schema.prisma`: both `Session.user` and `TwoFactor.user` declare
`onDelete: Cascade`.

## What survives

- **`AlertCriteria`, while someone else still watches it.** The saved search
  behind an alert has no link to a user, because one criteria set is shared by
  everyone watching the same search, and it can hold the coordinates the user
  chose. Deleting the account deletes each criteria set no other alert
  references, with its seen-list; one that another user's alert still
  references stays, because it is that user's saved search too
  ([alerts.md](../specs/alerts.md), ALERT-45;
  [#21](https://github.com/algusaem/buycarmap/issues/21)).
- **`PendingRegistration` rows** for the same address are not linked to the
  `User`. Until it expires; the expired row is deleted at the next
  opportunistic prune (2% of calls), so there is no fixed upper bound.
- **`RateLimit` rows** whose key embeds the user's email or IP are not linked
  either. Until it expires; the expired row is deleted at the next
  opportunistic prune (1% of calls), so there is no fixed upper bound.

Unsubscribing from an alert is not a deletion: it sets `Alert.active` to false
and keeps the row until the account is deleted.

## Removing a favorite or an alert

Removing a `Favorite` or deleting an `Alert` (docs/specs/core-data-model.md, DATA-10..12) sets
`deletedAt` instead of removing the row, so a mistaken removal can be undone. Every read excludes a
soft-deleted row — its owner included — and saving over one restores it instead of erroring.
`server/retention/service.ts`'s `purgeSoftDeletedRows`, called from the same opportunistic paths
that already prune expired auth rows, hard-deletes a soft-deleted `Favorite` or `Alert` **30 days**
after `deletedAt`. Account deletion is unaffected by any of this: it still erases every row the
account owns at once, soft-deleted or not, exactly as described above.

## No export

There is no way for a person to export their data
([#20](https://github.com/algusaem/buycarmap/issues/20)).

## Backups

Neon keeps 6 hours of history for the project. Deleted data can therefore be
restored from point-in-time history for up to 6 hours after the deletion; after
that it is gone from the production branch's history, though the forks listed
above still hold it until they are removed. The restore procedure is
[backups.md](../operations/backups.md).
