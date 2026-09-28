# Getting started

From a fresh clone to a running app. Roughly ten minutes, most of it waiting for
`pnpm install`.

## Prerequisites

- **Node 22.18+** (`.nvmrc` pins the exact version; `STACK.md` §1) and **pnpm 11**, pinned in
  `package.json`'s `packageManager` — an older pnpm hands the install over to it. The lockfile is
  `pnpm-lock.yaml` and there is no `package-lock.json` — npm and yarn will resolve a different tree.
- **A Neon Postgres database.** The free tier is enough. Nothing here runs
  against a local Postgres by default, because branch databases (below) are a
  Neon feature the workflow depends on.
- **gitleaks** on your PATH — `winget install Gitleaks.Gitleaks` on Windows, `brew install gitleaks`
  on macOS. The pre-commit hook runs it.

## The four steps

```bash
pnpm install
cp .env.example .env      # then fill in DATABASE_URL and NEXTAUTH_SECRET
pnpm exec prisma generate
pnpm dev
```

The app is at `http://localhost:3000`; the product itself lives at `/map`.

Two of those steps are less obvious than they look.

### Why `prisma generate` is separate

The Prisma client is generated into `app/generated/prisma`, which is gitignored.
Nothing prompts you for it, and skipping it fails in a way that points at the
wrong thing: **four test files fail at *import* while every test that does run
passes.** That reads like an unrelated breakage rather than a missing bootstrap
step. `pnpm build` runs it for you; `pnpm dev`, `pnpm typecheck` and `pnpm test` do not.

### The minimum env

Only two variables are required — `lib/env.ts` validates them at import and
throws at boot rather than failing later with an opaque error:

| Variable | Why |
| --- | --- |
| `DATABASE_URL` | Neon connection string, used by the `@prisma/adapter-pg` driver adapter |
| `NEXTAUTH_SECRET` | Signs every session JWT. `openssl rand -base64 32`. Under 32 characters logs a loud warning; rotating it signs everyone out |

Everything else is optional and **degrades a feature rather than breaking the
app** — which is deliberate, so a contributor is never blocked on credentials
they do not need:

| Unset | Consequence |
| --- | --- |
| `RESEND_API_KEY` / `EMAIL_FROM` | The mailer no-ops. Password-reset links are never delivered, and registration falls back to creating accounts immediately — which reveals whether an address is already registered |
| `TWO_FACTOR_ENCRYPTION_KEY` | The two-factor card is hidden and enrolment is refused |
| `GOOGLE_*` / `GITHUB_*` | That provider's button does not render. Both halves of a pair are required |
| `NEON_API_KEY` | `pnpm db:branch` cannot run — see below. Tooling-only, absent from `lib/env.ts` |

`.env.example` is the full reference, with the reasoning next to each entry.

## Working in a worktree

**Before any Prisma command or `pnpm dev` from a git worktree, run
`pnpm db:branch`.** It forks a copy-on-write Neon branch for the current git
branch and writes `DATABASE_URL` into that worktree's `.env`, seeding the rest of
the file from the main checkout. It is idempotent — re-running on an already
provisioned branch reuses it.

```bash
pnpm db:branch        # this git branch gets its own database
pnpm db:branch:rm     # delete it once the work is merged
```

A worktree starts with neither `.env` nor `node_modules`, so the full bootstrap
there is:

```bash
pnpm db:branch && pnpm install && pnpm exec prisma generate
```

`db:branch` is dependency-free for exactly this reason — it has to run before
`pnpm install` does, and it reads the shared secrets from the main checkout via
`git rev-parse --git-common-dir`.

### Why this is mandatory rather than advisory

`prisma migrate dev` assumes the dev database matches the *current branch's*
migration history. While worktrees share one database, a migration applied from
any one of them makes every other worktree report "applied to the database but
missing from the local migrations directory" — and the only remedy Prisma offers
is a reset that drops every row. The database holds real accounts and there is no
seed script.

**Never accept that offer.** Treat the suggestion as a bug report, not an
instruction. Two related traps, both hit in practice:

- **`prisma migrate status` does not catch this.** It reported "Database schema
  is up to date!" against a stale checksum and a migration missing locally. It
  validates neither. Only `migrate dev` does.
- **Checksums are SHA-256 of `migration.sql` with CRLF normalised to LF.**
  `core.autocrlf=true` is set with no `.gitattributes`, so every migration file
  is CRLF on disk and LF in git. That is *not* a source of drift — do not chase
  it.

A genuinely stale checksum is repaired with
`UPDATE _prisma_migrations SET checksum = … WHERE migration_name = …`, never with
a reset.

### "Refusing to run"

`scripts/require-branch-db.mjs` enforces the rule rather than trusting anyone to
remember it, wired to every Bash/PowerShell call by a `PreToolUse` hook in
`.claude/settings.json` (committed, so it travels with a clone). If you see:

```
Refusing to run: this worktree has no .env, so DATABASE_URL is unset.
```

the fix is `pnpm db:branch`. Never work around the guard. It deliberately ignores
`prisma generate`, which only reads the schema and never opens a connection, and
`pnpm db:branch` itself — blocking the remedy would deadlock.

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | `prisma generate && next build` |
| `pnpm check` | The verification contract: `lint` → `typecheck` → `test` → `build`, stopping at the first failure |
| `pnpm check:full` | `check`, then `test:e2e` |
| `pnpm lint` | Biome (lint and format), knip, `spec:check`, `docs:check`, `todo:check` |
| `pnpm typecheck` | `tsc --noEmit` and type-coverage (minimum in `package.json` › `typeCoverage`) |
| `pnpm test` | Vitest, both projects, with v8 coverage and the ratchet thresholds |
| `pnpm test:unit` | The jsdom project alone |
| `pnpm test:integration` | The node project alone (route handlers, actions, scripts, contracts) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:e2e` | Playwright, all three projects |
| `pnpm test:e2e:db` | The database-backed e2e round trips. Needs `pnpm db:branch` first |
| `pnpm test:visual` | Screenshot comparisons alone |
| `pnpm test:contract` | External API shapes, against offline fixtures |
| `pnpm test:contract:live` | The same, against the real upstream APIs |
| `pnpm spec:check` | Every approved acceptance criterion is still named by a test |
| `pnpm docs:check` | Doc links, referenced source paths, the ownership map |
| `pnpm todo:check` | Every `TODO` comment names its issue (`#n`) |
| `pnpm db:branch` | Give this git branch its own Neon database |
| `pnpm db:branch:rm` | Delete it |

## Git hooks

Husky installs the hooks on `pnpm install` (the `prepare` script).

**Pre-commit**: lint-staged runs `biome check --write` on the staged files, then
`vitest related --run --project unit` on the staged `.ts`/`.tsx`, then `gitleaks git --pre-commit
--staged`.

**Commit-msg**: commitlint checks the message is a Conventional Commit (`commitlint.config.mjs`).

A failing hook is fixed, never skipped (`RULES.md` §3).

Formatting-only commits are listed in `.git-blame-ignore-revs` — GitHub skips them in blame; run
`git config blame.ignoreRevsFile .git-blame-ignore-revs` once for local `git blame`.

## Claude commands and checks

The rules an agent follows are `RULES.md` and `STACK.md` (shared with every project on the
core) plus `CLAUDE.md` (what is specific to BuyCarMap); [ADR 0007](decisions/0007-adopt-core-rules.md)
lists where the code still deviates and the phase that removes each deviation.

| Command | Does |
| --- | --- |
| `/spec`, `/spec-tests` | Draft a spec; turn an approved one into failing tests |
| `/check-all` | The pre-commit pass: every `check-*` review in a fresh subagent, the verification, screenshots of UI changes, then the commit message |
| `/check-pr` | The PR title and description, when opening the PR |
| `/diff`, `/daily` | A commit message; a daily summary |

The commands delegate to two user-level agents, `lacayo-opus` and `lacayo-sonnet`; on a new
machine, install them once with `node install.mjs` from the `algusaem-claude` repository, or
`/check-all` stops before running any check. Each command carries a Delegation paragraph saying
which parts go to which agent (`CLAUDE.md` › Model delegation).

Every `check-*` review follows `.claude/review-protocol.md`. `check-docs` and `check-sources` are
this project's own; what else differs from the core copies is listed in
[the phase 2 spec](specs/core-mastermind.md) §4. The coverage map in `.claude/commands/check-all.md`
says which check owns each rule.

## When something is wrong

**`ERR_PNPM_IGNORED_BUILDS` on install.** pnpm blocks dependency build scripts by
default. Packages allowed to run them are allowlisted in `pnpm-workspace.yaml` under `allowBuilds`
([ADR 0009](decisions/0009-pnpm-pinned-allow-builds.md)). Add yours there.

**Tests fail at import, mentioning `app/generated/prisma`.** Run
`pnpm exec prisma generate`.

**`gitleaks: command not found` when committing.** Install gitleaks (Prerequisites) and open a new
shell so the PATH change applies.

**`Invalid server environment`** at boot lists exactly which variables are
missing. `lib/env.ts` is the schema.

**Emails never arrive.** Check the boot logs. If `EMAIL_FROM` uses Resend's
sandbox sender (`resend.dev`) in production, it only delivers to your own Resend
account address — every other user is told to check an inbox that receives
nothing. Verify a domain instead.

## Next

- [Contributing](README.md#contributing) — the spec → tests → implement loop, and
  what CI enforces.
- [`docs/specs/README.md`](specs/README.md) — how behaviour is agreed and
  recorded before it is built.
- [`CLAUDE.md`](../CLAUDE.md) — the rules an agent working in this repo follows:
  `RULES.md` and `STACK.md` from the shared core, plus what is specific to
  BuyCarMap. Useful to a human as a statement of the house conventions.
