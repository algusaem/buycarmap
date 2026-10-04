# Backups and restore

BuyCarMap has no separate backup job. Its backups are Neon's point-in-time
history: Neon keeps a change history for the project, and any moment inside that
window can be turned into a new branch holding the data exactly as it was then.

## The facts that bound a restore

As measured through the Neon API on 2026-09-28:

| | |
| --- | --- |
| Project | `buycarmap` |
| Region | `aws-eu-central-1` |
| History window | 6 hours (`history_retention_seconds` 21600) |
| Plan | `free_v3` |

- **The `main` branch is production** ([Environments and operations](../ARCHITECTURE.md#environments-and-operations) has the deployment details).
- Local development and every git branch's own database now live in a local Docker Compose
  Postgres instead, holding only seeded or test data, never a copy of production
  ([Local database](../ARCHITECTURE.md#local-database), [ADR 0014](../decisions/0014-local-database-and-integration-tests.md)).
- **Anything older than 6 hours cannot be restored.** A mistake noticed later
  than that is permanent, so start as soon as it is noticed.

## Restoring

1. **Stop writes.** Pause the production deployment, or put the app in
   maintenance mode, so nothing is written to the old head between the
   comparison and the cutover. Otherwise changes made in that gap (a password
   reset, a deleted account, an unsubscribe) are lost or escape the steps
   below.
2. **Pick the timestamp.** Choose a moment before the damage and inside the last
   6 hours. Write it down in UTC.
3. **Create a branch from that timestamp**, with `main` as its parent. Either
   route works:
   - **Console.** In the Neon console, open the `buycarmap` project and create a
     new branch from `main`, choosing to branch from a point in time rather
     than from the current head, and enter the timestamp.
   - **API.** `POST /projects/{project_id}/branches` with a body whose `branch`
     object sets `parent_id` to the id of `main` and `parent_timestamp` to the
     timestamp in ISO 8601, plus an `endpoints` entry of type `read_write` so
     the branch can be connected to. Authenticate with a Neon API key
     (`NEON_API_KEY`); the project id is `NEON_PROJECT_ID`.
4. **Verify the branch** before touching production. Connect to it with its own
   connection string and check that the data you need is there, and that the
   rows written after the timestamp are the ones you expect to lose.
5. **Re-apply erasures.** Accounts deleted between the timestamp and now exist
   again on the restored branch. There is no deletion log, so compare `User`
   ids between the restored branch and the current head, and delete every id
   that is missing from the head again through the application's account
   deletion path or `prisma.user.delete`, so the cascade runs.
6. **Re-apply alert opt-outs.** Set `Alert.active = false` on the restored
   branch for every alert that is inactive on the old head, and delete the
   alerts that no longer exist there. Otherwise the next cron run emails
   digests to people who unsubscribed.
7. **Revoke every session.** A restore rolls back `User.password`,
   `User.passwordChangedAt`, the two-factor fields (`twoFactorSecret`,
   `twoFactorEnabledAt`, `twoFactorLastStep`), completed email changes and
   unlinked OAuth `Account` rows. That makes sessions and credentials that were
   revoked after the timestamp valid again. For each user whose `password`,
   two-factor fields, `email` or `Account` rows differ between the old head and
   the restored branch, re-apply the old head's values, including that user's
   `TwoFactorRecoveryCode` rows — a code used or regenerated after the
   timestamp would otherwise come back usable. Delete every unexpired
   `PasswordResetToken` and `EmailVerificationToken` row on the restored
   branch; a link consumed after the timestamp would otherwise be redeemable
   again, and the user can simply request a new one. Then set
   `passwordChangedAt` to the current time for every user on the restored
   branch. **This step is stale since phase 11** (BAUTH-2,
   [specs/core-better-auth.md](../specs/core-better-auth.md)): sessions are
   now rows in `sessions` (read by `lib/auth/auth.ts`'s Better Auth
   instance), not `passwordChangedAt`-gated JWTs, so revoking every session
   issued before the restore means deleting the restored branch's `sessions`
   rows for the affected users instead — the exact procedure needs
   confirming against the live restore flow before the next real restore.
8. **Put it into service**, one of two ways:
   - **Restore `main` from it**, so production keeps its branch and connection
     string. Neon can restore a branch from another branch or from a point in
     time; this replaces what `main` holds.
   - **Point `DATABASE_URL` at it.** Set the new branch's connection string as
     `DATABASE_URL` in Vercel and redeploy. `main` is then no longer what
     production reads, so treat the new branch as production from now on, and
     remember that the `pnpm db:branch` tooling forks from the project's
     **default** branch.
9. **Apply migrations if needed.** A branch taken before a migration ran lacks
   it; run `pnpm exec prisma migrate deploy` against it before the application
   code that needs it serves traffic.
10. **Remove the leftovers.** Once the restore is confirmed, delete the
    temporary restore branch (when `main` was restored from it) or the
    superseded old head (when `DATABASE_URL` was pointed at the new branch).
    Both hold a full copy of personal data, including accounts deleted
    afterwards. Also delete any backup branch Neon kept of the pre-restore
    state — it holds the same personal data.

Everything written to production between the timestamp and the restore is lost
by either route, unless it is copied across from the old head first.

## What a restore brings back

Everything, including data that was deleted on purpose. A restore to a moment
before an account deletion brings that account back, which is why
[deletion.md](../privacy/deletion.md) states the window.
