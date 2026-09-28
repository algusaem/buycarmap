---
description: Review working changes for documentation — the governing docs from the ownership map updated in the same change, docs not restating specs, the ownership map claiming every source file
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Agent
---

Review the working changes for **documentation** — the project check that keeps `docs/` true. Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

**Owns:** `CLAUDE.md` › Documentation; the ownership map in `docs/README.md`. Where each document sits in the docs tree, ADRs, and `docs/ARCHITECTURE.md` (`docs/architecture.md` here) stay with `check-process` (`STACK.md` §6 "Docs"); the privacy docs with `check-security`.
**Applies to:** every change — a change with no source files (docs only) still has its links, anchors and ownership rows to check.

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
Run on its own, the main session does not review the documentation itself, however capable it is of doing so:
- **The whole review → one `Agent` with `subagent_type: "lacayo-opus"`**, told it is the delegated agent and spawns no agents, and briefed with this file, `.claude/review-protocol.md`, the change set, the task in the user's words and the approvals the user gave, quoted; it returns the output of review protocol §7.
- **The mastermind** re-measures with its own eyes only the facts it will state (a quoted `file:line`, the changed files: single read-only commands), and writes the report; which findings get fixed is the user's decision when the check runs on its own (review protocol §6). The fixes the user asks for are dictated edits: direct for two or three steps in one file, `lacayo-sonnet` for anything longer.
Inside `/check-all` this paragraph does not apply: there the agent running this file is already the delegated hand. Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 opus» did not follow this command.

## 1. Governing docs

- List the changed source files and map each one to its governing doc through the ownership map in `docs/README.md` (a colocated test inherits its subject's row). Name every governing doc in the output, with one line each: `updated`, `already accurate` (say what you compared), or `none needed (<reason>)`.
- A change to an upstream contract, an env var, a command, a Prisma model, a route or a bootstrap step whose governing doc still describes the old behaviour → BLOCKER. Quote the stale sentence.
- "None needed" is valid only for an internal refactor with no observable surface, a test-only change, styling that changes no interaction, or a dependency bump that changes no command. Any other "none needed" → ISSUE.
- A governing doc marked **—** (a declared gap) that this change needed → BLOCKER: the change writes the doc and replaces the **—** with it.

## 2. One home per fact

- A doc that restates what a spec in `docs/specs/` says, instead of linking to it → BLOCKER. The spec is the enforced copy.
- The same fact written in two docs that now disagree → BLOCKER, citing both.

## 3. The ownership map and links

- A new tracked source file (outside `app/generated/`) that no row of the ownership map claims → BLOCKER: `pnpm docs:check` fails on it.
- A row pointing at a doc that doesn't exist, or a glob that matches nothing → BLOCKER.
- A changed doc with a link or anchor that doesn't resolve, or a backticked source path that doesn't exist → BLOCKER. (`pnpm docs:check` finds these mechanically and is part of the project's verification — `pnpm check` from phase 3, the list in `CLAUDE.md` › Commands until then — which `check-verify` runs. Report what you see in the diff; don't run it.)
- A new doc not reachable by links from `docs/README.md` → BLOCKER.

## Definition of done

Shares `RULES.md` §22 item 13 with `check-process`: this check owns "the governing docs are updated"; `check-process` owns the tree and the ADRs.
