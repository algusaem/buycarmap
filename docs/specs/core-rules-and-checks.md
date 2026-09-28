# Core rules and checks (migration phase 1)

Key: RULESET
Status: Implemented
Last updated: 2026-09-28

---

## Problem

BuyCarMap predates the shared core (`algusaem-claude`). Its rules and its review commands are its
own, so every improvement made in the core — a new check, a sharper rule, a fixed review protocol —
has to be ported by hand. The owner decided to move the project fully onto the core, phase by
phase, each phase with its own spec approved before it starts. This is phase 1: the rules and the
checks.

The failure this spec exists to prevent is an adoption that looks done and is not: a check that
points at a file nobody committed, a legacy command still lying around to be run by mistake, a
project rule that lost its enforcer in the move, or a deviation with no end.

In scope:

- `RULES.md` and `STACK.md` at the root, imported by `CLAUDE.md`, which keeps only what is specific
  to BuyCarMap.
- The core review protocol and checks in `.claude/`, replacing the legacy `check.md`,
  `check-all.md`, `check-tests.md`, `check-claudemd.md` and `diff.md`; the project checks
  `check-docs` and `check-sources`.
- The adoption ADR, recording every place the code still deviates and the phase that removes it.
- Aligning with `RULES.md` the docs that restate process rules (`docs/README.md`,
  `docs/specs/README.md`, `docs/testing.md`, `docs/getting-started.md`, `docs/frontend.md`, the
  auth spec's TypeScript line), the `/spec` and `/spec-tests` commands, and the comments and output
  of `scripts/docs-check.mjs`.
- CI on Node 22: the latest pnpm 11 (11.28 when this was written), which CI installs, no longer
  starts on Node 20, so no workflow could pass. Pulled forward from phase 3 by the owner (2026-09-27); phase 3 still pins the exact version. pnpm 11 also
  replaced `onlyBuiltDependencies` with `allowBuilds`, so `pnpm-workspace.yaml` carries both. And the E2E job gains the
  `prisma generate` step the unit job already had: without it `next dev` cannot resolve the generated
  client and nearly every E2E test fails behind the error overlay.

## Acceptance criteria

Every test reads the working tree: `unit` here means a `*.node.test.ts` under `scripts/`, with no
network.

- [x] RULESET-1 · unit — `CLAUDE.md` imports `RULES.md` with an `@RULES.md` line and names `STACK.md` and the adoption ADR
- [x] RULESET-2 · unit — Every review — a `.claude/commands/check-*.md` other than `check-all` (the orchestrator), `check-verify` and `check-visual` (which run, not review), and `check-changelog` and `check-pr` (which write the PR text) — tells the reviewer to follow `.claude/review-protocol.md`
- [x] RULESET-3 · unit — `.claude/review-protocol.md`, `RULES.md` and `STACK.md` exist and are not ignored by git, so a fresh clone has them
- [x] RULESET-4 · unit — The legacy commands `check.md` and `check-claudemd.md` do not exist
- [x] RULESET-5 · unit — Every project check — a `check-*.md` that is not a core command — appears in the coverage map of `check-all.md`
- [x] RULESET-6 · unit — Every row of ADR 0007's "Accepted deviations" table names the rule it deviates from and a non-empty "Removed in"

## Worked examples

None: no criterion here is on the critical list (a permission boundary, or a bug fix), and none carries an exact value.

## Data model

None: this feature adds or changes no table or column. No Prisma, API or environment change.

## Permissions

None: this phase changes rules, commands and docs only; it changes nothing a user sees and no
data behaviour, so no authorization is involved (see Out of scope).

## Edge cases

- RULESET-3 — a required file ignored by git, so a fresh clone lacks it.
- RULESET-4 — a legacy command still present.
- RULESET-5 — a project check missing from the coverage map.
- RULESET-6 — a deviation row with an empty "Removed in".
- Commands that are not reviews: see Decisions › Which commands are reviews.

## Out of scope

- Mastermind in `CLAUDE.md` and in every command (phase 2) and the verification scripts and
  repository tooling (phase 3), each with its own spec. At this phase the core's `/check-all` and
  `/check-pr` were copied unchanged except the two project rows in `check-all.md`'s coverage map,
  and already delegated to the `lacayo-*` agents; phase 2 extended that to every command (the
  current differences from the core are listed in `docs/specs/core-mastermind.md` › Decisions and
  rationale).
- Any change to what a user sees or how data behaves: this phase changes none.
- Keeping `RULES.md`, `STACK.md` and the core checks byte-identical to the core. The core repo is
  not available to CI, so no test here can see it: they were compared by hand at adoption, and
  are on every later sync, keeping the project's own differences (`docs/specs/core-mastermind.md`
  › Decisions and rationale).

## Decisions and rationale

**A spec per phase.** The owner chose it: each phase's criteria are approved before the phase
starts. It also keeps `pnpm spec:check` honest — an approved spec's criteria must all have tests,
and a single migration spec would have forced this phase to carry the still-failing tests of every
later phase.

**Tests that read the repository.** The deliverables are files, and the way this phase fails is a
file missing from a clone or a rule with no enforcer — exactly what a test over the working tree
catches and a reviewer's memory does not. A first attempt at this phase left
`.claude/review-protocol.md` ignored by `.gitignore` until a reviewer caught it; RULESET-3 is the
test that would have.

**Two project checks.** The core has no review for the docs ownership map or for the upstream
sources, and both carry rules that fail silently. `check-docs` takes the old `/check-all`
documentation phase; `check-sources` takes the invariants the old `CLAUDE.md` listed about the
three marketplaces. Both follow the review protocol, so `/check-all` runs them with the core ones.

**Which commands are reviews.** The core defines five `check-*` commands that don't follow the
review protocol: `check-all` orchestrates, `check-verify` and `check-visual` run commands and take
screenshots, `check-changelog` and `check-pr` write the PR text. RULESET-2 names them; every other
check is a review.
