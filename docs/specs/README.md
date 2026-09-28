# Specs

Every feature in BuyCarMap is described by a spec before it is built. A spec is
the agreement about *what* the software does; the tests are the proof it does
it; the code is an implementation detail that follows.

How this process was adopted (complete; kept as a record): [`../sdd-adoption-plan.md`](../sdd-adoption-plan.md).

## When a spec is required

For every change (`RULES.md` §4): the change is covered by an up-to-date spec,
written and approved before its tests. A behaviour-preserving refactor is covered
by the spec that already governs the area; a bug fix adds a worked example to
its spec — the input that failed and the correct result (until the template gains
a Worked examples section, as a new criterion — see `CLAUDE.md` › Specs). A change no spec
covers stops and asks.

## The workflow

Claude drives this loop; you are not expected to run the commands yourself.
Asking for a feature is what starts it. It stops and waits for your approval at
step 2, and wherever `RULES.md` §1 says to ask — see the trigger table in `CLAUDE.md`.

1. **Write the spec** from [`_template.md`](_template.md). Status `Draft`. Get it
   reviewed on the acceptance criteria — those are the part that becomes code.
2. **Approve it.** Status `Approved`. Nothing is implemented yet.
3. **Write one failing test per criterion**, each titled with its id:

   ```ts
   it("FAV-3: removes a listing from favorites when the button is toggled off", async () => {
   ```

   Confirm each fails *for the right reason*. A test that fails on a missing
   import proves nothing about the behaviour it claims to cover.
4. **Implement** until green. An existing test changes only after a spec change
   (`RULES.md` §3, §4); a test that looks wrong is raised, never edited.
5. **Close the loop.** Fill in the "Verified by" column, set Status
   `Implemented`, run `/check-all`.

Changing behaviour later means editing the spec *first*, then step 3 onward.

## Enforcement

`pnpm spec:check` (in CI, next to `pnpm lint`) asserts that every acceptance
criterion in an `Approved` or `Implemented` spec is named by at least one test
title, and that no test references a criterion that no longer exists.

It proves an id is *mentioned*, not that the assertion behind it is meaningful.
The quality bar in `/check-tests` remains the real gate — spec-check only stops
criteria from being silently dropped.

Statuses:

| Status | Meaning | Enforced |
| --- | --- | --- |
| `Draft` | Being written or reviewed | No |
| `Approved` | Agreed, tests written, not yet implemented | Yes |
| `Implemented` | Built and green | Yes |
| `Superseded` | Replaced — link the replacement at the top | No |

Because `Approved` is enforced, an approved spec and its initially-failing tests
land in the same change. That is deliberate: it is what makes the tests come
first rather than being backfilled afterwards.

## Keeping specs true

The failure mode for this process is not skipping specs. It is specs that
quietly stop matching the code, because a spec nobody trusts is worse than no
spec — it is a confident wrong answer.

The rule is `RULES.md` §4 and §22 item 1: **every change is covered by an
up-to-date spec**.

- A change that alters behaviour updates the governing spec first, in the same
  change. `/check-all` (through `check-tests`) asks for it, and
  `pnpm spec:check` fails when a criterion loses its test.
- A change that keeps behaviour names the spec that already covers it; one no
  spec covers stops and asks.
- Periodically re-read `docs/specs/` against the code and fix what has drifted.
  A good trigger is finishing a feature that touched several areas.

Two things this deliberately does not do: version specs, and require sign-off.
Git history already records what changed and when, and a second approver on a
solo project is ceremony.

## Index

| Spec | Key | Status | Area |
| --- | --- | --- | --- |
| [data-sources.md](data-sources.md) | SRC | Implemented | Three source integrations, proxy routes, contracts |
| [map-and-search.md](map-and-search.md) | MAP | Implemented | Search lifecycle, filters, listings, map |
| [favorites.md](favorites.md) | FAV | Implemented | Saving listings, favorites page |
| [cross-cutting.md](cross-cutting.md) | CORE | Implemented | Language, geography, theme |
| [auth-email-and-oauth.md](auth-email-and-oauth.md) | AUTH | Implemented | Auth, email, OAuth, 2FA |
| [alerts.md](alerts.md) | ALERT | Implemented | Saved criteria, background polling, match emails |
| [navbar.md](navbar.md) | NAV | Implemented | Navigation bar, mobile menu, account menu |
| [core-rules-and-checks.md](core-rules-and-checks.md) | RULESET | Implemented | Migration phase 1: the core rules and checks |
| [core-mastermind.md](core-mastermind.md) | MASTER | Implemented | Migration phase 2: mastermind delegation |

