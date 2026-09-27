# Spec: Core rules and checks (migration phase 1)

Key: RULESET
Status: Implemented
Last updated: 2026-09-27

---

## 1. Problem

BuyCarMap predates the shared core (`algusaem-claude`). Its rules and its review commands are its
own, so every improvement made in the core — a new check, a sharper rule, a fixed review protocol —
has to be ported by hand. The owner decided to move the project fully onto the core, phase by
phase, each phase with its own spec approved before it starts. This is phase 1: the rules and the
checks.

The failure this spec exists to prevent is an adoption that looks done and is not: a check that
points at a file nobody committed, a legacy command still lying around to be run by mistake, a
project rule that lost its enforcer in the move, or a deviation with no end.

## 2. Scope

**In scope.**

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
  starts on Node 20, so no workflow could pass. Pulled forward from phase 3 by the owner (2026-09-27); phase 3 still pins the exact version.

**Out of scope.**

- Mastermind in `CLAUDE.md` and in every command (phase 2) and the verification scripts and
  repository tooling (phase 3), each with its own spec. The core's `/check-all` and `/check-pr` —
  copied unchanged, except the two project rows in `check-all.md`'s coverage map — already delegate to the `lacayo-*` agents; phase 2 extends that to the
  rest.
- Any change to what a user sees or how data behaves: this phase changes none.
- Keeping `RULES.md`, `STACK.md` and the core checks byte-identical to the core. The core repo is
  not available to CI, so no test here can see it: they are compared by hand when the core's files
  are pulled — at adoption, and on every later sync.

## 3. Acceptance criteria

Every test reads the working tree: `unit` here means a `*.node.test.ts` under `scripts/`, with no
network.

| AC | Statement | Level | Verified by |
| --- | --- | --- | --- |
| RULESET-1 | `CLAUDE.md` imports `RULES.md` with an `@RULES.md` line and names `STACK.md` and the adoption ADR | unit | `scripts/core-rules-and-checks.node.test.ts` › RULESET-1 |
| RULESET-2 | Every review — a `.claude/commands/check-*.md` other than `check-all` (the orchestrator), `check-verify` and `check-visual` (which run, not review), and `check-changelog` and `check-pr` (which write the PR text) — tells the reviewer to follow `.claude/review-protocol.md` | unit | `scripts/core-rules-and-checks.node.test.ts` › RULESET-2 |
| RULESET-3 | `.claude/review-protocol.md`, `RULES.md` and `STACK.md` exist and are not ignored by git, so a fresh clone has them | unit | `scripts/core-rules-and-checks.node.test.ts` › RULESET-3 |
| RULESET-4 | The legacy commands `check.md` and `check-claudemd.md` do not exist | unit | `scripts/core-rules-and-checks.node.test.ts` › RULESET-4 |
| RULESET-5 | Every project check — a `check-*.md` that is not a core command — appears in the coverage map of `check-all.md` | unit | `scripts/core-rules-and-checks.node.test.ts` › RULESET-5 |
| RULESET-6 | Every row of ADR 0007's "Accepted deviations" table names the rule it deviates from and a non-empty "Removed in" | unit | `scripts/core-rules-and-checks.node.test.ts` › RULESET-6 |

## 4. Decisions and rationale

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

## 5. Data and contracts

No Prisma, API or environment change.

## 6. Open questions

None.
