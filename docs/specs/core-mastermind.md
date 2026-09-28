# Mastermind delegation (migration phase 2)

Key: MASTER
Status: Implemented
Last updated: 2026-09-28

---

## Problem

The core's checks and the way work is done in core projects assume mastermind: the main session
(Opus 5.5, high effort) decides and reviews, and two user-level agents do the hands' work —
`lacayo-sonnet` executes what is already decided (edits, builds, tests, greps), `lacayo-opus`
audits. BuyCarMap's `CLAUDE.md` and commands don't say so, so the guard hook that stops
verification from running in the main session is off here, and nothing tells a command how to
split its work. This is phase 2 of `docs/decisions/0007-adopt-core-rules.md`.

In scope: the mastermind section of `CLAUDE.md` and a Delegation paragraph in every
`.claude/commands/*.md`, following the core's `mastermind.md`.

## Acceptance criteria

`unit` means a `*.node.test.ts` under `scripts/` that reads the working tree.

- [x] MASTER-1 · unit — `CLAUDE.md` has the mastermind delegation section: the main session decides, `lacayo-sonnet` executes what is decided, `lacayo-opus` audits, verification never runs in the main session, and every task closes with the «Lacayos: …» line
- [x] MASTER-2 · unit — Every `.claude/commands/*.md` carries a Delegation paragraph that names mastermind, or states in one line why the command runs whole in one read-only call
- [x] MASTER-3 · unit — No command or `CLAUDE.md` delegates in the conditional ("may go to", "might go to")
- [x] MASTER-4 · unit — No command or `CLAUDE.md` picks a lacayo by `model: "…"`; they are chosen by `subagent_type`
- [x] MASTER-5 · unit — Every command whose Delegation paragraph delegates ends its report with the «Lacayos: …» line

## Worked examples

None: no criterion here is on the critical list (a permission boundary, or a bug fix), and none carries an exact value.

## Data model

None: this feature adds or changes no table or column.

## Permissions

None: this phase changes `CLAUDE.md` and the command files only; it touches no user data and no
authorization in the app (see Out of scope).

## Edge cases

- MASTER-2 — a command that runs whole in one read-only call states why in one line instead of delegating.
- MASTER-3 — delegation written in the conditional is rejected.
- MASTER-4 — a lacayo picked by `model: "…"` is rejected.
- A command run on its own versus inside `/check-all`: see Decisions and rationale (the core checks get the paragraph too).

## Out of scope

The lacayo agents and the guard hook themselves: they are user-level, installed by the core's
`install.mjs`, and not part of this repository. Any change to the app.

## Decisions and rationale

**The core's wording, adapted only in its examples.** `mastermind.md` §3 and §4 give the text;
the examples are rewritten to what BuyCarMap does (the upstream proxies, the branch database), as
the procedure asks. Imperative, never conditional: "may go to an agent" is how the main session
ends up doing everything itself, which the control line then shows as «0 sonnet, 0 opus».

**The core checks get the paragraph too.** `/check-all` tells its agents to ignore a command's
Delegation paragraph, so adding one changes nothing inside `/check-all` and makes each check
delegate correctly when run on its own — the core README's step 2 for an adopting project. That
includes `/check-all` and `/check-pr`, which ADR 0007 had left out ("every other command"): they
delegate too, and a paragraph in every command keeps one rule for the tests.

**Where the commands differ from the core** — the one place this is recorded:

- every command that has a core copy carries a Delegation paragraph the core copy doesn't, and,
  where its frontmatter lists `allowed-tools` without the core's `Task`, `Agent` among them
  (`check-all`, `check-pr` and `check-tests` keep the core's `Task`);
- `check-all.md` also carries two project rows in its coverage map (`check-docs`, `check-sources`);
- `check-docs`, `check-sources`, `spec` and `spec-tests` have no core copy.

When a core file is pulled into the project, these differences are re-applied to it.

**A standalone review check leaves the fixes to the user.** The review protocol (§6) says fixing is
decided by the user when a check runs on its own; the paragraphs say so rather than handing that
decision to the main session.
