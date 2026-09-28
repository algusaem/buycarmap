# <Feature>

Key: <2–8 uppercase letters, unique across all specs — e.g. FAV, MAP, SRC>
Status: Draft
Last updated: <YYYY-MM-DD>

> Delete this block before committing.
>
> **Status drives enforcement.** `pnpm spec:check` ignores `Draft` and
> `Superseded` specs. The moment you set `Approved`, every acceptance criterion
> below must be named by at least one test title — which is the point: an
> approved spec and its initially-failing tests land together. `Implemented`
> additionally requires every criterion's box to be ticked.
>
> **Key is permanent.** Acceptance criteria are `KEY-1`, `KEY-2`, … Append new
> ones, never renumber: the id is the handle test names point at, and
> renumbering silently rewires every reference. Ticking a box never changes the
> id or the statement.

---

## Problem

What a user cannot do today, and why that matters. No solution here — if this
section describes an implementation, the spec is already skipping a step.

End with a paragraph beginning "In scope:" naming the behaviour this spec is
responsible for.

## Acceptance criteria

Rules:

- One observable behaviour each. If you cannot name the test that would fail,
  the criterion is too vague to be useful.
- Include the negative paths: invalid input, empty result, upstream failure,
  unauthorised caller. This is where the bugs are, and a spec written from the
  happy path always forgets them.
- Pick the level deliberately — deciding here is what stops everything drifting
  into slow e2e. `unit` (pure lib) · `node` (route handlers, server actions) ·
  `component` (jsdom + Testing Library) · `contract` (external API shape) ·
  `e2e` (Playwright).
- One checklist item per criterion: the id first, then the level, then the
  statement. Leave the box empty; tick it (`- [x]`) once the criterion's test is
  green. `Implemented` requires every box ticked.
- When a criterion is proven at more than one level, join them with ` + `
  (`node + e2e`).

- [ ] KEY-1 · component — …
- [ ] KEY-2 · node — …

## Worked examples

Exact inputs and exact results, each naming the criterion id it illustrates.
Mandatory for the critical list — permission boundaries and bug fixes
(`RULES.md` §4, `STACK.md` §15–16): a bug fix adds the input that failed and the
correct result. The values come from the user or are confirmed by them; never
invent one. If no criterion is on the critical list and none carries an exact
value, say so in one sentence.

## Data model

Prisma models, columns, indexes, constraints and migrations this feature adds or
changes. If it changes none, say so in one sentence and name the models it
reads.

## Permissions

Who may do what to which records, citing the criterion ids that prove it. If the
feature touches no user data and no authorization, say so in one sentence and
why.

## Edge cases

Concurrency, empty states, limits, invalid input, upstream failure,
unauthenticated callers — one line each, by criterion id. Point to Decisions and
rationale for the ones discussed there instead of restating them.

## Out of scope

Explicitly, so "while we're in there" has a written answer. Name the adjacent
things a reader will assume are included and say they are not.

## Contracts

Optional. External API request/response shapes, route handler and server action
shapes, error codes, new environment variables, cache keys, i18n keys. Anything
another part of the system has to agree with that is not a table or a column.
Omit the section when there is none.

## Decisions and rationale

Optional. Every non-obvious choice and the alternative it beat. Written as
prose, not bullets, when the reasoning has more than one step.

This is the section that outlives the rest: acceptance criteria get absorbed
into tests, but the reason a thing is built the strange way it is exists nowhere
else. If a decision seems obvious now, ask whether it will still seem obvious to
someone reading it in a year with a plausible-looking simplification in hand.

## Open questions

Optional. Anything unresolved, with who or what would resolve it. Empty means
the spec is ready to move to `Approved`, so omit the section then.
