# Spec: Mastermind delegation (migration phase 2)

Key: MASTER
Status: Approved
Last updated: 2026-09-27

---

## 1. Problem

The core's checks and the way work is done in core projects assume mastermind: the main session
(Opus 5.5, high effort) decides and reviews, and two user-level agents do the hands' work —
`lacayo-sonnet` executes what is already decided (edits, builds, tests, greps), `lacayo-opus`
audits. BuyCarMap's `CLAUDE.md` and commands don't say so, so the guard hook that stops
verification from running in the main session is off here, and nothing tells a command how to
split its work. This is phase 2 of `docs/decisions/0007-adopt-core-rules.md`.

## 2. Scope

**In scope.** The mastermind section of `CLAUDE.md` and a Delegation paragraph in every
`.claude/commands/*.md`, following the core's `mastermind.md`.

**Out of scope.** The lacayo agents and the guard hook themselves: they are user-level, installed
by the core's `install.mjs`, and not part of this repository. Any change to the app.

## 3. Acceptance criteria

`unit` means a `*.node.test.ts` under `scripts/` that reads the working tree.

| AC | Statement | Level | Verified by |
| --- | --- | --- | --- |
| MASTER-1 | `CLAUDE.md` has the mastermind delegation section: the main session decides, `lacayo-sonnet` executes what is decided, `lacayo-opus` audits, verification never runs in the main session, and every task closes with the «Lacayos: …» line | unit | — |
| MASTER-2 | Every `.claude/commands/*.md` carries a Delegation paragraph that names mastermind, or states in one line why the command runs whole in one read-only call | unit | — |
| MASTER-3 | No command or `CLAUDE.md` delegates in the conditional ("may go to", "might go to") | unit | — |
| MASTER-4 | No command or `CLAUDE.md` picks a lacayo by `model: "…"`; they are chosen by `subagent_type` | unit | — |
| MASTER-5 | Every command whose Delegation paragraph delegates ends its report with the «Lacayos: …» line | unit | — |

## 4. Decisions and rationale

**The core's wording, adapted only in its examples.** `mastermind.md` §3 and §4 give the text;
the examples are rewritten to what BuyCarMap does (the upstream proxies, the branch database), as
the procedure asks. Imperative, never conditional: "may go to an agent" is how the main session
ends up doing everything itself, which the control line then shows as «0 sonnet, 0 opus».

**The core checks get the paragraph too.** `/check-all` tells its agents to ignore a command's
Delegation paragraph, so adding one changes nothing inside `/check-all` and makes each check
delegate correctly when run on its own — the core README's step 2 for an adopting project.

## 5. Data and contracts

None.

## 6. Open questions

None.
