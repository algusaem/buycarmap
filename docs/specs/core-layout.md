# Source layout, server layer and dependency rules (migration phase 5)

Key: LAYOUT
Status: Approved
Last updated: 2026-09-28

---

## Problem

The code still uses BuyCarMap's own root layout (`app/`, `components/`, `lib/`, `interfaces/`,
`types/`, `e2e/`, `test/`, root `proxy.ts`), and nothing enforces where logic may live:

- **Prisma is reached from everywhere.** Ten Server Actions, two route handlers, two pages and five
  `lib/` modules import it.
- **Zod schemas sit apart from the features they validate** (`lib/validations/`).
- **The search merge's business logic lives inside a React hook** (`lib/hooks/useListingsSearch.ts`).
- **Nothing stops a component from importing server code or a cycle from forming.**
- **`proxy.ts` is not in the coverage run.**

The core fixes this with one tree (`STACK.md` §6), a server layer where `service.ts` is the only
Prisma importer, dependency-cruiser rules that fail the build (`STACK.md` §5 "Enforced config"),
and a `pnpm gen feature` scaffold. This is phase 5 of `docs/decisions/0007-adopt-core-rules.md`:
row 10, the phase-5 half of row 2 (dependency-cruiser, plop) and the phase-5 half of row 27
(`proxy.ts` moves into `src/`).

In scope: the move into `src/` and `tests/`; the server layer for every feature that touches the
database; dependency-cruiser in `lint`; plop; every path in config, docs, specs, commands and
`CLAUDE.md`. It is delivered as two PRs under this one spec:

- **5a** is the mechanical move, LAYOUT-1..5.
- **5b** is the server layer, dependency-cruiser and plop, LAYOUT-6..9.

## Acceptance criteria

`unit` means a `*.node.test.ts` under `scripts/` that reads the working tree, or runs the tool
under test on fixtures.

- [ ] LAYOUT-1 · unit — No tracked file sits under the root `app/`, `components/`, `lib/`, `interfaces/`, `types/`, `e2e/` or `test/`, and there is no root `proxy.ts`. Application code is under `src/` (`app`, `components`, `hooks`, `interfaces`, `lib`, `server`, `types`, `proxy.ts`), end-to-end specs are under `tests/e2e/`, and test helpers are under `tests/` (`contract`, `fixtures`, `mocks`, `msw`, `setup.jsdom.ts`, `setup.node.ts`, `types`, `utils`).
- [ ] LAYOUT-2 · unit — `@/*` resolves to `./src/*`. The Prisma client is generated into `src/generated/prisma`, which is gitignored, so `prisma generate` never recreates a root `app/` that Next would prefer over `src/app/`. `components.json` points at `src/app/globals.css`.
- [ ] LAYOUT-3 · unit — Vitest collects tests and coverage from `src/**` (so `src/proxy.ts` is covered) plus the existing `scripts/**` and `tests/contract/**`. Playwright's `testDir` is `./tests/e2e`. The coverage thresholds are unchanged.
- [ ] LAYOUT-4 · unit — `docs-check`'s source roots are `.claude`, `.github`, `prisma`, `scripts`, `src` and `tests`. The ownership map claims every tracked file under them, and every backticked source path in the README, `CLAUDE.md`, `docs/`, `.claude/commands/` and the `Implemented` specs resolves (`pnpm docs:check` passes).
- [ ] LAYOUT-5 · unit — `src/hooks/useListingsSearch.ts` holds only request lifecycle. The pure merge logic (interleaving, the radius and model post-filters, page-state advance) lives in `src/lib/listings/` and the hook imports it from there. MAP-1..22 keep passing unchanged.
- [ ] LAYOUT-6 · unit — Every Server Action is in `src/server/<feature>/actions.ts`, every page read that touches the database is in `src/server/<feature>/queries.ts`, every Zod schema is in `src/server/<feature>/schema.ts`, and every Prisma call is in `src/server/<feature>/service.ts` or `src/lib/db/`. The features are `account`, `alerts`, `auth`, `email-verification`, `favorites`, `locale`, `password-reset`, `rate-limit`, `registration`, `search` and `two-factor`. `src/app/actions/` and `src/lib/validations/` do not exist.
- [ ] LAYOUT-7 · unit — `lint` runs dependency-cruiser with a committed config, and the tree has 0 violations. The config enforces:
  - `@prisma/*`, the generated client and `src/lib/db/**` are imported only from `src/server/**/service.ts`, `src/lib/db/**` and the phase-11 exception;
  - `src/app/**` never imports a `service.ts`;
  - `src/components/**` imports only `actions.ts` and `schema.ts` from `src/server/**`;
  - `src/lib/**` imports neither `src/server/**` nor `src/app/**`, except the phase-11 exception;
  - a feature imports another feature only through that feature's `service.ts` or `schema.ts`;
  - there are no circular dependencies.
- [ ] LAYOUT-8 · unit — The phase-11 exception is exactly one edge set: `src/lib/auth/options.ts` may import `src/lib/db/**` and `src/server/auth/service.ts`. It is written in the dependency-cruiser config with a comment naming ADR 0007 row 25, and no other file may use it.
- [ ] LAYOUT-9 · unit — `pnpm gen feature <name>` scaffolds `src/server/<name>/{queries,actions,service,schema}.ts` and `docs/specs/<name>.md` from `docs/specs/_template.md`. It refuses a name whose folder already exists and writes nothing.

## Worked examples

- **LAYOUT-1**:
  - `git ls-files app/page.tsx` → empty; `src/app/page.tsx` → tracked.
  - `proxy.ts` → not tracked; `src/proxy.ts` → tracked.
  - `e2e/map.spec.ts` → not tracked; `tests/e2e/map.spec.ts` → tracked.
- **LAYOUT-2**:
  - `tsconfig.json` `paths["@/*"]` → `["./src/*"]`.
  - `prisma/schema.prisma` generator `output` → `"../src/generated/prisma"`.
  - `.gitignore` contains `/src/generated/prisma`.
- **LAYOUT-3**: the coverage `include` contains `src/**` and none of `app/**`, `lib/**`, `components/**`; `playwright.config.ts` `testDir` → `"./tests/e2e"`.
- **LAYOUT-7**, run against fixture files:

  | Importing file | Imports | Result |
  | --- | --- | --- |
  | `src/app/x/page.tsx` | `@/server/favorites/service` | reported |
  | `src/app/x/page.tsx` | `@/server/favorites/queries` | clean |
  | `src/components/X.tsx` | `@/server/favorites/service` | reported |
  | `src/components/X.tsx` | `@/server/favorites/schema` | clean |
  | `src/components/X.tsx` | `@/server/favorites/actions` | clean |
  | `src/server/alerts/service.ts` | `@/server/rate-limit/service` | clean |
  | `src/server/alerts/service.ts` | `@/server/rate-limit/helpers` | reported |
  | `src/server/favorites/actions.ts` | `@/lib/db/prisma` | reported |
  | `src/lib/geo/x.ts` | `@/generated/prisma/client` | reported |
  | `src/lib/geo/x.ts` | `@/server/favorites/service` | reported |

  Two modules that import each other → reported as a cycle.
- **LAYOUT-8**:

  | Importing file | Imports | Result |
  | --- | --- | --- |
  | `src/lib/auth/options.ts` | `@/lib/db/prisma` | clean |
  | `src/lib/auth/options.ts` | `@/server/auth/service` | clean |
  | `src/lib/auth/session.ts` | `@/lib/db/prisma` | reported |
  | `src/lib/auth/options.ts` | `@/server/favorites/service` | reported |
- **LAYOUT-9**:
  - `pnpm gen feature widgets` on a tree without `src/server/widgets` creates exactly `src/server/widgets/queries.ts`, `actions.ts`, `service.ts`, `schema.ts` and `docs/specs/widgets.md`.
  - Run again, it exits non-zero with a message naming `src/server/widgets` and changes no file.

## Data model

None: this phase adds or changes no table or column. Only the generated client's output path moves
(LAYOUT-2).

## Permissions

No permission changes. Every action and query keeps its existing `getCurrentUser()` check and
ownership filter, moved with the code. The tests that prove them (ALERT-4/5, FAV-5/6/8, AUTH-*)
keep passing unchanged.

## Edge cases

- **Next picks a root `app/` over `src/app/`.** A generated client left at `app/generated/prisma`
  would silently shadow the whole app. LAYOUT-2 moves the output.
- **`proxy.ts` is only detected beside the app directory** (the root, or `src/`). It moves to
  `src/proxy.ts` in the same commit as `src/app/`.
- **Relative imports across roots.** `tests/e2e/two-factor.spec.ts` → `@/lib/auth/two-factor/totp`,
  and `tests/*` → `../fixtures`, `../msw`. The visual snapshot directory is built from
  `process.cwd()`.
- **Shared server modules.** `rate-limit` and `auth` are features in their own right, and others
  reach them only through their `service.ts` (LAYOUT-7).

## Out of scope

- **No behaviour change.** No criterion of any other spec changes. The tests move with their
  files and only their import paths change.
- **Test names and levels stay** (`*.test.ts` / `*.node.test.ts`, Prisma mocked), until phase 7
  (ADR 0007 row 16).
- **Not until phase 6:** the env module, the single DB module's adapters, `DIRECT_URL`,
  `Result<T, E>`, Pino and Sentry (rows 11–13). Phase 5 only moves `lib/prisma.ts` to
  `src/lib/db/prisma.ts`.
- **Not until phase 9:** the search fan-out still runs client-side through the proxies (row 19).
  `src/server/search/` holds only the search `schema.ts`.
- **Not until phase 11:** NextAuth stays (row 25). The only concession is LAYOUT-8.
- **Not until phase 9:** the Impeccable detector in `lint`.

## Contracts

- **New dev dependencies**: `dependency-cruiser` and `plop`, both in `STACK.md` §1 and §5. That
  means no new ADR for the dependencies themselves.
- **Scripts**:
  - `lint` gains a `depcruise` step (after Biome, before knip);
  - `gen` runs plop.
  - Adding scripts to `package.json` is the change this approved spec authorises (`RULES.md` §1).
- **Feature map**, from what exists today:

  | Feature | Takes over |
  | --- | --- |
  | `account` | `account.ts` actions and the account page read |
  | `alerts` | `alerts.ts` actions except `setLocale`; the run and unsubscribe route handlers' database work; the `alerts/[id]` page read; `lib/alerts/*` |
  | `auth` | `authorize`, `cleanup`, two-factor `verify` |
  | `email-verification` | the email-verification actions |
  | `favorites` | the favorites actions and schema |
  | `locale` | `setLocale` |
  | `password-reset` | `forgot-password` and `reset-password` |
  | `rate-limit` | `lib/rate-limit.ts` |
  | `registration` | `register`, `verify-registration` and `resend-confirmation` |
  | `search` | the search schema |
  | `two-factor` | the two-factor actions |

  Pure helpers with no I/O (hashing, tokens, TOTP, password policy, email templates, upstream
  clients) stay under `src/lib/`.

## Decisions and rationale

**Two PRs under one spec (owner's decision, 2026-09-28).** The move touches about 300 files and
changes no logic, so a reviewer can read it as renames. The server layer changes where code lives
and needs real review. Mixing them would bury the second in the first.

**Components may import `schema.ts` (owner's decision, 2026-09-28).** `STACK.md` §6 says
`schema.ts` is "shared with client", while §5's dependency rule lets components import only
`actions.ts`. The forms need the runtime schema for `zodResolver`, so the rule admits `schema.ts`
too. ADR 0012 records the interpretation, and the contradiction is reported to the core.

**Shared server modules are features reached through their service (owner's decision,
2026-09-28).** Eight actions consume rate limiting, and several consume the auth core. Forbidding
every cross-feature import would force duplication (`RULES.md` §6). Allowing only `service.ts`
and `schema.ts` keeps each feature's internals private.

**A single, named exception for NextAuth until phase 11 (owner's decision, 2026-09-28).**
`authOptions` needs the Prisma adapter and `authorize`. `CLAUDE.md` keeps it in `lib/auth/options.ts`
so that server components can import it without dragging in the route. The exception covers one
file and two targets, and phase 11 deletes it with NextAuth.

**Pure merge logic moves to `src/lib/listings/`, not to a service.** It runs in the browser on
proxy results, because the upstreams cannot be called from the server layer's actions yet (row 19,
phase 9). Taking it out of the hook satisfies `RULES.md` §8 (hooks own lifecycle, not logic)
without deciding phase 9 early.

**The generated client goes under `src/generated/`.** Leaving it under a root `app/` would make
Next ignore `src/app/`, with no error.

## Open questions

None.
