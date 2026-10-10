# Local database, integration tests and seeds (migration phase 7)

Key: TEST
Status: Implemented
Last updated: 2026-10-05

---

## Problem

The test and local-database setup predates the core and deviates from it in three places (`docs/decisions/0007-adopt-core-rules.md` rows 16, 17 and 27):

- **Tests never touch a real database.** 21 test files mock `@/lib/db/prisma`. Queries, constraints, cascades and transactions are never exercised: a wrong `where`, a missing unique index or a broken `$transaction` passes every test (`STACK.md` §16, "mocked Prisma proves nothing").
- **Local development runs on a Neon branch per git branch.** It needs network access and a Neon API key. It also puts development data on the same provider and project as production (`STACK.md` §2).
- **There are no seeds and no factories.** A fresh database is empty, fixtures are hand-built objects, and the DB-backed e2e suite creates its own rows (`RULES.md` §11, `STACK.md` §3, §16).
- **Coverage leaves out `scripts/`** and still excludes `**/index.ts` (`RULES.md` §3).

This is phase 7 of ADR 0007: rows 16, 17 and the rest of row 27.

Added on 2026-10-05, outside phase 7 (TEST-15): **a missing visual baseline could not be generated.** Each visual test skipped whenever its platform had no baseline, including under `pnpm test:visual --update-snapshots`, the command its own skip reason recommends, so that run wrote nothing.

## Acceptance criteria

`unit` means a Vitest test with no database; `node` means a `*.node.test.ts`; `e2e` means Playwright.

### Local database

- [x] TEST-1 · unit — `docker-compose.yml` defines one Postgres service. It uses the image `postgres:17-alpine`, the major version Neon runs (17.11 measured on 2026-09-30), and a named volume. It is published on `localhost:5433`, so it cannot collide with a Postgres already on 5432. `pnpm db:up` starts it and `pnpm db:down` stops it without deleting the volume.
- [x] TEST-2 · node — `pnpm db:branch` now creates a database for the current git branch inside the Compose Postgres, instead of a Neon branch. The name is `buycarmap_` plus the sanitized branch name. The script runs `prisma migrate deploy` on it and writes its `DATABASE_URL` into the worktree's `.env`, leaving every other line untouched. It is idempotent: an existing database is reused. `pnpm db:branch:rm` drops the current branch's database. Neither ever connects to a non-local host.
- [x] TEST-3 · node — `scripts/require-branch-db.mjs` and its hook keep refusing database commands from a worktree whose `.env` has no `DATABASE_URL`. They now also refuse when that URL points at a host that is not `localhost` or `127.0.0.1`. This stops a worktree from touching Neon, and so production.
- [x] TEST-4 · unit — `.env.example` points `DATABASE_URL` at the Compose database. The Neon API variables used only by the old `db:branch` are removed from `.env.example` and from `lib/env.ts` if they are declared there. The README's setup and worktree sections describe Docker Desktop, `pnpm db:up` and `pnpm db:branch`.
- [x] TEST-16 · unit — `docker-compose.yml` fixes the Compose project name to `buycarmap`, so every checkout of the repository — the main one and every git worktree — starts, reaches and stops the same single Postgres container and volume; `pnpm db:branch` from a worktree reaches it.

### Integration tests

- [x] TEST-5 · unit — Vitest has three projects:
  - `unit`: jsdom, `*.test.ts(x)`;
  - `node`: Node environment with no database, `*.node.test.ts`;
  - `integration`: Testcontainers Postgres, `*.integration.test.ts`.

  `pnpm test:unit` runs `unit` and `node`. `pnpm test:integration` runs `integration`. `pnpm test` runs all three with coverage. The pre-commit hook still runs only related tests from the no-database projects.
- [x] TEST-6 · node — The `integration` project's global setup starts one `postgres:17-alpine` container per run with `@testcontainers/postgresql`. It applies the migrations once to a template database, and gives each Vitest worker its own database copied from that template, so files run in parallel without sharing rows. Before each test, every application table is truncated, `_prisma_migrations` excepted, so every test starts empty and order does not matter. The container is stopped after the run.
- [x] TEST-7 · unit — Every test that mocked `@/lib/db/prisma` becomes an `*.integration.test.ts` that reads and writes real rows. It keeps its criterion ids and its expected values. A Prisma mock survives only where the test's point is a database failure or the absence of database access: the `/api/health/db` 503 path, the PLAT-12 "unexpected failure rejects" cases and PLAT-19's "never touches the database". A test lists every remaining `vi.mock("@/lib/db/prisma"` and fails on any file outside that allow-list.
- [x] TEST-8 · node — The `RULES.md` §10 rejection tests run against the real database. For favorites and alerts, a signed-in user never receives or changes another user's rows: user B's `listFavorites`, `removeFavorite`, `deleteAlert` and the `alerts/[id]` read, run against user A's data, leave A's rows unchanged and return nothing of A's.
- [x] TEST-9 · unit — CI runs `pnpm check`, integration tests included, on the GitHub-hosted Ubuntu runner, whose Docker Testcontainers uses. The workflow changes only if the run proves it has to, and any such change is listed in the PR.

### Factories and seeds

- [x] TEST-10 · unit — `test/factories/` holds faker-based builders, one per model the tests create: user, favorite, alert criteria, alert, alert match, and the auth token rows the tests use. Each builder returns valid data for its Prisma `create`, takes overrides, and uses a seeded faker, so a failing test reproduces. They replace hand-built database fixtures. Pure fixtures under `test/fixtures/` that never reach the database stay.
- [x] TEST-11 · node — `prisma/seed.ts`, run by `pnpm db:seed` through Prisma's seed hook, fills an empty database with:
  - 3 users with a known development password (`buycarmap-dev-1`), documented in the README; one of them has two-factor on, with its secret printed by the seed;
  - 10 favorites spread across those users;
  - 3 alerts with matches.

  It is deterministic, since faker is seeded, and idempotent: rerunning it on a seeded database changes nothing. Seed data is written by its own code, not by the test factories (`STACK.md` §3).
- [x] TEST-12 · node — The seed refuses to run, and exits non-zero with a message naming the host, when `DATABASE_URL` is not `localhost` or `127.0.0.1`. It never runs in the Vercel build or in CI.

### Coverage

- [x] TEST-13 · unit — Vitest's coverage `include` adds `scripts/**` and `prisma/seed.ts`. The `**/index.ts` exclusion is removed, since the repository has no such file. The thresholds stay at 89/85/84/89. If the new files would drop coverage below them, the work stops and the owner decides; the thresholds are never lowered (`RULES.md` §3).

### Docs

- [x] TEST-14 · unit — `docs/ARCHITECTURE.md` › Testing describes the three projects, the per-worker databases, truncation and the factories. The environment section describes Docker Compose, the per-branch local databases and the seed. `CLAUDE.md`'s Commands and "Worktrees and the dev database" sections are updated. ADR 0014 records the decisions below, and ADR 0007 marks rows 16, 17 and 27 `Resolved in phase 7`.

### Visual baselines

- [x] TEST-15 · e2e — Each test in `e2e/visual.spec.ts` skips when the current platform has no baseline and the run is not updating snapshots, with a reason naming the platform and the command that generates the baseline. Under `pnpm test:visual --update-snapshots` (`updateSnapshots` `changed` or `all`) it runs instead, so the missing baseline is written. A plain run never writes one; a new baseline is committed only after the owner has reviewed the image.

## Worked examples

- **TEST-2**:

  | Git branch | Database |
  | --- | --- |
  | `chore/adopt-testing` | `buycarmap_chore_adopt_testing` |
  | `claude/Fix-Map.v2` | `buycarmap_claude_fix_map_v2` |

  Lowercase; every character outside `a-z0-9` becomes `_`, and runs of `_` collapse. Names longer than 63 bytes, Postgres' limit, are cut to 54 characters plus `_` and the first 8 hex characters of the branch name's SHA-1.
- **TEST-3**:
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/buycarmap_x` → allowed.
  - `DATABASE_URL=postgresql://u:p@ep-dawn-recipe.c-2.eu-central-1.aws.neon.tech/neondb` → refused, naming the host.
- **TEST-6**:
  - Test A creates a favorite, then test B in the same file lists favorites → B sees none.
  - Two files running at the same time each create a user with the email `ana@example.test` → neither fails on the unique constraint.
- **TEST-7**, `saveFavorite(listing)` for a signed-in user → one `Favorite` row exists afterwards with that user id and listing id, read back with Prisma, not asserted on a mock call.
- **TEST-12**:
  - `DATABASE_URL` host `localhost` → seeds.
  - `DATABASE_URL` host `ep-…-pooler….neon.tech` → exits 1 with a message containing `ep-…-pooler….neon.tech`, and writes nothing.
- **TEST-15**, on Linux with only `login-visual-win32.png` and `map-visual-win32.png` committed. The failure it fixes: `pnpm test:visual --update-snapshots`, the command the skip reason recommends, skipped both tests and wrote nothing.
  - `pnpm test:visual` → 2 skipped, 0 passed. Reason: `No linux baseline for "login". Generate one on this platform with: pnpm test:visual --update-snapshots`. No file is written.
  - `pnpm test:visual --update-snapshots` → 2 passed, and `login-visual-linux.png` and `map-visual-linux.png` are written to `e2e/visual.spec.ts-snapshots/`.
  - `pnpm test:visual --update-snapshots=none` → 2 skipped, with the same reason: it is not updating snapshots.
  - On Windows, where both baselines exist, a plain run compares against them. `--update-snapshots` overwrites any baseline that differs instead of failing, so its output goes to the owner for review like a new baseline.
- **TEST-16**, issue #80: the main checkout's Postgres is running; from a worktree at `.claude/worktrees/<name>`, `pnpm db:up` fails with `Bind for 0.0.0.0:5433 failed: port is already allocated`, and `pnpm db:branch` fails with `service "postgres" is not running` even though Postgres answers on `localhost:5433`. The failure it fixes: with no top-level `name:` in `docker-compose.yml`, Compose names each checkout's project after its directory, so the worktree gets its own project, container and port instead of reaching the main checkout's.
  - After the fix, `pnpm db:up` from the worktree reports the existing `buycarmap` container already running.
  - `pnpm db:branch` from the worktree reaches that container and creates or reuses `buycarmap_<branch>` inside it, the same as from the main checkout.

## Data model

No schema change. No migration.

## Permissions

No change. TEST-8 proves the existing rules against real rows.

## Edge cases

- **Docker is not running.** `pnpm test:integration` and `pnpm check` fail at global setup with a message saying Docker Desktop must be running. They never skip the integration tests silently.
- **Windows.** Testcontainers talks to Docker Desktop's engine. The Compose port and the container port never clash with the Postgres Testcontainers starts, because Testcontainers picks a random free port.
- **A branch database whose migrations drifted.** `pnpm db:branch:rm` and then `pnpm db:branch` rebuilds it. Only this branch's local database is affected, never a shared one.
- **The seed on a non-empty database** that has users it did not create leaves them alone. It only adds its own users, identified by their fixed seed emails.
- **E2E.** The DB-backed Playwright suite (`pnpm test:e2e:db`) runs against the branch's local database instead of a Neon branch.

## Out of scope

- **The preview seed-only parent branch and a database per preview**: phase 12. Previews keep the production database until then.
- **Running the DB-backed e2e suite in CI.** It needs a database service in the workflow; it becomes a separate issue.
- **Staging with anonymised data**: phase 12.
- **`EXPLAIN` checks for list queries at volume** (`STACK.md` §16): a separate issue. The lists are small today.
- **Deleting the existing Neon development branches.** That is a manual action after merge, listed in the PR.

## Contracts

- **New dev dependencies**, all named in `STACK.md` §1: `testcontainers`, `@testcontainers/postgresql`, `@faker-js/faker`.
- **Scripts.** Added: `db:up`, `db:down`, `db:seed`. Rewritten: `db:branch`, `db:branch:rm`. Changed: `test:unit`, `test:integration`. The pre-commit hook's project filter changes. This approved spec authorises the `package.json`, Vitest-configuration and hook changes (`RULES.md` §1).
- **Raw SQL in test and tooling code only**: `CREATE DATABASE … TEMPLATE …` and `DROP DATABASE` in the test setup and `db:branch`, and `TRUNCATE … RESTART IDENTITY CASCADE` in the per-test reset. This approved spec authorises them (`RULES.md` §11).
- **Required local tooling.** Docker Desktop, with WSL 2 on Windows, becomes a prerequisite in the README.

## Decisions and rationale

### Docker Compose replaces the Neon branches (owner's decision, 2026-09-30)

Local work stops needing network access and a Neon API key, and development data leaves the production project. The per-branch isolation the Neon branches gave, which was the fix for the 2026-08-02 migration-drift incident, is kept by giving each git branch its own database inside the one local Postgres.

### Real Postgres through Testcontainers (owner's decision, 2026-09-30)

A mocked Prisma client cannot fail on a wrong query, a constraint or a cascade. The container matches Neon's major version, so what passes locally runs in production.

### Truncation per test instead of a rolled-back transaction per test

`STACK.md` §16 asks for a transaction per test, rolled back. The server code opens its own interactive `$transaction`s (7 today), and Prisma does not nest interactive transactions, so a test-wide transaction would either break those calls or stop testing them. Each worker has its own database and truncates it before each test: the same isolation and order-independence, at the cost of a truncate. ADR 0014 records the deviation.

### Three Vitest projects instead of two

`STACK.md` §16 names two projects, `unit` and `integration`. The no-database tests here need two environments, jsdom for components and Node for route handlers, and the `*.node.test.ts` suffix already selects the second. Keeping `node` as its own no-database project avoids renaming 40-odd files for no behavioural gain. Both run as "unit" in `pnpm test:unit` and before each commit. ADR 0014 records it.

### Seeds now (owner's decision, 2026-09-30)

A fresh local database is usable at once, and phase 12's preview parent branch will be filled by the same seed.
