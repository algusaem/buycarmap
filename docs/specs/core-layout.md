# Source layout (migration phase 5a)

Key: LAYOUT
Status: Approved
Last updated: 2026-09-29

---

## Problem

The code still uses BuyCarMap's own root layout: `app/`, `components/`, `lib/`, `interfaces/`, `types/`, `e2e/`, `test/` and a root `proxy.ts`. The core puts all of it in one tree (`STACK.md` §6). Because of the old layout:

- `proxy.ts` sits outside the coverage run.
- The search merge's business logic lives inside a React hook (`lib/hooks/useListingsSearch.ts`).

This spec covers the first half of phase 5 of `docs/decisions/0007-adopt-core-rules.md`:

- row 10's layout;
- the phase-5 half of row 27, which moves `proxy.ts` into `src/`.

The server layer, dependency-cruiser and plop are the second half, in `docs/specs/core-server-layer.md`.

In scope:

- the move into `src/` and `tests/`;
- extracting the pure merge logic from the hook;
- every path in config, docs, specs, commands and `CLAUDE.md`.

## Acceptance criteria

`unit` means a `*.node.test.ts` under `scripts/` that reads the working tree.

- [ ] LAYOUT-1 · unit — No tracked file sits under the root `app/`, `components/`, `lib/`, `interfaces/`, `types/`, `e2e/` or `test/`, and there is no root `proxy.ts`. Application code is under `src/` (`app`, `components`, `hooks`, `interfaces`, `lib`, `types`, `proxy.ts`). End-to-end specs are under `tests/e2e/`. Test helpers are under `tests/` (`contract`, `fixtures`, `mocks`, `msw`, `setup.jsdom.ts`, `setup.node.ts`, `types`, `utils`).
- [ ] LAYOUT-2 · unit — `@/*` resolves to `./src/*`. The Prisma client is generated into `src/generated/prisma`, which is gitignored, so `prisma generate` never recreates a root `app/` that Next would prefer over `src/app/`. `components.json` points at `src/app/globals.css`.
- [ ] LAYOUT-3 · unit — Vitest collects tests and coverage from `src/**`, so `src/proxy.ts` is covered, plus the existing `scripts/**` and `tests/contract/**`. Playwright's `testDir` is `./tests/e2e`. The coverage thresholds are unchanged.
- [ ] LAYOUT-4 · unit — `docs-check`'s source roots are `.claude`, `.github`, `prisma`, `scripts`, `src` and `tests`. The ownership map claims every tracked file under them. Every backticked source path in the README, `CLAUDE.md`, `docs/`, `.claude/commands/` and the `Implemented` specs resolves, so `pnpm docs:check` passes. The one exception is `docs/decisions/`: an ADR is a dated record, so the paths it cites describe the code as it was when the decision was taken, and `docs-check` does not require them to exist. It still checks the ADRs' links. This exception is the owner's decision, 2026-09-29.
- [ ] LAYOUT-5 · unit — `src/hooks/useListingsSearch.ts` holds only the request lifecycle. The pure merge logic (interleaving, the radius and model post-filters, page-state advance) lives in `src/lib/listings/`, and the hook imports it from there. MAP-1..22 keep passing unchanged.

## Worked examples

- **LAYOUT-1**:
  - `git ls-files app/page.tsx` → empty; `src/app/page.tsx` → tracked.
  - `proxy.ts` → not tracked; `src/proxy.ts` → tracked.
  - `e2e/map.spec.ts` → not tracked; `tests/e2e/map.spec.ts` → tracked.
- **LAYOUT-2**:
  - `tsconfig.json` `paths["@/*"]` → `["./src/*"]`.
  - `prisma/schema.prisma` generator `output` → `"../src/generated/prisma"`.
  - `.gitignore` contains `/src/generated/prisma`.
- **LAYOUT-3**:
  - The coverage `include` contains `src/**` and none of `app/**`, `lib/**`, `components/**`.
  - `playwright.config.ts` `testDir` → `"./tests/e2e"`.
- **LAYOUT-4**:
  - `isDatedRecord("docs/decisions/0007-adopt-core-rules.md")` → `true`.
  - `isDatedRecord("docs/ARCHITECTURE.md")` → `false`.
  - `isDatedRecord("docs/specs/alerts.md")` → `false`.

## Data model

None: this phase adds or changes no table or column. Only the generated client's output path moves (LAYOUT-2).

## Permissions

No permission changes. Every action and query keeps its `getCurrentUser()` check and ownership filter; only the file paths change.

## Edge cases

- **Next picks a root `app/` over `src/app/`.** A generated client left at `app/generated/prisma` would silently shadow the whole app. LAYOUT-2 moves the output.
- **`proxy.ts` is only detected beside the app directory,** meaning the root or `src/`. It moves to `src/proxy.ts` in the same commit as `src/app/`.
- **Relative imports across roots.**
  - `tests/e2e/two-factor.spec.ts` imports `@/lib/auth/two-factor/totp`.
  - `tests/*` import `../fixtures` and `../msw`.
  - The visual snapshot directory is built from `process.cwd()`.

## Out of scope

- **No behaviour change.** No criterion of any other spec changes. Tests move with their files; only their import paths change.
- **The server layer** (`src/server/<feature>/`), dependency-cruiser and plop: `docs/specs/core-server-layer.md`. Until it lands, Server Actions sit in `src/app/actions/` and schemas in `src/lib/validations/`.
- **Test names and levels stay** (`*.test.ts` / `*.node.test.ts`, Prisma mocked) until phase 7 (ADR 0007 row 16).
- **Phase 6:** the env module, the DB module's adapters, `DIRECT_URL`, `Result<T, E>`, Pino and Sentry (rows 11–13). Here `lib/prisma.ts` only moves, to `src/lib/prisma.ts`.
- **Phase 9:** the search fan-out still runs client-side through the proxies (row 19).

## Decisions and rationale

**Two specs, two PRs (owner's decision, 2026-09-29).** Phase 5 was approved on 2026-09-28 as one spec delivered in two PRs. An `Approved` spec needs a test for every criterion, and the server-layer tests stay red until the second PR. So the first PR could not merge green. The approved criteria were split without changing their text:

- LAYOUT-1..5 stay here;
- LAYOUT-6..9 became SERVER-1..4 in `docs/specs/core-server-layer.md`.

No test named those ids yet, so nothing was renumbered in use. The move touches about 300 files and changes no logic, so a reviewer can read it as renames.

**Pure merge logic moves to `src/lib/listings/`, not to a service.** It runs in the browser on proxy results, because the upstreams cannot be called from the server layer's actions yet (row 19, phase 9). Taking it out of the hook satisfies `RULES.md` §8 (hooks own lifecycle, not logic) without deciding phase 9 early.

**The generated client goes under `src/generated/`.** Leaving it under a root `app/` would make Next ignore `src/app/`, with no error.
