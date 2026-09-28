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

- **The `main` branch is production.** There is no separate production database.
  The deployment at https://buycarmap.vercel.app reads `main` through
  `DATABASE_URL`.
- The `claude/*` branches are per-worktree throwaways created by
  `pnpm db:branch` ([Neon branch lifecycle](../ARCHITECTURE.md#neon-branch-lifecycle)).
  They are not backups.
- **Anything older than 6 hours cannot be restored.** A mistake noticed later
  than that is permanent, so start as soon as it is noticed.

## Restoring

1. **Pick the timestamp.** Choose a moment before the damage and inside the last
   6 hours. Write it down in UTC.
2. **Create a branch from that timestamp**, with `main` as its parent. Either
   route works:
   - **Console.** In the Neon console, open the `buycarmap` project and create a
     new branch from `main`, choosing to branch from a point in time rather
     than from the current head, and enter the timestamp.
   - **API.** `POST /projects/{project_id}/branches` with a body whose `branch`
     object sets `parent_id` to the id of `main` and `parent_timestamp` to the
     timestamp in ISO 8601, plus an `endpoints` entry of type `read_write` so
     the branch can be connected to. Authenticate with a Neon API key
     (`NEON_API_KEY`); the project id is `NEON_PROJECT_ID`.
3. **Verify the branch** before touching production. Connect to it with its own
   connection string and check that the data you need is there, and that the
   rows written after the timestamp are the ones you expect to lose.
4. **Put it into service**, one of two ways:
   - **Restore `main` from it**, so production keeps its branch and connection
     string. Neon can restore a branch from another branch or from a point in
     time; this replaces what `main` holds.
   - **Point `DATABASE_URL` at it.** Set the new branch's connection string as
     `DATABASE_URL` in Vercel and redeploy. `main` is then no longer what
     production reads, so treat the new branch as production from now on, and
     remember that the `pnpm db:branch` tooling forks from the project's
     **default** branch.
5. **Apply migrations if needed.** A branch taken before a migration ran lacks
   it; run `pnpm exec prisma migrate deploy` against it before the application
   code that needs it serves traffic.

Everything written to production between the timestamp and the restore is lost
by either route, unless it is copied across from the old head first.

## What a restore brings back

Everything, including data that was deleted on purpose. A restore to a moment
before an account deletion brings that account back, which is why
[deletion.md](../privacy/deletion.md) states the window.
