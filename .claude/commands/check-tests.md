---
description: Review working changes for specs, TDD and test integrity, then make sure meaningful tests exist and pass
allowed-tools: Read, Grep, Glob, Bash(npm:*), Bash(npx:*), Bash(pnpm:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Edit, Write, Task
---

Make sure every new or modified piece of logic comes from a spec and has a test that can actually fail. Work through each phase sequentially. Do NOT skip phases. Be direct: flag missing tests and real problems.

**Phases 0–4 are the review** (Phase 0 is the bar it applies) and follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output. **Phases 5–6 write and run tests** — the only writing phases of any `check-*` command. Inside `/check-all` they are split: `lacayo-opus` runs Phases 0–4 and returns the cases to write; `lacayo-sonnet` runs Phases 0, 5 and 6 — the bar, then writing and running the cases the main session approved.

**Owns:** `RULES.md` §3 (skipping, deleting or bending tests; weakening verification; real data in fixtures), §4 (spec, worked examples, TDD, the spec-change rule), §10 (the tests it requires), §20; `STACK.md` §0, §5 (guardrail config, CI workflows), §15 (except "Out of scope" → `check-process`), §16; golden files updated to make a test pass (`STACK-ERP.md` §11).
**Applies to:** every change — any changed logic needs its tests, and every changed test or test config is reviewed.

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
Run on its own, the main session neither reviews the tests nor writes them itself:
- **Phases 0–4 → one `Agent` with `subagent_type: "lacayo-opus"`**, told it is the delegated agent and spawns no agents, and briefed with this file, `.claude/review-protocol.md`, the change set, the task in the user's words, the spec and the approvals quoted; it returns the review and the cases to write.
- **The mastermind** decides which cases to write, with their exact expected values — taken from the spec's worked examples or asked of the user, never invented (`RULES.md` §4).
- **Phases 0, 5 and 6 → one `Agent` with `subagent_type: "lacayo-sonnet"`**, told it is the delegated agent and spawns no agents, and briefed with the approved cases and their file paths; it writes them, runs them and pastes the outputs. A red test is reported, never fixed by the agent; the mastermind decides the production fix and applies it — direct for two or three steps in one file, `lacayo-sonnet` for anything longer.
Inside `/check-all` this paragraph does not apply: there the agent running this file is already the delegated hand. Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 opus» did not follow this command.

## Phase 0 — Test Quality Bar (READ BEFORE WRITING ANY TEST)

**A test is only worth writing if it can fail when the production code is wrong.** If a test cannot detect a regression, it is worse than no test — it inflates coverage, gives false confidence, and rots silently.

**FORBIDDEN — these are auto-rejection patterns. If you write any of them, delete the test:**

- **Tautological assertions** — `expect(true).toBe(true)`, `expect(1).toBe(1)`, `expect(result).toBe(result)`, `expect(typeof x).toBe("string")` when `x` is hardcoded as a string two lines above. The assertion must compare a runtime-computed value against an *independently derived* expected value.
- **Self-fulfilling fixtures** — calling the function/hook/component under test to compute the "expected" value, then asserting the output equals that value. The expected value MUST be hand-derived from the input by you, not by the SUT.
- **Mock-the-SUT** — mocking the very unit you are claiming to test (e.g. mocking `useGetThings` inside `useGetThings.test.tsx`, or `UserService.getUsers` inside `user.service.test.ts`). Mock its *dependencies*, never the unit itself.
- **Assertion-free tests** — `it("renders", () => { render(<Foo />); })` / `it("works", async () => { await svc.doThing(); })` with no `expect`. A test that never asserts cannot fail — it is dead weight.
- **`getByText("Some label")` as the only assertion for a heavy component** — you are testing that you typed the same string twice. Real components have behaviour: assert what happens when the user clicks, types, submits.
- **Snapshot abuse** — `toMatchSnapshot()` on huge opaque trees with no human review of the snapshot file. React snapshot tests are never acceptable (`STACK.md` §16); other snapshots only for small, stable, human-readable shapes you actually inspect.
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

Take the changed, staged and untracked files (review protocol §2) and read every one in full. Categorize each as:

- **Pure functions / utilities** — direct input→output tests.
- **Validation schemas / business rules** — valid + invalid payloads, assert the specific error.
- **Stateful units (hooks, services, stores)** — exercise the logic, mock only dependencies.
- **Components** — render + interaction (click/type/submit), assert observable output.
- **No test needed** — type-only files, pure config, generated code. Nothing else: TDD applies to all code, UI and glue included. Glue with no logic of its own is covered by the integration or E2E test of the flow it wires up.

**Detect the test setup — don't assume it.** Inspect the repo for what kind of tests exist: a unit/component runner (Vitest, Jest, etc.), and separately an integration/e2e suite (Playwright, Cypress, a `test:e2e` script, an `e2e/` or `integration/` directory). Adapt to what's actually there.

**Required by `RULES.md` §10 and §22**, whatever the suite looks like today: every new or changed protected Server Action / route handler needs an integration test proving a user without permission is rejected (authorization error, or 403 in route handlers), and every new or changed permission-filtered query needs one proving an unauthorized user receives no rows. A changed user flow — a new flow, or a change in what the user sees or can do in an existing one (a bug fix that turns an empty state into results counts) — needs an E2E test; changed UI needs the accessibility (axe) tests to cover it. Missing → BLOCKER. If the project has no suite where one of these can live, report the gap — don't scaffold one unprompted.

**If the project has an integration/e2e suite**, additionally flag changes that cross an integration boundary and need e2e coverage: a new/changed API endpoint or route, a cross-service or client↔server contract, an auth/permission gate, a stateful mutation whose DB effect should be asserted, a new user-facing page/flow. For those, plan to add or extend a spec in the existing suite — match its patterns and helpers, don't invent a parallel one.

## Phase 2 — Spec and TDD (`RULES.md` §4, `STACK.md` §15)

- **Spec**: the changed feature has `docs/specs/<feature>.md` with every fixed section (Problem, Acceptance criteria, Worked examples, Data model, Permissions, Edge cases, Out of scope), updated for this change. No spec, or a spec the change has outgrown → BLOCKER.
- **Worked examples**: critical-path work (the list in `STACK.md` §16: permissions, anything that broke once, what the domain file adds) has them with exact values, and the tests use those exact values. **Every bug fix** adds at least one: the input that failed and the correct result, which is its regression test. Missing → BLOCKER: ask for them, never invent them.
- **TDD**: tests are written before the implementation (spec → failing tests → code → refactor). Changed logic without tests means TDD was skipped → BLOCKER, and the missing tests go to Phase 3. When spec, tests and code arrive in one commit, the order can't be shown from the diff: say so in a NOTE, and judge by whether every changed branch has a test.

## Phase 3 — Test Inventory

For each testable changed file, check if its test file exists where the layout puts it (`<feature>.test.ts` unit, `<feature>.integration.test.ts` integration, `tests/e2e/<flow>.spec.ts` E2E). List:

- Files **with** existing tests — note whether they cover the new/changed code.
- Files **missing** tests entirely.
- Test files that exist but don't cover the newly added behaviour.

For every missing test, list **the cases to write**: the input and the hand-derived expected value of each, taken from the spec's worked examples where they exist. Where the spec has none, derive them from the spec's rules and mark them **"needs confirmation as worked examples"** — for critical-path work they can't be written until the user confirms them. A case whose expected value depends on a decision the spec doesn't make is listed as **blocked**, with the question. This list is what Phase 5 writes — inside `/check-all`, the main session approves it before anyone writes a line.

## Phase 4 — Test Quality and Integrity

For every changed or related existing test file, verify it against Phase 0. Also confirm:

- **Placement:** the test sits where the layout puts it, in the right Vitest project — `unit` never touches a database, Docker or the network; anything needing the database is `integration` (Testcontainers); external APIs through MSW (`RULES.md` §20).
- **Structure:** one `describe` per unit, one `it` per case, clear English test names (a command rule: breaking it is an ISSUE).
- **No leakage:** cookies/localStorage/globals set in a test are cleared in `beforeEach`/`afterEach`; no real network or filesystem.
- **Data:** never real data — real people, emails, phones, addresses → BLOCKER. Factories fill incidental fields with faker; the values an assertion depends on (a coordinate, an amount) are fixed and hand-picked, because the expected value is derived from them.
- **Setup (`STACK.md` §16):** integration tests run in a transaction per test, rolled back; list queries tested at realistic volume and checked with `EXPLAIN` for a sequential scan; no tests of Prisma, shadcn or Next.js themselves.

Flag any existing test that violates Phase 0 — a bad test is false coverage. Report it and ask before rewriting or deleting it: existing tests only change when the spec changes (`RULES.md` §3, §4).

**Test tampering** — each of these is a BLOCKER unless the spec changed in this same diff and the test change follows it (`RULES.md` §4):

- an assertion removed, loosened (`toBeDefined`, `expect.any`, partial match) or its expected value changed
- `.skip`, `.only`, `.todo`, `it.fails` added; a test file deleted
- snapshots added or updated; golden fixtures updated (a React snapshot test is a BLOCKER even with a spec change)
- retries added to Vitest or Playwright

**Guardrail tampering** — each of these is a BLOCKER (the APPROVAL is `check-process`'s):

- rules disabled in `biome.json`, ignores added to dependency-cruiser or knip
- coverage or type-coverage thresholds lowered, files excluded from coverage or typecheck
- steps removed from `check` / `check:full`
- Husky hooks, commitlint or lint-staged config weakened
- Impeccable weakened: the detector taken out of `lint`, `detector.designSystem` disabled, a whole rule ignored (`detector.ignoreRules`), ignores in `.impeccable/config.local.json`, the design hook removed from `.claude/settings.json` or `hook.enabled` set to `false`
- CI workflows' required steps removed; the E2E workflow (`STACK.md` §5) no longer running on the preview's `deployment_status`, running against production, or losing the Vercel protection bypass from its secret

## Phase 5 — Write Missing Tests

Write the cases from Phase 3 (inside `/check-all`: exactly the approved cases, in the files named in the brief), following the project's established patterns — match the existing test style, framework, and helpers already in the repo. Do not introduce a new test framework or convention.

Rules when writing:
- Follow the test layout and Vitest projects of Phase 4.
- Fixtures and factories use faker — never real data.
- Derive expected values from the spec in `docs/specs/` when it exists. Use its worked examples verbatim; if critical-path work has none, stop and ask for them — never invent them.
- English test names.
- Match the project's type-safety rules (`RULES.md` §3, §7: no `any`, no `as unknown as` — define real types).
- Cover edge cases: null/empty inputs, boundary values, missing optional fields.
- Cover computed/derived properties explicitly — any field derived from other fields.
- Cover error paths — invalid input that should throw, toast, or render a fallback.

## Phase 6 — Run Tests

Run the project's test suite and report results (use the project's actual command — inspect `package.json` scripts). Then run the project's type check to make sure the test files don't break types.

If any tests fail, list each failure with file path and error. **Inside `/check-all`, report and stop there: the main session decides.** Run on its own, fix them — but read this carefully:

**Fix the production code, not the test, unless the test was actually wrong.**

When a test fails, the default assumption is the production code regressed. Diagnose first:

1. **Read the failing assertion** — what was expected vs what was produced?
2. **Re-derive the expected value by hand from the input.** If your hand-derivation matches the test's expectation → the production code is broken, fix it. If your hand-derivation matches the actual output → either the spec changed or the test is wrong. Only if the spec was updated in this same change may the test follow it (`RULES.md` §4). Otherwise stop and raise it — do not edit the test (`RULES.md` §3).
3. **NEVER "fix" a test by:**
   - Copy-pasting the actual output into the expected slot without understanding why it changed.
   - Replacing a real assertion with `expect.any(...)` / `toBeDefined()` / `toBeTruthy()` to make it pass.
   - Deleting the failing test or its assertions.
   - Wrapping the failing call in `try/catch` to swallow the error.
   - Loosening a strict equality to a partial match just to dodge the failure.
   - Re-mocking a dependency to whatever value makes the test green.
   - Adding `waitFor(() => {})` or arbitrary `setTimeout`s until a race stops biting — find the real async boundary and wait on it explicitly.
4. **If a test was genuinely testing the wrong thing** (an obsolete requirement), it goes only when the spec change that made it obsolete is in this same change: delete it and explain why in the report — don't leave a neutered version behind. Without that spec change, stop and raise it.

A test suite that goes green by lowering its standards is worse than one that stays red.

## Output Format

Phases 0–4 report in the review protocol's format, with the cases to write from Phase 3 in their own section ("Cases to write"). An E2E case whose preconditions can't be established read-only (a mock the suite lacks) is listed with the unknown stated. Its definition of done covers `RULES.md` §22 items 1–3.

Phases 5–6, when they run:

### Phase N — Title
**Status:** PASS | ISSUES FOUND | TESTS WRITTEN

- `file/path.ext` — Description (test written / failing / issue found)

Summary: new test files created, new test cases written, tests passing YES / NO (with the command and its totals).
