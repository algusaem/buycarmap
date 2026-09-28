---
description: Review working changes for documentation — the governing docs from the ownership map updated in the same change, docs not restating specs, the ownership map claiming every source file
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*)
---

Review the working changes for **documentation** — the project check that keeps `docs/` true. Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

**Owns:** `CLAUDE.md` › Documentation; the ownership map in `docs/README.md`. Where each document sits in the docs tree, ADRs, and `docs/ARCHITECTURE.md` (`docs/architecture.md` here) stay with `check-process` (`STACK.md` §6 "Docs"); the privacy docs with `check-security`.
**Applies to:** every change — a change with no source files (docs only) still has its links, anchors and ownership rows to check.

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
