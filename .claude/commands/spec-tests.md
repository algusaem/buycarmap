---
description: Turn an approved spec's acceptance criteria into failing tests. Claude invokes this automatically once the user approves a spec, before any implementation — never implement straight from a spec. Requires Status Approved.
allowed-tools: Read, Grep, Glob, Bash(pnpm:*), Bash(npx:*), Bash(git:*), Edit, Write
---

You are turning the acceptance criteria in `$ARGUMENTS` into tests that fail —
the step that makes the work test-driven rather than test-accompanied. Work
through each phase in order. **Do NOT write implementation code in this
command.** Leaving the tests red is the correct outcome.

## Phase 0 — Preconditions

Read the spec. Stop and report instead of proceeding if:

- Its Status is not `Approved`. `Draft` means it is not agreed yet; writing
  tests against it wastes both. `Implemented` means this already ran.
- The criteria table is empty, or any criterion has no level.
- A criterion is not testable as written. Do not paper over it with a vague
  assertion — say which one and why, and let the spec be fixed first.

Then read `.claude/commands/check-tests.md` **Phase 0** in full. Every rule
there applies here. The most relevant: no tautological assertions, no
self-fulfilling fixtures, no mocking the unit under test, hand-derive every
expected value.

## Phase 1 — Place each test

For each criterion, decide the file before writing anything, and record the
mapping in your report:

- `unit` → colocated `foo.test.ts` next to the source (jsdom project).
- `node` → colocated `foo.node.test.ts` — route handlers and server actions
  need real Node globals.
- `component` → colocated `Foo.test.tsx`, rendered with `renderWithI18n` from
  `test/utils/render.tsx` so English labels are queryable.
- `contract` → `test/contract/<source>.contract.test.ts`, a Zod schema of the
  *external* shape.
- `e2e` → `e2e/<area>.spec.ts`, with the sources stubbed via
  `e2e/fixtures/network.ts`.

If a criterion needs a file that does not exist yet, create the test file
anyway — it will import a module that does not exist, which is Phase 3's
problem, not a reason to skip.

Read the gotchas in `CLAUDE.md` → Testing → "Environment gotchas" before
writing. They are not optional trivia; each one cost a debugging session.

## Phase 2 — Write the tests

Title every test with its criterion id, exactly as the spec declares it:

```ts
it("FAV-3: removes a listing from favorites when the button is toggled off", async () => {
```

Rules:

- **One test per criterion, minimum.** More is fine; fewer means a criterion is
  unproven. Extra tests that cover no criterion are allowed but should make you
  ask whether the spec is missing something — if so, say so in the report rather
  than silently widening scope.
- **Network goes through MSW.** Add handlers to `test/msw/handlers.ts` or
  override per-test with `server.use(...)`. Never stub `global.fetch`.
- **Fixtures are builders** in `test/fixtures/*`, overriding only the fields the
  case is about. Add a builder if none fits; do not inline a 40-line object.
- **Assert behaviour, not markup.** A criterion about persistence is proven by
  reading the value back, not by a class name.

## Phase 3 — Prove each test fails for the right reason

This is the phase that makes the exercise worth anything, and the one that is
tempting to skip. Run the suite and read every failure.

A test that fails with `Cannot find module` or `x is not a function` proves
nothing about behaviour — it proves the code is absent, which you already knew.
For each such test, either:

- stub the module surface (types and signatures, throwing or returning empty) so
  the failure becomes an *assertion* failure about the behaviour, or
- state clearly in the report that this criterion is only structurally red and
  will not be meaningfully verified until implementation.

Never make a test pass in this phase.

## Phase 3b — Expect sibling fallout, and read it properly

Run the **whole** suite, not only the files you touched. A criterion that adds a
dependency to a widely-rendered component breaks every other test that renders
it: giving `CarListingCard` a session check broke seven `MapView` tests, because
`MapView` renders cards and its test supplied no session.

That is real breakage caused by a real change, and the fix is to give the
sibling test what the component now needs — never to weaken the new test or
paper over the component. If the fallout is large enough to feel wrong, that is
a signal the design is wrong, not that the tests are: say so rather than
mechanically patching twenty files.

## Phase 4 — Check the wiring

Run `pnpm spec:check`. Every criterion in the spec must now be named by a test
title, and no test may name a criterion the spec does not declare. Fix
mismatches by correcting the test title — never by editing the spec's ids, which
are append-only.

## Phase 5 — Report

Give a table: criterion id → test file → failure mode observed (assertion vs
structural). Then state the count of criteria left unproven and anything the
spec should have said but did not. End with the command to run the suite.
