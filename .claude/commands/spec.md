---
description: Draft a spec before writing any code. Claude invokes this automatically — as the FIRST action — whenever a request would change observable behaviour ("add X", "build X", "I want users to be able to X", "X should also do Y"). For a change that keeps behaviour but that no existing spec covers, ask the user first, then draft. Not for questions.
allowed-tools: Read, Grep, Glob, Bash(pnpm:*), Bash(npx:*), Bash(git:*), Edit, Write, Agent
---

You are writing a specification for `$ARGUMENTS` — the agreement about what the
software will do, written **before** it exists. Work through each phase in
order. Do NOT write implementation code. Do NOT write tests (that is
`/spec-tests`, run after the spec is approved).

Read the Documentation section of `README.md` (`README.md#documentation`) and
`docs/specs/_template.md` first. The existing
`docs/specs/auth-email-and-oauth.md` is the quality bar for prose — dense,
rationale-first, no filler.

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
The mastermind writes the spec — it is a decision — but it doesn't investigate by itself:
- **Phase 2 → one `Agent` with `subagent_type: "lacayo-opus"`** briefed with the request and the five questions of Phase 2 (what exists, what constrains it, what it collides with, what the data layer needs, what can be proved at which level); it returns the facts with `file:line` evidence. Pure greps and file listings go to `lacayo-sonnet` instead.
- **Phases 1, 3, 4 and 5 → the mastermind**: the questions to the user, the draft, the self-review and the report. It re-measures the facts it writes into the spec with single read-only commands.
- **`pnpm spec:check` → `lacayo-sonnet`**, output pasted verbatim.
Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 opus» did not follow this command.

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
  does not imply it, it goes in the optional Open questions section, not
  Acceptance criteria.
- **Invented expected values.** A critical-path criterion or a bug fix carries
  exact values the user gave or confirmed (`RULES.md` §4); missing ones are
  asked for, never made up.
- **Rationale that says what, not why.** "We use SHA-256 for tokens" is a fact
  already visible in the code. "SHA-256 rather than bcrypt because there is no
  dictionary to grind and a unique index makes redemption one indexed lookup" is
  a reason, and it is the only part that cannot be recovered by reading the
  source later.

## Phase 1 — Understand the request

Restate what was asked in one or two sentences. If the request is ambiguous, ask now
(`RULES.md` §1: never assume) — a spec built on the wrong reading wastes the
whole cycle.

## Phase 2 — Investigate before writing

Never draft from assumption. Establish, with tools:

1. **What already exists.** Grep for the models, hooks, actions, components and
   routes the feature would touch. State explicitly what is already built —
   `CLAUDE.md` is the map, but verify against the code; it can lag.
2. **What constrains it.** Existing conventions in `CLAUDE.md`, `RULES.md` and `STACK.md` (server actions
   over API routes, error codes not prose, `getCurrentUser()` for authorisation,
   i18n keys in both locales, no `any`). A criterion that violates one of these
   is wrong, not innovative.
3. **What it collides with.** Adjacent specs in `docs/specs/`, and any behaviour
   this would change. If it changes an existing spec's criteria, say so — that
   spec needs editing too.
4. **What the data layer needs.** Prisma schema changes, new env vars, upstream
   API shapes. These belong in Data model (tables and columns) and Contracts
   (everything else) and are the most expensive thing to get wrong.

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
   and prove it end to end, or move it to Data model as a schema requirement.

   Reach for `e2e` only when Postgres is genuinely the thing under test. It is
   the slowest level, it does not run in CI (see `CLAUDE.md`), and a criterion
   parked there is a criterion the pull request does not check.

## Phase 3 — Draft

Copy `_template.md` to `docs/specs/<area>.md`. Pick a **Key** of 2–8 uppercase
letters, unique across every existing spec — check them all before choosing.
Keep the `Key:`, `Status:` and `Last updated:` lines; Status stays `Draft`.

Fill every fixed section — Problem, Acceptance criteria, Worked examples, Data
model, Permissions, Edge cases, Out of scope — in that order. An empty section
is a signal you skipped work, not that the section was unnecessary. The optional
sections — Contracts, Decisions and rationale, Open questions — follow them in
that order, only when they have content; an absent Open questions section means
the spec is ready.

For each acceptance criterion, write one checklist item,
`- [ ] KEY-n · <level> — <statement>`, for example:

- [ ] KEY-1 · node — …

- Number it from the key: `KEY-1`, `KEY-2`, …
- Write one observable behaviour, in the present tense, from the outside.
- Choose the level deliberately: `unit` for pure logic, `node` for route
  handlers and server actions, `component` for jsdom rendering and interaction,
  `contract` for external API shape, `e2e` only for things that genuinely need a
  browser. Pushing work down a level is almost always right. When a criterion is
  proven at more than one level, join them with ` + ` (`node + e2e`).
- Leave the box empty. It is ticked once the criterion's test is green, after
  implementation, not while drafting.

Then fill:

- **Worked examples** — exact inputs and results for every criterion on the
  critical list (permission boundaries and bug fixes; `RULES.md` §4). The values
  come from the user; ask for any that are missing, never invent them.
- **Permissions** — who may do what to which records, citing criterion ids.
- **Edge cases** — the negative-path and limit criteria, by id.
- **Out of scope** — the adjacent things a reader will assume are included.

Cover, at minimum: the primary behaviour, every branch it has, one empty or
zero-result case, one invalid-input case, one upstream-or-dependency-failure
case, and the authorisation boundary if user data is involved.

## Phase 4 — Self-review

Before reporting, re-read your own draft and answer, out loud, in the report:

- Which criterion is weakest, and why did you keep it?
- What did you decide that the user did not ask about?
- What would a reader in a year not be able to work out from the code alone —
  is it written down in Decisions and rationale?

Then run `pnpm spec:check` to confirm the file parses, every checklist item
carries a level, and the spec is correctly skipped while `Draft`.

## Phase 5 — Report

State the file path, the key, the criterion count broken down by level, the
worked examples still waiting on values from the user, and the open questions.
Do not claim the spec is approved — that is the user's call, and
it is the gate that starts `/spec-tests`.
