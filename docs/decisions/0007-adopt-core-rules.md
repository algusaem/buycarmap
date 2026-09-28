# 0007 — Adopt the shared rules and checks

Status: Accepted · Date: 2026-09-27

## Context

BuyCarMap was built before the shared core (`algusaem-claude`: `RULES.md`, `STACK.md`, the
`check-*` reviews and mastermind) existed. It runs on Next.js 16, React 19, Prisma 7 with
`@prisma/adapter-pg` on Neon, NextAuth 4 with JWT sessions, ESLint, a hand-rolled i18n layer with
Spanish as the default locale, Vitest (jsdom + node projects, Prisma mocked), MSW and Playwright.
It has live users and real accounts in the production Neon database, seven feature specs with
append-only criteria ids enforced by `pnpm spec:check`, a docs ownership map enforced by
`pnpm docs:check`, and six earlier ADRs.

The owner decided to move the project fully onto the core stack, not only onto its rules, and
to do it in phases, each on its own branch and PR, each closed by `/check-all`.

## Decision

- `RULES.md` and `STACK.md` are copied from the core **unchanged**, and take changes from the
  core. `CLAUDE.md` imports `RULES.md` and keeps only what is specific to BuyCarMap. Where the old
  `CLAUDE.md` contradicted `RULES.md` — a spec only for observable behaviour, "say which way and
  proceed" when ambiguous, editing a test that looks wrong, `unknown` banned everywhere, `type`
  allowed for any utility type, request errors always as toasts, `theme-color` and `preconnect` as
  MUST instead of SHOULD — `RULES.md` won and the old rule
  was removed.
- The core's `.claude/review-protocol.md`, every core `check-*.md` and `diff.md` replace the old
  `check.md`, `check-all.md`, `check-tests.md`, `check-claudemd.md` and `diff.md`. `daily.md`,
  `spec.md` and `spec-tests.md` stay (they are not checks); the last two get only the edits that
  align them with `RULES.md` §1 and §4 now, and are rewritten for the core spec format in phase 4.
- Mastermind — the delegation system in which the main session decides and the `lacayo-*` agents
  execute and audit — already drives the core's `/check-all` and `/check-pr`, copied here unchanged except the two
  project rows in `check-all.md`'s coverage map;
  phase 2 applies it to `CLAUDE.md` and every other command.
- Two **project checks** take the parts of the old process the core doesn't cover:
  `check-docs` (the ownership map and "docs ship with the change" — the old `/check-all`
  documentation phase) and `check-sources` (the upstream-source invariants, whose breakage is
  silent). Both follow the review protocol and appear in the coverage map of `check-all.md`.
- **The deviations below are accepted until their phase lands.** A change that only extends one
  of them is a NOTE citing this ADR; new code in a new place follows the rules. When a phase
  lands, its deviations stop existing in the code; this ADR is not edited. The last phase closes
  the migration with an ADR that supersedes this one.
- Stack-bound rules (`RULES.md` §9, §11, §13, §14, §16) apply as written for new code; the legacy
  code they contradict is covered by the rows below.
- **Specs for the migration.** Every phase has its own spec in `docs/specs/` (`core-*.md`),
  approved by the owner before the phase starts (the owner's decision, 2026-09-27). A phase that
  changes what a user sees or how data behaves also amends the feature specs it touches.
- **Owner decisions taken while adopting** (2026-09-27): the installed dependencies listed below
  are approved; phase 8 re-keys every table to UUIDv7, not only new ones; phase 11 may sign every
  user out once.
- The upstream-source guidelines the old `CLAUDE.md` listed under "Scraping" stay mandatory, scoped
  to what exists: persistence rules apply once listings are persisted, and cross-source
  deduplication follows `docs/specs/data-sources.md`, which puts it out of scope.

## Accepted deviations

| # | Deviation | Rule it deviates from | Removed in |
|---|---|---|---|
| 1 | No `check`, `check:full` or `typecheck` scripts; `test` runs without the coverage threshold. Until phase 3 the local verification is the list in `CLAUDE.md` › Commands, which keeps every step the old checks ran; `/check-all` puts that list in `check-verify`'s brief, since the command's own fallback (`lint`, `typecheck`, `test`, `build`) would miss most of it | `STACK.md` §5 | Phase 3 |
| 2 | ESLint instead of Biome; no dependency-cruiser, knip, type-coverage or plop | `STACK.md` §1, §5 | Phase 3 (Biome, knip, type-coverage); phase 5 (dependency-cruiser, plop) |
| 3 | No Husky, lint-staged, commitlint or gitleaks | `STACK.md` §4 | Phase 3 |
| 4 | CI: no typecheck, build, PR-title check or gitleaks; E2E runs on `pull_request` against a local app, with retries (2 in CI, 1 locally) | `STACK.md` §4, §5, §16 | Phase 3 (all but the E2E target); phase 12 (E2E against the preview) |
| 5 | No PR template, CODEOWNERS, release-please, `CHANGELOG.md` or Renovate; no `packageManager`, `.nvmrc` or `engines` | `STACK.md` §1, §4 | Phase 3 |
| 6 | The base branch is `master`, not `main`; commits have gone straight to it | `RULES.md` §3, §21; `STACK.md` §2, §4 | PRs from now on; branch protection in phase 3; the rename in phase 12, with Vercel's production branch |
| 7 | `TODO.md` at the repository root lists pending work outside issues | `RULES.md` §22 item 7; `STACK.md` §6 "Docs" | Phase 3 |
| 8 | Spec template: `Key`, `Status`, criteria table with `KEY-n` ids, no Worked examples, Permissions or Edge cases sections; `pnpm spec:check` | `STACK.md` §15; `RULES.md` §4 (worked examples) | Phase 4 |
| 9 | Docs tree: `architecture.md`, a single `operations.md`, and guides with no place in the core tree (`auth.md`, `data-model.md`, `frontend.md`, `getting-started.md`, `testing.md`, `integrations/`, the two plans); no `docs/privacy/` | `STACK.md` §6 "Docs", §12 | Phase 4 |
| 10 | Root layout (`app/`, `lib/`, `components/`, `interfaces/`, `types/`, `e2e/`, root `proxy.ts`); server actions in `app/actions/`; Zod schemas in `lib/validations/`; business logic in `lib/*` and in `lib/hooks/useListingsSearch.ts`; Prisma called from actions and pages | `RULES.md` §9, §13; `STACK.md` §6, §15 "Test layout" | Phase 5 |
| 11 | Env read through a hand-rolled Zod module (`lib/env.ts`); `process.env` read in `lib/prisma.ts`, `proxy.ts` and configs | `RULES.md` §14; `STACK.md` §6, §11 | Phase 6 |
| 12 | Single DB module is `lib/prisma.ts` with `adapter-pg` only; no `DIRECT_URL`; the build doesn't run `prisma migrate deploy` | `RULES.md` §11; `STACK.md` §3, §6 | Phase 6 |
| 13 | Actions return `{ success, error?, data? }`; no `Result<T, E>`; error codes without a `messageKey`; `console.*` instead of Pino; no Sentry; no correlation id | `RULES.md` §3 (`console.log`), §15; `STACK.md` §8 | Phase 6 |
| 14 | No `/api/health` or `/api/health/db` | `STACK.md` §2 | Phase 6 |
| 15 | Static CSP with `'unsafe-inline'` in `next.config.ts` instead of nonces in `proxy.ts` | `STACK.md` §11 | Phase 6 |
| 16 | Vitest projects `unit` (jsdom) and `node` with Prisma mocked; no Testcontainers, no transaction-per-test; no faker factories. Until then `foo.test.ts` / `foo.node.test.ts` next to the source stand for the unit / integration files, and the `RULES.md` §10 rejection tests are `*.node.test.ts` with Prisma mocked | `RULES.md` §20; `STACK.md` §16 | Phase 7 |
| 17 | No seeds; local development runs on a Neon branch per git branch instead of Docker Compose | `RULES.md` §11, §22 item 10; `STACK.md` §1, §2, §3 | Phase 7 |
| 18 | Data model: `cuid()` ids (and natural string keys on `RateLimit` and `SourceHealth`), camelCase table and column names, `timestamp` without time zone, no `createdById` / `updatedById` / `deletedAt` / `version`, free-text `AlertPollJob.status`, `onDelete: Cascade` on every relation; no branded ids | `STACK.md` §7, §9 | Phase 8 |
| 19 | Reads go through client hooks in `lib/hooks/*`: search to route handlers that proxy the upstream marketplaces (0001, 0003); favorites, car models and locations through Server Actions or proxies called from an effect | `RULES.md` §9; `STACK.md` §6, §14 | Phase 9 — the phase decides whether the proxies move to Server Actions or stay under a new ADR, since the upstreams can't be called from the browser |
| 20 | Hand-rolled i18n (`lib/i18n/*`) with Spanish as the source language; URL state hand-rolled instead of nuqs; no date-fns; request errors shown as toasts | `STACK.md` §1, §14; `RULES.md` §15 | Phase 9 |
| 21 | No Impeccable: no package, skill, hook, `.impeccable/config.json`, `PRODUCT.md` or `DESIGN.md` | `STACK.md` §17 | Phase 9 |
| 22 | Rate limiting in a Postgres table (0005) instead of `@upstash/ratelimit` | `RULES.md` §16; `STACK.md` §10 | Phase 10 |
| 23 | Background work: a GitHub Actions cron draining a Postgres queue (0006) instead of `after()` + QStash | `STACK.md` §13 | Phase 10 |
| 24 | Email through `lib/email/*` with string templates, without the `resend` SDK or react-email | `STACK.md` §1 | Phase 10 |
| 25 | NextAuth 4 with stateless JWT sessions and a revocation clock (0004); no central `can()` permissions layer (the app has no roles; ownership is checked in each action) | `RULES.md` §10, §16; `STACK.md` §1, §10 | Phase 11 |
| 26 | No staging environment; previews not on a seed-only Neon parent; EU regions not recorded | `STACK.md` §2, §12 | Phase 12 |
| 27 | Coverage leaves out `scripts/` and the root `proxy.ts` (outside `include`) and excludes `lib/mock/**` and `**/index.ts` | `RULES.md` §3 (coverage exclusions) | Phase 5 (`proxy.ts` moves into `src/`), phase 7 (the rest) |
| 28 | The axe accessibility check disables the `color-contrast` rule (`e2e/a11y.spec.ts`) | `RULES.md` §22 item 3; `STACK.md` §14, §16 | Phase 9 |

### Dependencies outside `STACK.md`

Approved by the owner (2026-09-27) for jobs `STACK.md` has no library for: `leaflet`, `react-leaflet` and
`@types/leaflet` (the map), `react-icons` (brand icons), `next-themes` (theme switching), the
Radix packages shadcn/ui is built on and `tw-animate-css`, `react-qr-code` (the 2FA enrolment
QR), `cross-env` (scripts that run on Windows), `pg` and `@types/pg` (the peer of
`@prisma/adapter-pg`), `@testing-library/*`, `jsdom` and `vitest-axe` (component tests).

Accepted until their phase: `next-auth`, `@next-auth/prisma-adapter`, `bcryptjs` and
`@types/bcryptjs` (phase 11), `@neondatabase/serverless` and `dotenv` (phase 6), `eslint` and
`eslint-config-next` (phase 3).

## What it beat

- **Rules only, stack untouched**: adopting `RULES.md` and the checks but rewriting `STACK.md` to
  describe BuyCarMap's current stack, as the core allows for projects on a different stack. Cheaper
  now, but BuyCarMap is on the core's own stack (Next.js + Prisma) with legacy choices inside it,
  and the owner wants it on the shared stack so every core change applies unchanged.
- **One big migration**: a single branch moving layout, auth, i18n, data model and tooling at once.
  Unreviewable, and a failure anywhere blocks everything. Phases keep each PR small enough for
  `/check-all` to judge and keep the risky ones (data model, auth) apart.
- **Migrating without an adoption ADR**: without it every change inside the old structure is a
  BLOCKER until the whole migration lands, which stalls unrelated work.

## What would change our mind

- A phase whose cost turns out far above its value — the data model re-key on live accounts is
  the likeliest — is re-decided with the owner, and the deviation becomes a permanent, separately
  recorded ADR instead of being forced.
- A technical constraint the core stack can't meet. The upstream marketplaces can't be called from
  the browser (0003); if Server Actions can't carry the search, the proxy routes stay under their
  own ADR.

## Not accepted

Found while adopting; fixed when touched, or in the phase named:

- lib/mock/listings.ts is dead code (`RULES.md` §6) — removed with knip in phase 3.
- The map draws every listing as its own marker, with no clustering or limit
  (`components/map/ListingsMap.tsx`) — fixed when a change makes it cost performance (`CLAUDE.md` ›
  Upstream sources).
- `scripts/docs-check.mjs` said the gap list lived in `docs/documentation-plan.md` and that a
  spec on every change was rejected — both out of date; fixed in this change.
- `docs/decisions/README.md` did not index 0006 — fixed in this change.
- `CLAUDE.md` and `docs/README.md` counted eleven Prisma models; the schema has seventeen — fixed
  in this change.

## Open questions

- **Accounts.** Upstash (Redis and QStash) and Sentry accounts, and Docker on the development
  machine, are needed from phases 6, 7 and 10.
