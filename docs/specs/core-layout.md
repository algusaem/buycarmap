# Server layer and dependency rules (migration phase 5)

Key: LAYOUT
Status: Approved
Last updated: 2026-09-29

---

## Problem

Nothing enforces where logic may live:

- **Prisma is reached from everywhere.** Ten Server Actions, two route handlers, two pages and five `lib/` modules import it.
- **Zod schemas sit apart from the features they validate** (`lib/validations/`).
- **The search merge's business logic lives inside a React hook** (`lib/hooks/useListingsSearch.ts`).
- **Nothing stops a component from importing server code or a cycle from forming.**
- **`proxy.ts` is not in the coverage run.**

The core's answer has three parts:

- a server layer where `service.ts` is the only Prisma importer (`STACK.md` §6);
- dependency-cruiser rules that fail the build (`STACK.md` §5 "Enforced config");
- a `pnpm gen feature` scaffold.

This is phase 5 of `docs/decisions/0007-adopt-core-rules.md`: row 10, the phase-5 half of row 2 (dependency-cruiser, plop) and the phase-5 half of row 27 (`proxy.ts` in coverage).

**The core's `src/` tree is not adopted.** The code keeps its root layout (`app/`, `components/`, `lib/`, `interfaces/`, `types/`, `e2e/`, `test/`, `proxy.ts`), and the server layer sits beside it in a root `server/`. Every core rule that names `src/` is applied to the root path instead.

In scope:

- the server layer for every feature that touches the database;
- the pure merge logic out of the hook;
- dependency-cruiser in `lint`;
- plop;
- the docs, specs and commands that name the moved files.

## Acceptance criteria

`unit` means a `*.node.test.ts` under `scripts/` that reads the working tree, or runs the tool under test on fixtures.

- [ ] LAYOUT-1 · unit — The root layout stays. `app/`, `components/`, `lib/`, `interfaces/`, `types/`, `e2e/`, `test/` and `proxy.ts` are at the repository root, and no tracked file sits under `src/`. ADR 0012 records the layout as a permanent deviation from `STACK.md` §6 (owner's decision, 2026-09-29).
- [ ] LAYOUT-2 · unit — Vitest's coverage `include` covers `proxy.ts`. The coverage thresholds are unchanged.
- [ ] LAYOUT-3 · unit — `lib/hooks/useListingsSearch.ts` holds only the request lifecycle. The pure merge logic lives in `lib/listings/` and the hook imports it from there. That logic is the interleaving, the radius and model post-filters and the page-state advance. MAP-1..22 keep passing unchanged.
- [ ] LAYOUT-4 · unit — `docs-check` does not require the source paths cited in `docs/decisions/` to exist, because an ADR is a dated record of the code as it was when the decision was taken. It still checks the ADRs' links. Every other backticked source path in the README, `CLAUDE.md`, `docs/`, `.claude/commands/` and the `Implemented` specs resolves (owner's decision, 2026-09-29).
- [ ] LAYOUT-5 · unit — Server code is organised by feature under `server/<feature>/`:
  - every Server Action is in `actions.ts`;
  - every page read that touches the database is in `queries.ts`;
  - every Zod schema is in `schema.ts`;
  - every Prisma call is in `service.ts`, apart from the client module in `lib/db/`.

  The features are `account`, `alerts`, `auth`, `email-verification`, `favorites`, `locale`, `password-reset`, `rate-limit`, `registration`, `search` and `two-factor`. `app/actions/`, `lib/validations/` and `lib/prisma.ts` no longer exist; the client module is `lib/db/prisma.ts`.
- [ ] LAYOUT-6 · unit — `lint` runs dependency-cruiser with a committed config, and the tree has 0 violations. The config enforces these rules:
  - `@prisma/*`, the generated client and `lib/db/**` are imported only from `server/**/service.ts`, `lib/db/**` and the exceptions of LAYOUT-7;
  - `app/**` never imports a `service.ts`, except under LAYOUT-8;
  - `components/**` imports only `actions.ts` and `schema.ts` from `server/**`;
  - `lib/**` imports neither `server/**` nor `app/**`, except under LAYOUT-7;
  - a feature imports another feature only through that feature's `service.ts` or `schema.ts`;
  - there are no circular dependencies.
- [ ] LAYOUT-7 · unit — The NextAuth exception is one edge set: `lib/auth/options.ts` may import `lib/db/**` and `server/auth/service.ts`. It is written in the dependency-cruiser config with a comment naming ADR 0007 row 25, and no other file may use it.
- [ ] LAYOUT-8 · unit — A `route.ts` under `app/api/**` may import a feature's `service.ts`, and every other file under `app/**` stays bound by LAYOUT-6. A route handler authenticates on its own (the cron secret, an unsubscribe token) because it has no user session and cannot go through `actions.ts` (owner's decision, 2026-09-29).
- [ ] LAYOUT-9 · unit — `pnpm gen feature <name>` scaffolds `server/<name>/{queries,actions,service,schema}.ts` and `docs/specs/<name>.md` from `docs/specs/_template.md`. It refuses a name whose folder already exists and writes nothing.

## Worked examples

- **LAYOUT-1**:
  - `git ls-files app/page.tsx proxy.ts e2e/map.spec.ts` → all three tracked.
  - `git ls-files src` → empty.
- **LAYOUT-2**: the coverage `include` of `vitest.config.ts` contains `"proxy.ts"`, and the thresholds still read statements 89, branches 85, functions 84, lines 89.
- **LAYOUT-4**:
  - `isDatedRecord("docs/decisions/0007-adopt-core-rules.md")` → `true`.
  - `isDatedRecord("docs/ARCHITECTURE.md")` → `false`.
  - `isDatedRecord("docs/specs/alerts.md")` → `false`.
- **LAYOUT-6**, run against fixture files:

  | Importing file | Imports | Result |
  | --- | --- | --- |
  | `app/x/page.tsx` | `@/server/favorites/service` | reported |
  | `app/x/page.tsx` | `@/server/favorites/queries` | clean |
  | `components/X.tsx` | `@/server/favorites/service` | reported |
  | `components/X.tsx` | `@/server/favorites/schema` | clean |
  | `components/X.tsx` | `@/server/favorites/actions` | clean |
  | `server/alerts/service.ts` | `@/server/rate-limit/service` | clean |
  | `server/alerts/service.ts` | `@/server/rate-limit/helpers` | reported |
  | `server/favorites/actions.ts` | `@/lib/db/prisma` | reported |
  | `lib/geo/x.ts` | `@/app/generated/prisma/client` | reported |
  | `lib/geo/x.ts` | `@/server/favorites/service` | reported |

  Two modules that import each other are reported as a cycle.
- **LAYOUT-7**:

  | Importing file | Imports | Result |
  | --- | --- | --- |
  | `lib/auth/options.ts` | `@/lib/db/prisma` | clean |
  | `lib/auth/options.ts` | `@/server/auth/service` | clean |
  | `lib/auth/session.ts` | `@/lib/db/prisma` | reported |
  | `lib/auth/options.ts` | `@/server/favorites/service` | reported |
- **LAYOUT-8**:

  | Importing file | Imports | Result |
  | --- | --- | --- |
  | `app/api/x/route.ts` | `@/server/alerts/service` | clean |
  | `app/x/page.tsx` | `@/server/alerts/service` | reported |
  | `app/api/x/helpers.ts` | `@/server/alerts/service` | reported |
- **LAYOUT-9**:
  - On a tree without `server/widgets`, `pnpm gen feature widgets` creates exactly `server/widgets/queries.ts`, `actions.ts`, `service.ts`, `schema.ts` and `docs/specs/widgets.md`.
  - Run again, it exits non-zero with a message naming `server/widgets`, and changes no file.

## Data model

None: no table or column changes. The Prisma client module moves from `lib/prisma.ts` to `lib/db/prisma.ts`; the generated client stays in `app/generated/prisma`.

## Permissions

No permission changes. Every action and query keeps its existing `getCurrentUser()` check and ownership filter, and they move with the code. The tests that prove them keep passing unchanged: ALERT-4/5, FAV-5/6/8 and AUTH-*.

## Edge cases

- **Shared server modules.** `rate-limit` and `auth` are features in their own right. Other features reach them only through their `service.ts` (LAYOUT-6).
- **Route handlers that need the database** are the alert run and the unsubscribe link. They call `server/alerts/service.ts` under LAYOUT-8.
- **Pages that read the database** are `account` and `alerts/[id]`. They read through `queries.ts`, which authenticates and then calls the service.
- **Moved Server Actions keep their ids.** Next derives a Server Action's id from its module. The actions are only ever called through imports, never by a stored id, so moving them breaks nothing that survives a deploy.

## Out of scope

- **No behaviour change.** No criterion of any other spec changes. Tests move with their subjects, and only their import paths change.
- **The core's `src/` tree** is kept out permanently by ADR 0012.
- **Test names and levels stay** until phase 7 (ADR 0007 row 16).
- **Phase 6:** the env module, the DB module's adapters, `DIRECT_URL`, `Result<T, E>`, Pino and Sentry (rows 11–13).
- **Phase 9:**
  - the search fan-out still runs client-side through the proxies (row 19), so `server/search/` holds only the search `schema.ts`;
  - the Impeccable detector in `lint`.
- **Phase 11:** NextAuth stays (row 25). The only concession is LAYOUT-7.

## Contracts

- **New dev dependencies.** `dependency-cruiser` and `plop` are both named in `STACK.md` §1 and §5, so neither needs its own ADR.
- **Scripts.** `lint` gains a `depcruise` step after Biome and before knip, and `gen` runs plop. This approved spec is what authorises the `package.json` script change (`RULES.md` §1).
- **Feature map**, built from what exists today:

  | Feature | Takes over |
  | --- | --- |
  | `account` | the `account.ts` actions and the account page read |
  | `alerts` | the `alerts.ts` actions except `setLocale`; the database work of the run and unsubscribe route handlers; the `alerts/[id]` page read; `lib/alerts/*` |
  | `auth` | `authorize`, `cleanup` and the two-factor `verify` |
  | `email-verification` | the email-verification actions |
  | `favorites` | the favorites actions and schema |
  | `locale` | `setLocale` |
  | `password-reset` | `forgot-password` and `reset-password` |
  | `rate-limit` | `lib/rate-limit.ts` |
  | `registration` | `register`, `verify-registration` and `resend-confirmation` |
  | `search` | the search schema |
  | `two-factor` | the two-factor actions |

  Pure helpers with no I/O stay under `lib/`: hashing, tokens, TOTP, the password policy, email templates and the upstream clients.

## Decisions and rationale

### The root layout stays (owner's decision, 2026-09-29)

Next.js supports `app/` at the root as fully as `src/app/`. The core's `src/` tree is a convention, not a technical need, and moving about 300 files would buy consistency with other projects at the cost of a huge diff and every path in the docs. ADR 0012 records the layout as a permanent deviation from `STACK.md` §6. Every core rule that names `src/` is applied to the root path instead: `server/` sits beside `app/` and `lib/`.

### About this spec

The first version, approved on 2026-09-28, moved everything into `src/` and was split into two PRs. The owner then chose the root layout, so the move went away. With it went the reason for two PRs, and this spec covers the whole phase. It keeps the server-layer decisions below, which the owner took on 2026-09-28 and 2026-09-29.

### Components may import `schema.ts` (owner's decision, 2026-09-28)

`STACK.md` §6 says `schema.ts` is "shared with client", while §5's dependency rule lets components import only `actions.ts`. The forms need the runtime schema for `zodResolver`, so the rule admits `schema.ts` too. ADR 0012 records the interpretation, and the contradiction is reported to the core.

### Shared server modules are features reached through their service (owner's decision, 2026-09-28)

Eight actions consume rate limiting, and several consume the auth core. Forbidding every cross-feature import would force duplication (`RULES.md` §6). Allowing only `service.ts` and `schema.ts` keeps each feature's internals private.

### Route handlers may import a service (owner's decision, 2026-09-29)

The alert cron and the unsubscribe link have no user session. They authenticate with the cron secret and a hashed token, so they cannot go through `actions.ts`, whose actions start from `getCurrentUser()`. Like Server Actions, they are server entry points that validate and authorize on their own. `RULES.md` §9 and `STACK.md` §13 keep route handlers for exactly these cases.

### A single, named exception for NextAuth until phase 11 (owner's decision, 2026-09-28)

`authOptions` needs the Prisma adapter and `authorize`. `CLAUDE.md` keeps it in `lib/auth/options.ts` so that server components can import it without dragging in the route. The exception covers one file and two targets, and phase 11 deletes it along with NextAuth.

### Pure merge logic moves to `lib/listings/`, not to a service

It runs in the browser on proxy results, because the upstreams cannot be called from the server layer's actions yet (row 19, phase 9). Taking it out of the hook satisfies `RULES.md` §8 (hooks own lifecycle, not logic) without deciding phase 9 early.

### ADRs are dated records (owner's decision, 2026-09-29)

This phase moves files that accepted ADRs cite, for example `app/actions/` in ADR 0007. An accepted ADR is never edited, so its paths describe the code as it was when the decision was taken. `docs-check` stops requiring them to exist, and still checks the ADRs' links.
