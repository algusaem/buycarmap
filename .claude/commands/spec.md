---
description: Draft a spec before writing any code. Claude invokes this automatically — as the FIRST action — whenever a request would change observable behaviour ("add X", "build X", "I want users to be able to X", "X should also do Y"). Not for refactors, renames, dependency bumps, styling with no interaction change, or questions.
allowed-tools: Read, Grep, Glob, Bash(pnpm:*), Bash(npx:*), Bash(git:*), Edit, Write
---

You are writing a specification for `$ARGUMENTS` — the agreement about what the
software will do, written **before** it exists. Work through each phase in
order. Do NOT write implementation code. Do NOT write tests (that is
`/spec-tests`, run after the spec is approved).

Read `docs/specs/README.md` and `docs/specs/_template.md` first. The existing
`docs/specs/auth-email-and-oauth.md` is the quality bar for prose — dense,
rationale-first, no filler.

## Phase 0 — What a spec is, and what disqualifies one

A spec is a statement of **observable behaviour** and the **reasoning** behind
it. It is not a design doc, not a task list, and not a description of code.

**Reject your own draft if it contains:**

- **Implementation in the Problem section.** "We need a `Favorite` model" is not
  a problem. "A user loses every saved car when they close the tab" is.
- **Acceptance criteria that restate the UI.** "The button is amber" is a design
  decision, not a behaviour. "Toggling the control persists across a reload" is.
- **Criteria you cannot name a test for.** If you cannot say which file the test
  goes in and what it asserts, the criterion is too vague. Split it or cut it.
- **Only happy paths.** Every branch has a failure mode. A spec that lists none
  is incomplete, and the missing ones are exactly where the bugs will be.
- **Invented requirements.** If the user did not ask for it and the codebase
  does not imply it, it goes in Open questions, not Acceptance criteria.
- **Rationale that says what, not why.** "We use SHA-256 for tokens" is a fact
  already visible in the code. "SHA-256 rather than bcrypt because there is no
  dictionary to grind and a unique index makes redemption one indexed lookup" is
  a reason, and it is the only part that cannot be recovered by reading the
  source later.

## Phase 1 — Understand the request

Restate what was asked in one or two sentences. If the request is ambiguous in a
way that changes the acceptance criteria, ask now — a spec built on the wrong
reading wastes the whole cycle. Ambiguity that does not change the criteria:
pick the sensible reading and record it under Decisions.

## Phase 2 — Investigate before writing

Never draft from assumption. Establish, with tools:

1. **What already exists.** Grep for the models, hooks, actions, components and
   routes the feature would touch. State explicitly what is already built —
   `CLAUDE.md` is the map, but verify against the code; it can lag.
2. **What constrains it.** Existing conventions in `CLAUDE.md` (server actions
   over API routes, error codes not prose, `getCurrentUser()` for authorisation,
   i18n keys in both locales, no `any`). A criterion that violates one of these
   is wrong, not innovative.
3. **What it collides with.** Adjacent specs in `docs/specs/`, and any behaviour
   this would change. If it changes an existing spec's criteria, say so — that
   spec needs editing too.
4. **What the data layer needs.** Prisma schema changes, new env vars, upstream
   API shapes. These belong in section 5 and are the most expensive thing to get
   wrong.

   **Derive stored fields from the type they must reconstruct, do not list them
   from memory.** Open the interface (`CarListing`, etc.) and work through it
   field by field. The favorites spec listed the columns by hand and dropped
   `brand` and `model`, which the page needed to rebuild a listing — caught only
   when the code would not compile.

5. **What can actually be proved, and at which level.** Prisma is mocked in
   every Vitest test, so a `node` criterion whose truth depends on Postgres — a
   cascade delete, a unique constraint, real durability — is not verifiable
   there: writing it anyway produces a test that asserts Prisma was called with
   the right arguments while proving nothing.

   What *is* available is `pnpm test:e2e:db` (`E2E_DB=1`), which runs against a
   real branch database — `pnpm db:branch` supplies a disposable one, and global
   teardown removes the accounts it creates. So the choice is three-way, not two:
   scope the criterion to the boundary Vitest can observe, promote it to `e2e`
   and prove it end to end, or move it to §5 as a schema requirement.

   Reach for `e2e` only when Postgres is genuinely the thing under test. It is
   the slowest level, it does not run in CI (see `CLAUDE.md`), and a criterion
   parked there is a criterion the pull request does not check.

## Phase 3 — Draft

Copy `_template.md` to `docs/specs/<area>.md`. Pick a **Key** of 2–8 uppercase
letters, unique across every existing spec — check them all before choosing.
Status stays `Draft`.

Fill every section. An empty section is a signal you skipped work, not that the
section was unnecessary — except Open questions, where empty means ready.

For each acceptance criterion:

- Number it from the key: `KEY-1`, `KEY-2`, …
- Write one observable behaviour, in the present tense, from the outside.
- Choose the level deliberately: `unit` for pure logic, `node` for route
  handlers and server actions, `component` for jsdom rendering and interaction,
  `contract` for external API shape, `e2e` only for things that genuinely need a
  browser. Pushing work down a level is almost always right.
- Leave **Verified by** as `—`.

Cover, at minimum: the primary behaviour, every branch it has, one empty or
zero-result case, one invalid-input case, one upstream-or-dependency-failure
case, and the authorisation boundary if user data is involved.

## Phase 4 — Self-review

Before reporting, re-read your own draft and answer, out loud, in the report:

- Which criterion is weakest, and why did you keep it?
- What did you decide that the user did not ask about?
- What would a reader in a year not be able to work out from the code alone —
  is it written down in Decisions?

Then run `pnpm spec:check` to confirm the file parses and is correctly skipped
while `Draft`.

## Phase 5 — Report

State the file path, the key, the criterion count broken down by level, and the
open questions. Do not claim the spec is approved — that is the user's call, and
it is the gate that starts `/spec-tests`.
