---
description: Draft the PR title (decided by /check-changelog) and the English description for the current branch, following the project's PR template. Run when opening the PR.
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Task
---

Write the pull request text for the current branch. Run it when the branch is ready for a PR — after one or more `/check-all` passes, each ending in a commit. **This command only writes text.** The code was already reviewed and verified by `/check-all`; don't review it again. Never push, never open the PR — hand the text to the user.

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
It does not measure the branch or check its own text:
- **Phase 1 → one `Agent` with `subagent_type: "lacayo-sonnet"`**, briefed with that phase's exact commands; outputs pasted verbatim. The `/check-all` reports step 4 needs come from the main session, which has them.
- **Phase 2 → one `Agent` with `subagent_type: "lacayo-opus"`**, a fresh reviewer with `check-changelog.md`, as Phase 2 below says, told it is the delegated agent and spawns no agents; it runs that whole file.
- **Phase 3 → the mastermind** writes the body, from the Sonnet outputs and the `/check-all` reports.
- **Phase 4 → one `Agent` with `subagent_type: "lacayo-opus"`** carrying the text and the branch; it returns every claim the diff does not back and every leak, and the mastermind applies the fixes before the user sees the text.
The mastermind decides on each Phase 4 finding and hands the final text to the user. Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 opus» did not follow this command.

## Phase 1 — Scope

1. **Base branch**: `git symbolic-ref --short refs/remotes/origin/HEAD` without the `origin/` prefix; without `origin/HEAD`, the base branch `CLAUDE.md` declares; else `main`, and say it was assumed. If the current branch *is* the base branch, stop: "no PR from the base branch".
2. **What the PR contains** — everything that will reach the base branch:
   - `git log --format='%h %s%n%b' <base>..HEAD` and `git diff --stat <base>...HEAD`, then `git diff <base>...HEAD`.
   - Uncommitted working changes (`git status`) are not in the PR: if there are any, say so in one line — they need `/check-all` and a commit first.
3. **Context**: the spec(s) in `docs/specs/` for the features touched, new ADRs in `docs/decisions/`, new migrations in `prisma/`, changes to `docs/privacy/` and `.env.example`.
4. **Results**: the `/check-all` reports for this branch's commits that are in this session — verification outputs, definition-of-done marks, manual checks, pending APPROVAL items. What isn't in this session isn't known: **never state a result you haven't seen** — write it as pending (CI runs it on the PR).

## Phase 2 — Title (`/check-changelog`)

With squash merge **the title is the commit that lands on the base branch** and the entry release-please writes in the changelog. Launch one `Agent` with `subagent_type: "lacayo-opus"` — a fresh reviewer — with `check-changelog.md`, the base branch, the task and the specs. Use its title verbatim, and put its `BREAKING CHANGE:` footer, if any, at the end of the body. If it reports a BLOCKER (a `CHANGELOG` edited by hand, a missing release-please config) or recommends splitting the branch, stop and show it to the user. Never change the type or the wording here — if the title seems wrong, say why and re-run it.

## Phase 3 — Write the body

Use `.github/pull_request_template.md` if it exists: its sections, in its order, and its checklist. Otherwise use the default below (it's what `STACK.md` §4 mandates for the template). Either way the body carries the reviewer summary `RULES.md` §22 item 15 requires — what changes and why, how it was verified, what couldn't be verified, decisions and open questions, manual actions; if the project's template lacks one of them, add it under the closest section.

### Body (default)

```md
## Description

<2–4 sentences of prose: what the PR does and why, for which role. Link the spec as `docs/specs/<feature>.md`. If the spec's "Out of scope" matters to a reviewer, say what the PR deliberately does not include.>

## Main changes

- **<Theme>**: <one sentence on what changed and why>.
  - `path/to/main-file.ts`
  - `path/to/other-file.ts`

## Impact

- **Routes and actions**: new or changed pages, queries, Server Actions, route handlers.
- **Database**: migrations, and which expand/contract step each one is; backfills.
- **Configuration**: new env vars (in the env schema and `.env.example`), new providers or dependencies.
- **Personal data**: new personal fields or processors, and the `docs/privacy/` updates.
- **Manual actions**: anything to do by hand before or after merging (env vars to set in Vercel, configuration in providers, QStash schedules, the later contract release of a migration).

## Tests

- <What is covered and at which level — unit, integration, E2E, accessibility. Mention the spec's worked examples when the tests use them.>

## Validation

- `pnpm check`: <result>
- `pnpm check:full` / E2E: <result locally, or "runs on the preview">
- Manual: <what was exercised by hand — responsive on mobile and desktop, keyboard use>
- Not verified: <what couldn't be verified and why, or "Nothing.">

## Decisions and open questions

- <Decision taken during the work that the reviewer should know, and why; where one needed approval, say it was approved.>
- <Question still open, or "None.">

## Checklist

- [ ] Tests written first, from the spec
- [ ] Unauthorized users rejected in tests (actions, route handlers, filtered queries)
- [ ] Docs updated (`docs/`), ADR for architectural decisions
- [ ] Migrations backward-compatible (expand/contract), seeds updated
- [ ] Personal data: inventory, export, deletion and Pino `redact` updated, retention defined
- [ ] New env vars in the env schema and `.env.example`
```

### Writing rules

- **English**, whatever the language of the commits or the spec.
- **Describe the deliverable, not the process**: no history of attempts, no "as discussed", no people's names, no AI attribution, no internal notes.
- **Group by theme, not by file.** List only the main files of each theme, as inline code. No relative links — GitHub resolves them against the PR URL and they 404.
- **Impact**: drop the lines that don't apply; if nothing applies, write "None." Always list migrations, new env vars, new dependencies and new route handlers when there are any.
- **Validation**: "Not verified" is never left out — the reviewer must know what nobody ran (`RULES.md` §3, §22).
- **Decisions and open questions**: the decisions a reviewer would otherwise have to reverse-engineer from the diff, and the questions still open (including APPROVAL items `/check-all` left pending). If there are none, write "None."
- **Checklist**: tick only what the diff proves; mark the rest `n/a` with the reason.
- No repetition between sections: what the Description says, Impact doesn't repeat.

## Phase 4 — Check the text against the branch

Fix the text, don't report — the user only receives the final version.

- **Text ↔ diff**: every bullet maps to something in the diff; every significant change in the diff is in the text. A bullet describing something that isn't in the branch is an error.
- **Leaks** — grep the text and `git log --format='%s%n%b' <base>..HEAD` for AI attribution (`co-authored`, `generated with`, `claude`, `anthropic`), internal notes, people's names, secrets, tokens, and preview URLs carrying bypass parameters. A leak in a commit message can't be fixed from here: say so in one line.

## Output

1. The title, in a code block.
2. The body, in a `markdown` code block, ready to paste.
3. One line from `/check-changelog`: in the changelog yes/no, section, expected version bump.
4. One line: base branch, number of commits and files included, uncommitted changes left out, and any leak found in the commit messages.
