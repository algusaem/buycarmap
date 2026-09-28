# CLAUDE.md - BuyCarMap

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules for Claude

The development rules live in `RULES.md`, imported here so they are always in context:

@RULES.md

Technologies and code patterns: follow `STACK.md`. Anything it doesn't cover needs an ADR in
`docs/decisions/`. `/check-all` enforces `RULES.md`, `STACK.md` and this file on every change.

**The project is migrating onto the core.** `docs/decisions/0007-adopt-core-rules.md` lists every
place where the code still deviates from `RULES.md` / `STACK.md`, and the phase that removes each
one. For the deviations it names, that ADR wins; everything else follows the rules as written. New
code follows the rules, not the legacy pattern next to it — unless the ADR says the pattern stays
until its phase.

This file holds only what is specific to BuyCarMap. When it and `RULES.md` disagree, `RULES.md`
wins unless the adoption ADR says otherwise.

### Communication

- Be direct and concise
- No emojis, filler, or motivational language
- If something is a bad idea, say it clearly

## Model delegation — spend Opus high on judgement, not on execution (mastermind)

**Opus 5.5 at high effort is the mastermind.** The main session runs on it and does the analysis, decisions
and review; `lacayo-opus` (Opus 5.5, medium effort) and `lacayo-sonnet` (Sonnet 5, high effort) are its
hands — user-level agents in `~/.claude/agents/`, installed with `node install.mjs` from `algusaem-claude`,
because an `Agent` call cannot set the effort level and the agent's frontmatter can. **Mechanical multi-step
executions go to a subagent** via the `Agent` tool with closed instructions, and the main session only
reviews the result:

- **`subagent_type: "lacayo-sonnet"` — the default for anything already decided.** Execute a dictated change,
  run the verification list and report numbers, apply a list of edits with file, anchor and exact
  before/after text, grep sweeps (every caller of `searchWallapop`, every `t.*` key a change touches), renames
  and link fixes, run `pnpm db:branch` and a Prisma command in a worktree. Also write record text — a spec's
  checklist ticks, a commit message — when the facts and a peer file to imitate are given. **When in
  doubt, Sonnet first**; if its report is not enough, re-brief Opus and note why.
- **`subagent_type: "lacayo-opus"` — only when the brief itself requires judgement:** every `check-*` review,
  cross-checking an upstream contract doc against the client code and the contract tests, reconciling a spec
  with the code it describes, adapting a text to a style with no peer to point at.
- **Direct, no agent:** anything that fits in one call with no chained steps (a read-only command, a quick
  look at a file, a two- or three-step edit in one file).
- **Verification never runs in the main session — strict.** Build, lint, typecheck, tests, e2e and
  screenshots always go to `lacayo-sonnet` with the exact commands and the reference numbers, even right
  after a direct edit; the main session uses the outputs Sonnet pastes and does not re-run them. A
  PreToolUse hook (`~/.claude/hooks/mastermind-guard.mjs`) blocks those commands in the main session; if
  it fires, delegate instead of rephrasing the command to get past it.

Every brief follows the same shape: «You are the hands of a session that has already decided everything»;
a block of facts measured beforehand; explicit prohibitions (no git writes, no files outside the named
paths, no installs, no AI or process mentions in anything that reaches third parties); numbered edits with
exact before/after text and the check to run after each; verifications with reference numbers so the agent
reports deltas; report format (`git status --short`, `git diff --stat`, control greps) and the closing line
«Do not invent data: if a fact is missing, say so instead of assuming it». After the report, the main
session re-measures the key facts itself before telling the user anything.

At the end of each task the mastermind reports the split in one line:
«Lacayos: N sonnet, M opus, K directos; reencargos: X», and why a re-brief happened if it did.
Relaunching an agent after a cut counts as a re-brief. A task that ran any verification in the main
session did not follow this section, whatever its «Lacayos» line says.

## Project Overview

BuyCarMap aggregates second-hand car listings and displays them on an interactive map. Users search and filter by location, price, make/model, year, mileage, horsepower, fuel, transmission, and recency, then browse results as a synchronized card list + map.

What is and is not built is under **Current state** below. Everything else in this
file is a rule; the explanations live in `docs/`.

## Stack today

Next.js 16 (App Router) · React 19 · TypeScript · PostgreSQL (Neon) via Prisma 7
with the **`@prisma/adapter-pg`** driver adapter · NextAuth 4 (JWT sessions) ·
React Hook Form + Zod 4 · Tailwind CSS 4 · Radix primitives wrapped in
`components/ui/*` · Motion · Sonner · next-themes · Leaflet + react-leaflet ·
Lucide React and React Icons.

Where this differs from `STACK.md` it is a deviation the adoption ADR accepts until its phase,
or an installed dependency the ADR approves or accepts until its phase (see its dependency list). Constraints that hold until then, and that a plausible-looking change will break:

- Prisma connects through `@prisma/adapter-pg` with a plain `DATABASE_URL`, not the Neon
  serverless driver. Do not change this outside phase 6 (ADR 0007 row 12).
- The Prisma client is generated to `app/generated/prisma` — gitignored, and
  required before `pnpm typecheck` and before tests will even import.
- Hooks in `lib/hooks/*` own every client request lifecycle (ADR 0007 row 19)
  (`docs/decisions/0001-no-data-fetching-library.md`) and guard against out-of-order
  responses with a version ref or `cancelled` flag, as the existing hooks do.
  Cross-cutting fetch helpers live in `lib/<source>/*` and `lib/geo/*`; hooks call
  those, not raw endpoints.

Full detail: `docs/ARCHITECTURE.md`.

## Commands

```bash
# Package manager is pnpm 11, pinned in package.json's packageManager. Do not use npm/yarn — there is no package-lock.json.
pnpm dev              # Start dev server (next dev)
pnpm build            # prisma generate && next build
pnpm start            # next start
pnpm check             # The verification contract: lint → typecheck → test → build
pnpm check:full        # pnpm check, then the Playwright e2e suite
pnpm lint              # Biome, knip, spec:check, docs:check, todo:check
pnpm typecheck         # tsc --noEmit and type-coverage
pnpm spec:check       # Assert every approved acceptance criterion still has a test
pnpm docs:check       # Assert doc links, referenced source paths and the ownership map resolve
pnpm todo:check       # No TODO comment without an issue reference
pnpm test              # Vitest, both projects, with the coverage thresholds
pnpm test:unit         # Vitest jsdom project
pnpm test:integration  # Vitest node project (route handlers, actions, scripts, contracts)
pnpm test:watch       # Vitest watch mode
pnpm test:e2e         # Playwright end-to-end (needs a runnable app + browsers)
pnpm test:e2e:db      # DB-backed round trips — needs `pnpm db:branch` first. NOT in CI
pnpm test:visual      # Screenshot comparisons alone (baselines are per-platform)
pnpm test:contract       # Contract tests vs fixtures (offline)
pnpm test:contract:live  # Contract tests vs the real upstream APIs (all three sources)

pnpm db:branch        # Give the current git branch its own Neon database (see below)
pnpm db:branch:rm     # Delete this branch's Neon branch when the work is merged
```

**Local verification is `pnpm check`**, plus `pnpm check:full` when a user flow, auth, the map or an
`e2e/**` file changes. Never run `pnpm test:contract:live` (it calls the real marketplaces) or
`pnpm test:visual` (per-platform baselines) as part of a check.

> pnpm blocks dependency build/postinstall scripts by default. Packages allowed to run them are
> allowlisted in `pnpm-workspace.yaml` under `allowBuilds` — currently `@prisma/engines`, `prisma`,
> `msw` and `sharp`. If you add a dependency with a native/build step and
> `pnpm install` reports `ERR_PNPM_IGNORED_BUILDS`, add it there.

> **Git hooks** (Husky) run on every commit: Biome on the staged files, the related unit tests,
> gitleaks, and commitlint on the message. A failing hook is fixed, never skipped (`RULES.md` §3).
> gitleaks must be on the PATH — see the root `README.md` › Prerequisites.

> **A script that sets an env var inline must use `cross-env`.** `FOO=1 cmd` is
> POSIX syntax that cmd.exe does not understand, so the bare form works in CI
> (ubuntu) and silently fails on Windows with `'FOO' is not recognized`.

## Where things are

Reference material lives in `docs/` and the root `README.md`, not here. This file is rules; those
files are explanation. The root `README.md` carries getting started, the docs index and the
**ownership map** (source glob → governing doc) that tells you which doc a change needs.

| To understand | Read |
| --- | --- |
| Setup, env, worktrees, commands, the spec workflow, the docs index | `README.md` |
| How the pieces fit, the search fan-out, the write path, the directory map | `docs/ARCHITECTURE.md` |
| The map components, design system, palette, theming, animation, i18n | `docs/ARCHITECTURE.md` › Frontend |
| What each upstream actually does, and how it breaks | `docs/specs/data-sources.md` › Contracts |
| The seventeen Prisma models and the migration rules | `docs/ARCHITECTURE.md` › Data model |
| Test levels, MSW conventions, the environment traps | `docs/ARCHITECTURE.md` › Testing |
| Deploy, env vars, Neon branches, CI, runbooks | `docs/ARCHITECTURE.md` › Environments and operations |
| Restoring the production database | `docs/operations/backups.md` |
| Personal data, processors, erasure | `docs/privacy/data-inventory.md`, `docs/privacy/processors.md`, `docs/privacy/deletion.md` |
| Authentication | `docs/ARCHITECTURE.md` › Authentication, then `docs/specs/auth-email-and-oauth.md` |
| Why something is the way it is | `docs/decisions/` |

**Verify against the code before asserting.** These docs are checked
mechanically by `pnpm docs:check` — links and referenced paths resolve — but no
script can prove prose is still true.

## Upstream sources

Owned by `.claude/commands/check-sources.md`. The facts most likely to be broken by a
reasonable-looking change, because breaking one is silent:

- **Never call an upstream marketplace from the browser.** CORS, CloudFront and
  bot protection all block it. Everything from the browser goes through `app/api/<source>/`.
- **Wallapop coordinates are always sent**, even with no location chosen —
  otherwise it geo-filters by the server's IP and a Spanish user gets US
  listings from Vercel. Invisible locally.
- **One shared filter set drives every source.** The UI builds a single
  `SearchInput`; each client translates it. Do not add a per-source filter UI.
- **coches.net and Milanuncios items carry no coordinates.** Their pins are
  city- or province-level approximations. Wallapop's are exact when the listing
  carries coordinates (SRC-3).
- **The merge post-filters by radius and model** (`applyResultFilters` in
  `lib/hooks/useListingsSearch.ts`). It looks redundant — "upstream already
  filters" — but only Wallapop enforces the radius and Milanuncios matches the
  model as free text. Removing it silently reverts to nationwide results
  (MAP-16..18). **Because that filter can empty a page**, the first search and
  `loadMore` both keep fetching until a round yields a listing or the sources
  run out — collapsing either loop back to one fetch strands the scroll and
  makes an empty first page permanent (MAP-19). Every round advances each source's
  cursor or page, or clears its has-more flag: that, not a round cap, is what
  ends the loops.
- **Server code cannot call the browser-bound fetchers** — `searchWallapop`,
  `searchCochesNet`, `searchMilanuncios`, `lib/wallapop/filters.ts` and
  `lib/cochesnet/models.ts` resolve URLs against `window.location.origin`. The alert
  runner goes through `lib/alerts/search.ts`, which reuses only the pure query builders
  from `lib/*/client.ts`.
- Respect robots.txt and the upstreams' rate limits.
- Where it helps performance, keep map markers clustered or limited and lazy-load
  listing detail.
- When a listing store is built (the `Car` persistence under Current state — not
  the `Favorite` / `AlertMatch` display snapshots): store the raw upstream data
  separately from the normalized record, and track each listing's freshness and
  availability.
- Deduplicating the same car across sources is out of scope today
  (`docs/specs/data-sources.md`); it arrives with its own spec, not as a side
  effect of another change.

## Other invariants

- **All user-facing text goes through `t.*` keys** in both locales. The default
  locale is **`es`**, so a hardcoded English string reaches most users.
- **Errors are codes, not prose.** Server code cannot read the client i18n
  context.

## Current state

Live sources: **Wallapop**, **coches.net**, **Milanuncios** — all proxied and
merged into one result set. Auth is complete: register, login, password reset,
account management, two-factor, optional OAuth. **Favorites are built** — model,
server actions, `/favorites`, and reconciliation into search results.

**Car alerts are built.** Saved criteria (deduplicated across users), a
Postgres queue drained by a GitHub Actions cron every five minutes, email
digests, `/alerts` and `/alerts/[id]`, one-click unsubscribe. See
`docs/specs/alerts.md`.

Not built, and not to be assumed: normalized `Car` listing persistence,
in-app notifications, web push.

## Specs

`RULES.md` §4 and `STACK.md` §15 govern: every change is covered by an up-to-date spec in
`docs/specs/`, written and approved before the tests, and the tests before the code. Conventions
in the root `README.md` › Specs.

| The user says | Do this first |
| --- | --- |
| "add X", "build X", "I want users to be able to X" | `/spec X` — draft it, then stop and get it approved |
| "change how X works", "X should also do Y" | Amend the governing spec, get it approved, then `/spec-tests` |
| "X is broken" | Add the failing input and the correct result to the spec as a worked example (`RULES.md` §4) — ask for the values if they aren't known — then the failing test, then the fix |
| "refactor X", "rename X", "bump X" | Name the spec that already covers the area; if none does, stop and ask |
| "why does X do Y?" | Answer the question |

After a spec is approved, invoke `/spec-tests` — do not implement straight from the spec.
**Stop after drafting a spec**: approval is the user's decision.

Each phase of the migration onto the core has its own spec in `docs/specs/` (`core-*.md`), approved
before the phase starts.

Specs follow the core section order — Problem, Acceptance criteria, Worked examples, Data model,
Permissions, Edge cases, Out of scope — optionally followed by Contracts, Decisions and rationale
and Open questions, in that order. The `Key:` and `Status:` lines stay. Criteria carry append-only
ids `KEY-1`, `KEY-2`, … as checklist items `- [ ] KEY-n · <level> — <statement>`, named in test
titles (`it("FAV-3: …")`) and checked by `pnpm spec:check`. A bug fix adds a worked example with
the input that failed and the correct result under Worked examples, plus a new criterion if the
behaviour was not covered. See `docs/decisions/0011-spec-ids-and-sections.md`.

## Documentation

Owned by `.claude/commands/check-docs.md`.

**Docs ship with the change, not after it.** If a change touches an upstream contract, an env
var, a command, a Prisma model, a route, or a bootstrap step, the doc that records it is part of
the diff. The root `README.md` carries the **ownership map** — source glob → governing doc — which
answers "which docs does this change need?"; `pnpm docs:check` asserts it claims every tracked
source file.

**Every fact lives in exactly one file; everywhere else links to it.** `docs/specs/` owns what the
software does and why; `docs/ARCHITECTURE.md`, `docs/privacy/` (personal data, processors,
erasure), `docs/operations/` (backups and restore) and the root `README.md` own how it fits
together and how to run and operate it.
When a doc and a spec would say the same thing, the doc links to the spec.

No doc is needed for an internal refactor with no observable surface, a test-only change, styling
that changes no interaction, or a dependency bump that changes no command. Say which applies
rather than staying silent about it. A change that needs a doc that does not exist yet writes it,
and replaces that area's **—** in the ownership map; the **—** rows are the list of gaps.

## Testing

Stack, levels, MSW conventions, the environment traps and the e2e setup are all
in `docs/ARCHITECTURE.md` › Testing. **Read it before writing a test** — nearly every entry
there is a trap someone already fell into.

- **Colocate.** `foo.ts` → `foo.test.ts`. No `__tests__/` folders.
- **Opt into the node project by filename**: `*.node.test.ts` for route handlers,
  server actions and scripts. Everything else runs in jsdom.
- **MSW is the only way to fake network.** Never hand-stub `global.fetch`.
  `onUnhandledRequest: "error"` is on, so a stray request fails loudly.
- **Use `renderWithI18n`** from `test/utils/render.tsx` so labels are stable
  English. Without a provider, `useTranslation` falls back to Spanish.
- **Override only the field under test** in a fixture.
- **Hand-derive every expected value.** Computing the expectation the way the
  code does proves nothing.
- **Cover a negative path**: invalid input, empty result, upstream failure,
  unauthorised caller.
- No tautological or self-fulfilling tests, and never mock the unit under test.

## Worktrees and the dev database

**Never run `prisma migrate reset`, `prisma db push --force-reset`, or any command that drops or
recreates the database.** The Neon database holds real accounts and there is no seed script, so
"reset" rebuilds the schema with zero rows. Prisma offers it for bookkeeping problems that do not
need it — treat the offer as a bug report, not an instruction. A stale checksum is repaired with an
`UPDATE` on `_prisma_migrations` (raw SQL: ask first, `RULES.md` §1); see `docs/ARCHITECTURE.md`
› Migrations.

**Before any Prisma command or `pnpm dev` from a worktree, run `pnpm db:branch`.** It gives the
current git branch its own copy-on-write Neon branch and writes `DATABASE_URL` into that worktree's
`.env`. Do this first, unprompted, whenever starting on a new branch or worktree — it is idempotent,
so re-running just reuses the branch. Then:

```bash
pnpm install && pnpm exec prisma generate
```

`prisma generate` is easy to forget because nothing prompts for it: without `app/generated/prisma`,
four test files fail at *import* while every test that does run passes, which reads like an
unrelated breakage rather than a missing bootstrap step.

**This is enforced.** `scripts/require-branch-db.mjs` refuses database-touching commands from a
worktree with no branch database, wired to every Bash/PowerShell call by a `PreToolUse` hook in the
committed `.claude/settings.json`. If you see "Refusing to run", the fix is `pnpm db:branch` —
**never work around the guard.**

Why it is mandatory, and the two traps that follow from it, are in the root `README.md` ›
Working in a worktree and `docs/ARCHITECTURE.md` › Migrations.

## Authentication

The system is documented in `docs/ARCHITECTURE.md` › Authentication (a short orientation) and specified
in full in `docs/specs/auth-email-and-oauth.md`. **Read the spec before changing
anything here** — every property below is load-bearing and most are not obvious.
Any change here needs approval first (`RULES.md` §1).

- **Never call `getServerSession` directly** — use `getCurrentUser()` from
  `lib/auth/session.ts`. Every server action touching user data must call it.
  Only it honours revocation. `proxy.ts` only decodes the JWT and cannot see
  revocations, so it is UX, not authorization.
- **`authOptions` lives in `lib/auth/options.ts`**, never the route file —
  server components and actions import it, and pulling it from a route would
  drag the handler along.
- **Any flow that sets a password must call `validateNewPassword()`**
  (`lib/auth/password-policy.ts`) **and bump `passwordChangedAt`.** Skipping the
  second signs nobody out. The client strength meter is a hint; the server gate
  is what counts.
- **Password reset must not bypass 2FA**, and the email-change link must go to
  the **new** address with the current password required to start the change.
- **Return codes, never prose** (`AUTH_ERROR`). Forms resolve them with
  `translateAuthError(t, code)`; pass `setError` the raw code.
- **Do not add a scheduler.** Expired tokens are pruned opportunistically by
  `lib/auth/cleanup.ts`, the same way `lib/rate-limit.ts` prunes its rows.
- **Do not weaken enumeration resistance.** Identical responses, dummy-hash
  timing equalization, and bcrypt run *before* any existence check. Registration
  is verify-first when email is configured — `register` writes a
  `PendingRegistration`, never a `User`.
- **Do not change the TOTP parameters** (HMAC-SHA1, 6 digits, 30s step, ±1 step
  drift). They are what real authenticator apps assume.
- **Do not "fix" `allowDangerousEmailAccountLinking`** or the `signIn` callback's
  refusal to auto-link a new provider to a 2FA account, without reading the
  reasoning in `options.ts` first. Both look wrong and are not.

## UI specifics

- **Theming**: next-themes, `attribute="class"`, dark default, `.light` for light. Theme-aware
  styles use the CSS variables (`var(--…)`) the theme defines. Components
  using `useTheme` wait for `mounted` (`lib/hooks/useMounted.ts`) to stay hydration-safe. Theme
  switching uses the View Transitions API via `lib/hooks/useThemeTransition.ts` — use it rather
  than calling `setTheme` directly in the toggle.
- **Forms**: `zodResolver`, inline field errors, and `isSubmitting` for the loading state.
- **Toasts**: the Sonner `Toaster` is in the root layout; style it via `classNames`, not inline
  styles.
- **Icons**: never raw SVGs. Lucide React for UI icons, React Icons for brand icons. Size with
  Tailwind (`h-4 w-4`).
- **Animations**: keep motion subtle. `import * as motion from "motion/react-client"`, `import { AnimatePresence }
  from "motion/react"`. Reuse the presets in `lib/animations.ts` (`fadeInUp`, `fadeInDown`,
  `dropdownReveal`, `crossFade`, `fadeIn(delay)`, `staggerContainer(delay)`, `buttonTap`)
  instead of re-declaring `initial`/`animate` inline.
