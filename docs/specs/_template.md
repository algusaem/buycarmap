# Spec: <feature name>

Key: <2–8 uppercase letters, unique across all specs — e.g. FAV, MAP, SRC>
Status: Draft
Last updated: <YYYY-MM-DD>

> Delete this block before committing.
>
> **Status drives enforcement.** `pnpm spec:check` ignores `Draft` and
> `Superseded` specs. The moment you set `Approved`, every acceptance criterion
> below must be named by at least one test title — which is the point: an
> approved spec and its initially-failing tests land together.
>
> **Key is permanent.** Acceptance criteria are `KEY-1`, `KEY-2`, … Append new
> ones, never renumber: the id is the handle test names point at, and
> renumbering silently rewires every reference.

---

## 1. Problem

What a user cannot do today, and why that matters. No solution here — if this
section describes an implementation, the spec is already skipping a step.

## 2. Scope

**In scope.** The behaviour this spec is responsible for.

**Out of scope.** Explicitly, so "while we're in there" has a written answer.
Name the adjacent things a reader will assume are included and say they are not.

## 3. Acceptance criteria

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
- Fill **Verified by** when the test is green. Format: `<file> › <test title>`.

| AC | Statement | Level | Verified by |
| --- | --- | --- | --- |
| KEY-1 | … | component | — |
| KEY-2 | … | node | — |

## 4. Decisions and rationale

Every non-obvious choice and the alternative it beat. Written as prose, not
bullets, when the reasoning has more than one step.

This is the section that outlives the rest: acceptance criteria get absorbed
into tests, but the reason a thing is built the strange way it is exists nowhere
else. If a decision seems obvious now, ask whether it will still seem obvious to
someone reading it in a year with a plausible-looking simplification in hand.

## 5. Data and contracts

Prisma models and migrations, external API request/response shapes, error codes,
new environment variables, cache keys. Anything another part of the system has
to agree with.

## 6. Open questions

Anything unresolved, with who or what would resolve it. An empty section is the
signal that this spec is ready to move to `Approved`.
