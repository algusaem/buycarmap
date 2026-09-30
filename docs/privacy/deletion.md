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
3. It runs `prisma.user.delete` on the user's row.

Every relation owned by the user is `onDelete: Cascade`, so the same delete
removes their `Account` (OAuth links), `Session`, `Favorite`, `Alert` (and each
alert's `AlertMatch` rows), `SearchHistory`, `PasswordResetToken`,
`EmailVerificationToken` and `TwoFactorRecoveryCode` rows. The cascade is
enforced by Postgres, not by application code
([Cascades](../ARCHITECTURE.md#cascades)).

## What survives

- **`AlertCriteria`.** The saved search behind an alert has no link to a user,
  because one criteria set is shared by everyone watching the same search. It
  can hold the coordinates the user chose, and it is not removed when the
  account is ([#21](https://github.com/algusaem/buycarmap/issues/21)).
- **`PendingRegistration` rows** for the same address are not linked to the
  `User`. Until it expires; the expired row is deleted at the next
  opportunistic prune (2% of calls), so there is no fixed upper bound.
- **`RateLimit` rows** whose key embeds the user's email or IP are not linked
  either. Until it expires; the expired row is deleted at the next
  opportunistic prune (1% of calls), so there is no fixed upper bound.

Unsubscribing from an alert is not a deletion: it sets `Alert.active` to false
and keeps the row until the account is deleted.

## No export

There is no way for a person to export their data
([#20](https://github.com/algusaem/buycarmap/issues/20)).

## Backups

Neon keeps 6 hours of history for the project. Deleted data can therefore be
restored from point-in-time history for up to 6 hours after the deletion; after
that it is gone from the production branch's history, though the forks listed
above still hold it until they are removed. The restore procedure is
[backups.md](../operations/backups.md).
