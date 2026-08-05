# Specs

Every feature in BuyCarMap is described by a spec before it is built. A spec is
the agreement about *what* the software does; the tests are the proof it does
it; the code is an implementation detail that follows.

Adoption plan and current progress: [`../sdd-adoption-plan.md`](../sdd-adoption-plan.md).

## When a spec is required

**Required** for any change to observable behaviour: a new feature, a new data
source, a change to an existing flow, a new failure mode.

**Not required** for refactors that keep behaviour identical, dependency bumps,
styling that changes no interaction, or fixing a bug the spec already forbids —
that last one is a missing test, not a missing spec.

If in doubt: could a user notice the difference? Then it needs a spec entry.

## The workflow

Claude drives this loop; you are not expected to run the commands yourself.
Asking for a feature is what starts it, and the one thing it will stop and wait
for is your approval at step 2 — see the trigger table in `CLAUDE.md`.

1. **Write the spec** from [`_template.md`](_template.md). Status `Draft`. Get it
   reviewed on the acceptance criteria — those are the part that becomes code.
2. **Approve it.** Status `Approved`. Nothing is implemented yet.
3. **Write one failing test per criterion**, each titled with its id:

   ```ts
   it("FAV-3: removes a listing from favorites when the button is toggled off", async () => {
   ```

   Confirm each fails *for the right reason*. A test that fails on a missing
   import proves nothing about the behaviour it claims to cover.
4. **Implement** until green. Change a test only to fix an expectation that was
   wrong — never to make a failure go away.
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

The rule is **spec-on-change, audited**:

- Update the governing spec in the same change that alters behaviour.
  `/check-all` asks for this explicitly, and `pnpm spec:check` fails when a
  criterion loses its test.
- Periodically re-read `docs/specs/` against the code and fix what has drifted.
  A good trigger is finishing a feature that touched several areas.

The stricter alternative — every PR touching a spec'd area must show a spec diff
or justify its absence — was considered and rejected. It sounds disciplined and
gets routed around, and a rule people route around teaches them the whole
process is optional.

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

