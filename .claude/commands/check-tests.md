---
description: Review working changes and ensure meaningful tests exist and pass
allowed-tools: Read, Grep, Glob, Bash(npm:*), Bash(npx:*), Bash(pnpm:*), Bash(git:*), Edit, Write, Task
---

You are reviewing the current working changes to ensure every new or modified piece of logic has a colocated test that can actually fail. Work through each phase sequentially. Do NOT skip phases. Be direct: flag missing tests and real problems.

## Phase 0 — Test Quality Bar (READ BEFORE WRITING ANY TEST)

**A test is only worth writing if it can fail when the production code is wrong.** If a test cannot detect a regression, it is worse than no test — it inflates coverage, gives false confidence, and rots silently.

**FORBIDDEN — these are auto-rejection patterns. If you write any of them, delete the test:**

- **Tautological assertions** — `expect(true).toBe(true)`, `expect(1).toBe(1)`, `expect(result).toBe(result)`, `expect(typeof x).toBe("string")` when `x` is hardcoded as a string two lines above. The assertion must compare a runtime-computed value against an *independently derived* expected value.
- **Self-fulfilling fixtures** — calling the function/hook/component under test to compute the "expected" value, then asserting the output equals that value. The expected value MUST be hand-derived from the input by you, not by the SUT.
- **Mock-the-SUT** — mocking the very unit you are claiming to test (e.g. mocking `useGetThings` inside `useGetThings.test.tsx`, or `UserService.getUsers` inside `user.service.test.ts`). Mock its *dependencies*, never the unit itself.
- **Assertion-free tests** — `it("renders", () => { render(<Foo />); })` / `it("works", async () => { await svc.doThing(); })` with no `expect`. A test that never asserts cannot fail — it is dead weight.
- **`getByText("Some label")` as the only assertion for a heavy component** — you are testing that you typed the same string twice. Real components have behaviour: assert what happens when the user clicks, types, submits.
- **Snapshot abuse** — `toMatchSnapshot()` on huge opaque trees with no human review of the snapshot file. Snapshots are only acceptable for small, stable, human-readable shapes you actually inspect.
- **Mock that returns the assertion** — a mock resolves `{ items: [{ name: "Ada" }] }`, then the test asserts `name === "Ada"`. You are testing the mock library, not your code. The transform/filter/sort/derived logic between mock and assertion must be non-trivial.
- **Try/catch-swallow** — `try { await x(); } catch {}` with no `expect.assertions(N)` or rejection assertion. A throw vanishes silently and the test passes for the wrong reason. Use `await expect(x()).rejects.toThrow(...)` instead.
- **Loose matchers on known values** — `expect(result).toEqual(expect.any(Object))`, `expect(node).toBeDefined()` when you actually know the exact text/value. Assert the real value.
- **Tests that exist only to import the file** — coverage-hack tests. If the only thing the test does is exercise an import, delete it.
- **`act` / async-warning suppression** — wrapping things until the warning disappears without understanding why. The warning means your assertion is racing async state — fix the test (`await waitFor`, `findBy*`, wait on the real async boundary) instead of muting it.

**REQUIRED — every test must:**

1. **Have a clear "what could go wrong" answer.** Before writing, state to yourself: "If a future developer breaks X, this test will catch it because Y." If you cannot complete that sentence, do not write the test.
2. **Hand-derive the expected value.** Write the input, mentally run the logic, write the expected output. Then run the test. If it fails, fix the code OR fix your expectation — never blindly copy the actual output into the assertion.
3. **Cover at least one negative path** for any logic with branches: invalid input → error, empty list → empty result/render, loading → skeleton, error → error state.
4. **Test observable behaviour, not implementation.** Assert the return value / thrown error / rendered output / what the mutation fired with — not "this internal method or `useState` was called".
5. **Be deterministic.** No `Date.now()` without freezing, no `Math.random()`, no real network, no real timers without fake timers + cleanup.

## Phase 1 — Scope

Run `git diff --name-only` and `git diff --cached --name-only` to identify all changed files. Also check `git status` for untracked files. Read every changed/new file in full. Categorize each as:

- **Pure functions / utilities** — direct input→output tests.
- **Validation schemas / business rules** — valid + invalid payloads, assert the specific error.
- **Stateful units (hooks, services, stores)** — exercise the logic, mock only dependencies.
- **Components** — render + interaction (click/type/submit), assert observable output.
- **No test needed** — type-only files, pure config, generated code, thin glue with no logic.

**This project's test setup is already established — use it, do NOT re-detect or introduce alternatives** (full details in CLAUDE.md "## Testing"):

- **Runner:** Vitest, two projects (`vitest.config.ts`): `unit` (jsdom — pure lib, source clients, hooks, components) and `node` (route handlers + server actions; opt in by naming the file **`*.node.test.ts`**). Tests are colocated `*.test.ts(x)`.
- **Libraries:** React Testing Library + `@testing-library/user-event`; **MSW for ALL network mocking** (`onUnhandledRequest: "error"` — never hand-stub `global.fetch`); `vitest-axe` for a11y; Playwright for e2e (`e2e/`, projects `chromium`/`mobile`/`visual`); Zod contract tests (`test/contract/`).
- **Reuse the shared helpers — don't reinvent:** typed fixtures `test/fixtures/*` (`makeWallapopItem`, `makeCochesNetItem`, …), MSW handlers `test/msw/handlers.ts` (override per-test with `server.use`), `renderWithI18n` from `test/utils/render.tsx`, controllable IO `test/mocks/intersection-observer.ts`.

**Known environment gotchas — don't re-trip on these:**
- Module-level caches persist across tests (`lib/wallapop/cache.ts`, `lib/cochesnet/models.ts`, `lib/geo/user-location.ts`) — use distinct keys/brands per test or fake timers.
- `<input type="email">` is validated natively by the browser *before* react-hook-form runs — assert "did not submit" for malformed input; use empty/required cases to exercise RHF/zod messages.
- Controlled inputs (e.g. `RangeInput`) need a stateful harness so typed values accumulate.
- `useListingsSearch.loadMore` fires only via the sentinel — drive it with `sentinelRef(node)` + `triggerIntersection()`.
- jsdom stubs (IntersectionObserver, geolocation→denied, matchMedia, canvas) live in `test/setup.jsdom.ts`; Leaflet can't run in jsdom — mock `react-leaflet` in component tests.

**e2e boundary (this project HAS Playwright).** For a changed API route, client↔server contract, auth gate, or new user-facing page/flow, add or extend an `e2e/*.spec.ts` matching the existing patterns — mock the source proxies via `e2e/fixtures/network.ts` (fixture image URLs MUST use an allowed `next.config` host: `**.wallapop.com`, `**.ccdn.es`). Don't invent a parallel harness.

**The DB-gated e2e is real** — `pnpm test:e2e:db` (`E2E_DB=1`, needs `pnpm db:branch` first) runs the auth, two-factor and favorites round trips against actual Postgres. It is the only thing that proves persistence, since Prisma is mocked everywhere in Vitest, and it does **not** run in CI. Two rules that cost real debugging: never assert an optimistic UI toggle to prove a write landed (poll the row count), and on a server-rendered page wait for the session to resolve before clicking — see `docs/testing.md`.

## Phase 2 — Test Inventory

For each testable changed file, check if a colocated test file exists next to it. List:

- Files **with** existing tests — note whether they cover the new/changed code.
- Files **missing** tests entirely.
- Test files that exist but don't cover the newly added behaviour.

## Phase 3 — Test Quality Review

For every existing test file related to changed code, read it and verify against Phase 0. Also confirm:

- **Colocated:** test file sits next to the source file — no separate `__tests__/` graveyards unless the project already uses them.
- **Structure:** one `describe` per unit, one `it` per case, clear English test names.
- **No leakage:** cookies/localStorage/globals set in a test are cleared in `beforeEach`/`afterEach`; no real network or filesystem.

Flag any existing test that violates Phase 0 — a bad test that outlived its usefulness should be rewritten or deleted, not left as false coverage.

## Phase 4 — Write Missing Tests

For each file that needs tests (from Phase 2), write them following this project's established patterns (see the setup block in Phase 1). Do not introduce a new test framework or convention.

Rules when writing:
- Colocate the test next to the source file. Node-only tests (route handlers, server actions) → `*.node.test.ts`.
- Reuse `test/fixtures/*` builders, `test/msw/handlers.ts` (+ `server.use` overrides), and `renderWithI18n` — never hand-stub `fetch`, never re-declare fixtures inline.
- English test names, one `describe` per unit.
- No `any`/`unknown` (project bans them) — define real types.
- Cover edge cases: null/empty inputs, boundary values, missing optional fields.
- Cover computed/derived properties explicitly — any field derived from other fields.
- Cover error paths — invalid input that should throw, `toast.error`, or render a fallback.

## Phase 5 — Run Tests

Run `pnpm test` (Vitest — unit + hook + integration + component + contract) and report results. If you added or changed an `e2e/*.spec.ts`, also run `pnpm test:e2e` (Playwright). Do not run `test:contract:live` (hits real APIs) or `test:visual` (platform-specific baselines) as part of this check.

If any tests fail, list each failure with file path and error. Fix them — but read this carefully:

**Fix the production code, not the test, unless the test was actually wrong.**

When a test fails, the default assumption is the production code regressed. Diagnose first:

1. **Read the failing assertion** — what was expected vs what was produced?
2. **Re-derive the expected value by hand from the input.** If your hand-derivation matches the test's expectation → the production code is broken, fix it. If your hand-derivation matches the actual output → the test's expectation was wrong (or the requirement changed); update the test with a brief comment explaining why.
3. **NEVER "fix" a test by:**
   - Copy-pasting the actual output into the expected slot without understanding why it changed.
   - Replacing a real assertion with `expect.any(...)` / `toBeDefined()` / `toBeTruthy()` to make it pass.
   - Deleting the failing test or its assertions.
   - Wrapping the failing call in `try/catch` to swallow the error.
   - Loosening a strict equality to a partial match just to dodge the failure.
   - Re-mocking a dependency to whatever value makes the test green.
   - Adding `waitFor(() => {})` or arbitrary `setTimeout`s until a race stops biting — find the real async boundary and wait on it explicitly.
4. **If a test was genuinely testing the wrong thing** (an obsolete requirement), delete it and explain why in the report — don't leave a neutered version behind.

A test suite that goes green by lowering its standards is worse than one that stays red.

Then run the type check (`pnpm exec tsc --noEmit`) to make sure the test files don't break types.

## Output Format

For each phase, use this structure:

### Phase N — Title
**Status:** PASS | ISSUES FOUND | TESTS WRITTEN

If issues found or tests written, list them as:
- `file/path.ext` — Description (missing test / test written / issue found)

At the end, provide a summary:
- Total new test files created
- Total new test cases written
- Tests passing: YES / NO
