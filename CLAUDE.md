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

- `@neondatabase/serverless` is a dependency, but Prisma connects through
  `@prisma/adapter-pg` with a plain `DATABASE_URL`. Do not "fix" this outside phase 6
  (ADR 0007 row 12).
- The Prisma client is generated to `app/generated/prisma` — gitignored, and
  required before tests will even import.
- Hooks in `lib/hooks/*` own every client request lifecycle (ADR 0007 row 19)
  (`docs/decisions/0001-no-data-fetching-library.md`) and guard against out-of-order
  responses with a version ref or `cancelled` flag, as the existing hooks do.
  Cross-cutting fetch helpers live in `lib/<source>/*` and `lib/geo/*`; hooks call
  those, not raw endpoints.

Full detail: `docs/architecture.md`.

## Commands

```bash
# Package manager is pnpm (v11). Do not use npm/yarn — there is no package-lock.json.
pnpm dev              # Start dev server (next dev)
pnpm build            # prisma generate && next build
pnpm start            # next start
pnpm lint             # eslint
pnpm spec:check       # Assert every approved acceptance criterion still has a test
pnpm docs:check       # Assert doc links, referenced source paths and the ownership map resolve
pnpm test             # Vitest (unit + hook + integration + component + contract)
pnpm test:watch       # Vitest watch mode
pnpm test:coverage    # Vitest with v8 coverage
pnpm test:e2e         # Playwright end-to-end (needs a runnable app + browsers)
pnpm test:e2e:db      # DB-backed round trips — needs `pnpm db:branch` first. NOT in CI
pnpm test:visual      # Screenshot comparisons alone (baselines are per-platform)
pnpm test:contract       # Contract tests vs fixtures (offline)
pnpm test:contract:live  # Contract tests vs the real upstream APIs (all three sources)

pnpm db:branch        # Give the current git branch its own Neon database (see below)
pnpm db:branch:rm     # Delete this branch's Neon branch when the work is merged
```

**Local verification until phase 3 adds `pnpm check`** (ADR 0007 row 1): `pnpm lint` (no warnings),
`pnpm exec tsc --noEmit`, `pnpm spec:check`, `pnpm docs:check`, `pnpm test:coverage` and
`pnpm build`, plus `pnpm test:e2e` when a user flow, auth, the map or an `e2e/**` file changes. Never run
`pnpm test:contract:live` (it calls the real marketplaces) or `pnpm test:visual` (per-platform
baselines) as part of a check. When running `/check-all`, put this list in `check-verify`'s brief:
the command's own fallback (`lint`, `typecheck`, `test`, `build`) would miss most of it.

> pnpm blocks dependency build/postinstall scripts by default. Packages allowed to run them are allowlisted in `pnpm-workspace.yaml` under `onlyBuiltDependencies` (currently prisma, `@prisma/engines`, msw, sharp, unrs-resolver). If you add a dependency with a native/build step and `pnpm install` reports `ERR_PNPM_IGNORED_BUILDS`, add it there.

> **A script that sets an env var inline must use `cross-env`.** `FOO=1 cmd` is
> POSIX syntax that cmd.exe does not understand, so the bare form works in CI
> (ubuntu) and silently fails on Windows with `'FOO' is not recognized`.

## Where things are

Reference material lives in `docs/`, not here. This file is rules; those files
are explanation. `docs/README.md` carries the index and the **ownership map**
(source glob → governing doc) that tells you which doc a change needs.

| To understand | Read |
| --- | --- |
| How the pieces fit, the search fan-out, the write path, the directory map | `docs/architecture.md` |
| The map components, design system, palette, theming, animation, i18n | `docs/frontend.md` |
| What each upstream actually does, and how it breaks | `docs/integrations/{wallapop,cochesnet,milanuncios}.md` |
| The seventeen Prisma models and the migration rules | `docs/data-model.md` |
| Test levels, MSW conventions, the environment traps | `docs/testing.md` |
| Deploy, env vars, Neon branches, CI, runbooks | `docs/operations.md` |
| Authentication | `docs/auth.md`, then `docs/specs/auth-email-and-oauth.md` |
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
- `lib/mock/listings.ts` is dead. Do not wire anything to it; knip removes it in phase 3.

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
in `docs/specs/README.md`.

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

Until the spec migration phase of the adoption ADR, specs keep their current template: a `Key` of
2–8 uppercase letters and append-only criteria ids `KEY-1`, `KEY-2`, … named in test titles
(`it("FAV-3: …")`), checked by `pnpm spec:check`. The template has no Worked examples section
yet, so a bug fix's worked example goes in as a new append-only criterion carrying the exact input
that failed and the correct result.

## Documentation

Owned by `.claude/commands/check-docs.md`.

**Docs ship with the change, not after it.** If a change touches an upstream contract, an env
var, a command, a Prisma model, a route, or a bootstrap step, the doc that records it is part of
the diff. `docs/README.md` carries the **ownership map** — source glob → governing doc — which
answers "which docs does this change need?"; `pnpm docs:check` asserts it claims every tracked
source file.

**Every fact lives in exactly one file; everywhere else links to it.** `docs/specs/` owns what the
software does and why; `docs/` guides own how it fits together and how to run and operate it.
When a doc and a spec would say the same thing, the doc links to the spec.

No doc is needed for an internal refactor with no observable surface, a test-only change, styling
that changes no interaction, or a dependency bump that changes no command. Say which applies
rather than staying silent about it. A change that needs a doc that does not exist yet writes it,
and replaces that area's **—** in the ownership map. `docs/documentation-plan.md` is complete and
kept as a record; the **—** rows are the list of gaps now.

## Testing

Stack, levels, MSW conventions, the environment traps and the e2e setup are all
in `docs/testing.md`. **Read it before writing a test** — nearly every entry
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
`UPDATE` on `_prisma_migrations` (raw SQL: ask first, `RULES.md` §1); see `docs/data-model.md`.

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

Why it is mandatory, and the two traps that follow from it, are in
`docs/getting-started.md` and `docs/data-model.md`.

## Authentication

The system is documented in `docs/auth.md` (one-page orientation) and specified
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
  `scaleIn`, `fadeIn(delay)`, `slideInLeft(delay)`, `staggerContainer(delay)`, `buttonTap`)
  instead of re-declaring `initial`/`animate` inline.
