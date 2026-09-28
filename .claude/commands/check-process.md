---
description: Review working changes for process rules — stop-and-ask approvals, escape hatches, branch, scope against the spec, repo tooling, docs and ADRs, CHANGELOG, TODOs
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Agent
---

Review the working changes for the **process** rules. Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

**Owns:** `RULES.md` §1 (every APPROVAL), §3 (escape hatches, skipping hooks, editing the `CHANGELOG`; pushing to `main` is left to branch protection), §4 (scope against the spec), §21 (branch); `STACK.md` §2 (backup docs), §4, §6 "Docs", §15 "Out of scope"; `TODO`s without an issue.
**Applies to:** every change.

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
Run on its own, the main session does not review the process rules itself, however capable it is of doing so:
- **The whole review → one `Agent` with `subagent_type: "lacayo-opus"`**, told it is the delegated agent and spawns no agents, and briefed with this file, `.claude/review-protocol.md`, the change set, the task in the user's words and the approvals the user gave, quoted; it returns the output of review protocol §7.
- **The mastermind** re-measures with its own eyes only the facts it will state (a quoted `file:line`, the changed files: single read-only commands), and writes the report; which findings get fixed is the user's decision when the check runs on its own (review protocol §6). The fixes the user asks for are dictated edits: direct for two or three steps in one file, `lacayo-sonnet` for anything longer.
Inside `/check-all` this paragraph does not apply: there the agent running this file is already the delegated hand. Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 opus» did not follow this command.

## 0. Adoption

The project doesn't have `RULES.md` / `STACK.md`, or its `CLAUDE.md` doesn't reference them → one NOTE: "the project hasn't adopted the core rules" (the only check that reports it). If an adoption ADR exists, cite it.

## 1. Branch

The base branch: `git symbolic-ref --short refs/remotes/origin/HEAD` without the `origin/` prefix; without `origin/HEAD`, the base branch `CLAUDE.md` declares; else `main`, and say it was assumed. `git branch --show-current` — on `main` or the base branch → BLOCKER: create a task branch before committing (`RULES.md` §21). If the change set is already a commit on the base branch, it's still a BLOCKER, but the fix is the user's (history is never rewritten from here). How a commit reached the remote isn't visible in a diff: pushing straight to `main` is enforced by branch protection, not by this check.

## 2. Stop-and-ask sweep (`RULES.md` §1)

Go through every trigger in `RULES.md` §1 against the diff and list each hit as APPROVAL, citing the file — or accept it citing where the approval is recorded. At minimum:

- New dependency with no library for that purpose in the stack files.
- New theme colour, token or visual pattern (`globals.css` theme changed, a style not in the existing patterns).
- Destructive or backward-incompatible migration.
- Changes to authentication, authorization (`permissions.ts`, abilities), roles or permissions, security headers (`proxy.ts`, `next.config`), rate limiting.
- New personal data stored, retention undefined, or personal data sent to a service that didn't receive it.
- Changes to CI (`.github/`), Husky hooks, `biome.json`, `tsconfig*.json`, `vercel.json`, Vitest or Playwright config, coverage thresholds or exclusions, `package.json` scripts, `.impeccable/config.json` or the Impeccable design hook in `.claude/settings.json`.
- Raw SQL (`$queryRaw`, `$executeRaw`, `Prisma.sql`).
- Files outside the task's scope — judged from the task described in the brief; run on its own, from the spec, and say which you used.
- Business decisions the spec doesn't cover (flows, prices, permissions, customer data, scope) — code that settles something the spec leaves open.

## 3. Escape hatches (`RULES.md` §3)

Grep the changed lines for `@ts-ignore`, `@ts-expect-error`, `biome-ignore`, `impeccable-disable` (also `-line` and `-next-line`) and the non-null operator (`!` after an expression: `foo!.bar`, `foo!)`, `foo!;`), and `.impeccable/config.json` for new entries in `detector.ignoreValues` or `detector.ignoreFiles`. Each one needs a justification — a comment next to it; for Impeccable, the text after the rule in the comment or the ignore's reason — without it → BLOCKER — and prior approval → APPROVAL. (`any` and `as unknown as` are banned outright; `check-good-practices` owns them.)

## 4. Scope against the spec (`RULES.md` §4, `STACK.md` §15)

- The change implements the spec's acceptance criteria — criteria left unimplemented are listed as NOTE unless the task said so.
- Nothing listed under "Out of scope", and no unrequested feature → ISSUE.

## 5. Git hygiene

- `CHANGELOG.md` edited by hand → BLOCKER (release-please owns it).
- `--no-verify`, or any other flag or variable that skips the hooks (`HUSKY=0`), in a script, a config or a doc → BLOCKER. (A hook's own config weakened is `check-tests`' guardrail tampering.)
- Generated files or build output in the change set → BLOCKER.
- `TODO` without an issue reference → BLOCKER.
- Repo tooling from `STACK.md` §4 removed or weakened in the diff — PR template, `CODEOWNERS`, Renovate or Dependabot config, the PR-title check (`amannn/action-semantic-pull-request`), gitleaks in CI, release-please config → BLOCKER. (Branch protection and squash-only are repository settings a diff can't show.)

## 6. Docs (`STACK.md` §6 "Docs")

- Doc paths map like source paths (review protocol §1.2): a project's `docs/operations.md` stands for `docs/operations/`, `docs/architecture.md` for `docs/ARCHITECTURE.md`.
- Every document sits where the docs tree puts it — a doc elsewhere, or a new kind of doc with no place in the tree → ISSUE.
- An architectural decision or a stack deviation has a new ADR (a dependency outside the stack is `check-stack`'s); an accepted ADR edited instead of superseded → BLOCKER.
- `docs/ARCHITECTURE.md` (or the project's existing equivalent, e.g. `docs/architecture.md`) updated if the architecture, environments or main flows changed.
- Changes to deletion, backups (Neon point-in-time restore, retention window) or staging anonymization reflected in `docs/privacy/deletion.md` / `docs/operations/` (`STACK.md` §2). (The data inventory and processor register belong to `check-security`.)

## Definition of done

Owns `RULES.md` §22 item 13 (docs and ADR), and item 7 for `TODO`s.
