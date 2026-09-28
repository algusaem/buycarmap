---
description: Run every check on the working changes in fresh subagents — process, stack, data, security, ERP, front, design (Impeccable), good practices, correctness, tests, verification, screenshots of UI changes — and draft the commit message
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Edit, Write, Task
---

The pre-commit pass. The usual flow is: plan the work → develop it → **`/check-all` on the uncommitted changes** → commit with the message it drafts → when the branch is ready, `/check-pr` for the PR text. This command runs every check over everything the working changes touch and ends with the commit message; it doesn't write the PR text.

**The main session only orchestrates (mastermind).** Every review runs in a fresh subagent that did not write the code: it starts without this conversation, reads its command file and the code on disk, and judges what is there — not what the session remembers writing. The main session writes the briefs, decides the fixes, asks the user what `RULES.md` §1 says to ask, and writes the final report. **Nobody approves their own work**: a reviewer never fixes, and after every round of fixes *new* reviewers are launched — never resumed ones.

The hands are the user-level agents `lacayo-opus` (Opus 5.5, medium effort) and `lacayo-sonnet` (Sonnet 5, high effort), installed by `node install.mjs` from `algusaem-claude`.

## The checks

Core checks — every project has them; `check-erp` only runs in CRM/ERP projects:

| Check | Reviews | Definition of done items (`RULES.md` §22) |
|---|---|---|
| `check-process` | adoption, approvals (§1), escape hatches, branch, scope against the spec, repo tooling, docs and ADRs, `CHANGELOG`, `TODO`s | 7 (`TODO`s), 13 |
| `check-stack` | dependencies, structure and boundaries, Next.js data flow, env vars, errors and logging, integrations | 7 (`console.log`), 12 |
| `check-data` | Prisma access, N+1, transactions, data model, migrations, seeds | 10 |
| `check-security` | auth and authorization, input validation, secrets, personal data, logs content, rate limiting, headers and CSP, caching, environments | 11 |
| `check-erp` | all of `STACK-ERP.md` | — |
| `check-front` | route and list states, theme, Motion, forms, feedback, i18n, accessibility and interface guidelines, manual checks | 5 (the flow to capture, the manual checks), 8 |
| `check-impeccable` | slop in the UI and its copy, each with its replacement; design direction against `PRODUCT.md`, `DESIGN.md` and the page briefs; existing visual patterns; Impeccable setup; copy clarity and design critique | — |
| `check-good-practices` | reuse, clean code, TypeScript, React, the project's `CLAUDE.md` rules | 7 (dead code) |
| `check-correctness` | logic defects: races and out-of-order responses, termination, error paths, edge cases, state consistency — the code against its spec | — |
| `check-tests` | spec and TDD, missing and weak tests, test and guardrail tampering; then writes and runs tests | 1, 2, 3 |
| `check-verify` | runs `pnpm check`, `pnpm check:full`, gitleaks | 4 |
| `check-visual` | Playwright screenshots of the result and every step of the new flow, mobile and desktop, for the user to confirm | 5 (screenshots) |

Item 5 is met only when the user confirms the screenshots of a UI change. Items 6 (CI green), 14 and 15 (PR title and description) can't be met before the commit: they are pending until CI and `/check-pr`. Item 9 (nothing in `RULES.md` §3 broken) is met when no check reports a §3 BLOCKER.

**Project checks**: any other `check-*.md` in the project's commands directory — except `check-all`, `check-changelog`, `check-pr` and the core checks above — is a project-specific review and runs alongside the core ones. It follows `.claude/review-protocol.md` and declares what it owns; the `CLAUDE.md` sections it claims leave `check-good-practices`. A `check-*.md` that doesn't reference `.claude/review-protocol.md` (a command left over from before this system, like an old `check.md` or `check-claudemd.md`) is not run: list it in the output as "not a review — remove or migrate it".

### Coverage map

Every rule has exactly one owner, so no finding is reported twice and no rule goes unchecked. The review protocol points reviewers here.

| Rules | Owner |
|---|---|
| `RULES.md` §1 stop and ask (every APPROVAL) | `check-process` |
| `RULES.md` §2 when stuck | `/check-all` (the fix loop) |
| `RULES.md` §3 prohibited | tests, verification weakening, real data in fixtures → `check-tests`; `any`, `as unknown as` → `check-good-practices`; escape hatches, skipping hooks, `CHANGELOG` → `check-process` (pushing to `main`: branch protection); applied migrations, real data in seeds → `check-data`; `console.log` → `check-stack`; roles checked by hand → `check-security`; claiming without running → `check-verify` |
| `RULES.md` §4 methodology | spec, worked examples, TDD → `check-tests`; scope against the spec → `check-process` |
| `RULES.md` §5 dependencies | `check-stack` |
| `RULES.md` §6 code | security, secrets in the diff → `check-security`; the rest → `check-good-practices` |
| `RULES.md` §7 TypeScript, §8 React | `check-good-practices` |
| `RULES.md` §9 Next.js | input validation and auth in actions/handlers → `check-security`; route states → `check-front`; the rest → `check-stack` |
| `RULES.md` §10 authorization | the permission logic → `check-security`; the tests it requires → `check-tests` |
| `RULES.md` §11 data | `check-data` |
| `RULES.md` §12 personal data | `check-security` |
| `RULES.md` §13 forms | `check-front` |
| `RULES.md` §14 env vars | `check-stack` |
| `RULES.md` §15 errors and logging | what reaches logs and Sentry → `check-security`; messages to the user → `check-front`; the rest → `check-stack` |
| `RULES.md` §16 rate limiting | `check-security` |
| `RULES.md` §17–§19 UI, accessibility, interface guidelines | `check-front` (keeping the existing visual patterns → `check-impeccable`) |
| `RULES.md` §20 testing | `check-tests` |
| `RULES.md` §21 git | branch → `check-process`; commit messages → `/diff`; PR title → `/check-changelog` (in `/check-pr`) |
| `TODO` without an issue (§22 item 7) | `check-process` |
| `RULES.md` §22 definition of done | `/check-all`, from the items each check owns |
| `RULES.md` §22 item 5, screenshots of UI changes | `check-visual` (the flow to capture comes from `check-front`; the user confirms) |
| `STACK.md` §0, §15, §16 specs and tests; §5 guardrail config and CI workflows | `check-tests` (§15 "Out of scope" → `check-process`) |
| `STACK.md` §1, §6 (structure), §8, §13 | `check-stack` (webhook verification and API keys → `check-security`) |
| `STACK.md` §17 Impeccable | `check-impeccable` (waivers → `check-process`; detector config and hook weakened → `check-tests`; the detector run, inside `pnpm check` → `check-verify`) |
| `STACK.md` §2 environments | health checks, Postgres version parity → `check-stack`; environment isolation, EU regions → `check-security`; backup docs → `check-process` |
| `STACK.md` §3, §9 | `check-data` |
| `STACK.md` §4 git and repo tooling, §6 "Docs" | `check-process` (release-please is checked again at PR time by `/check-changelog`) |
| `STACK.md` §5 commands | `check-verify` |
| `STACK.md` §7 types | `check-good-practices` |
| `STACK.md` §10, §11, §12 | `check-security` (§11 env validation at startup → `check-stack`) |
| `STACK.md` §14 UI | `check-front` (what the UI text says → `check-impeccable`) |
| UI copy: slop, clarity, voice | `check-impeccable` (technical details in messages to the user → `check-front`) |
| `STACK-ERP.md` | `check-erp` (§1 dependencies → `check-stack`; golden files updated to pass → `check-tests`); in ERP projects the tenant parts of auth and caching are `check-erp`'s, the base chain stays with `check-security` |
| project `CLAUDE.md` (its own text, not the imported `RULES.md`) | the check whose domain each rule covers (review protocol §2); `check-good-practices` takes the rest, unless a project check claims the section |
| Behaviour against the spec: logic defects not tied to a rule | `check-correctness` (a defect that also breaks another check's rule is merged by root cause) |
| project `CLAUDE.md` › Documentation; the ownership map in `docs/README.md` | `check-docs` (project check; the docs tree and ADRs stay with `check-process`) |
| project `CLAUDE.md` › Upstream sources | `check-sources` (project check) |

## Who runs what

| Step | Who | Why |
|---|---|---|
| Project shape, branch, changed files, locating the checks (Phase 0) | main session, direct read-only commands | measuring one fact at a time, no chain |
| Every review check, and `check-tests` Phases 0–4 | one `lacayo-opus` each | audit against the rules: judgement |
| `check-verify` | `lacayo-sonnet` | exact commands, outputs verbatim |
| `check-visual`: screenshots of the flow `check-front` listed | `lacayo-sonnet` | executing a decided flow; the main session shows the images to the user |
| `check-tests` Phases 0, 5 and 6: the quality bar, writing the approved cases, running them | `lacayo-sonnet` | cases and expected values already decided |
| Deciding each fix, asking the user | main session | decisions |
| Applying fixes | main session for a two- or three-step edit in one file; `lacayo-sonnet` for anything longer, as dictated edits | execution of what is decided |
| `/diff` | `lacayo-sonnet` | text from the diff with a fixed format |
| Final report | main session | |

The main session never runs verifications (build, lint, typecheck, tests, E2E) and never re-runs them to double-check: it uses the outputs `lacayo-sonnet` pastes. It re-measures only the facts it states itself (a `git status`, a quoted `file:line`) with single read-only commands. It doesn't review the code in place of the reviewers; when it disagrees with a finding, it says why in the report instead of dropping it silently.

## Briefs

A subagent sees none of this conversation. Every brief carries:

1. **The command file** to apply, by path — subproject-local (`<subproject>/.claude/commands/<name>.md`) if it exists, else the root one — plus `.claude/review-protocol.md` for reviews, and which phases apply. If a command file has a "Delegation" paragraph, it does not apply: *"you are the delegated agent; do not spawn agents."*
2. **Where**: the subproject directory and the change set — its changed, staged and untracked files (review protocol §1).
3. **The task**: what was asked, in the user's words, and its scope — reviewers need it to judge "only what was asked" and "files outside the task".
4. **The spec(s)** in `docs/specs/` for the features touched.
5. **The approvals** the user gave in this session, quoted, each with what it covers — so they aren't re-flagged. Only approvals the user actually gave.
6. **Nothing else from the conversation**: not the main session's opinion of the code, not what was tried, not what it expects the review to find.
7. **Limits**: reviewers are read-only — no edits, no git writes. Sonnet edits only the files named in its brief.
8. The closing line: *"Do not invent data: if a fact is missing, say so instead of assuming it."*

## Phase 0 — Discover the project shape (main session)

Do this before anything else — do not assume a topology.

0. **Where the repos are.** If the working directory is not a git repository (`git rev-parse` fails), look one level down: every directory holding its own `.git` is a separate repo and a subproject (a workspace folder with `front-*/` and `api-*/` repos inside). Run every git command inside each repo from then on.
1. `git diff --name-only` + `git diff --cached --name-only` + `git status` — the changed files (per repo). If nothing changed anywhere, report "no changes" and stop.
2. `git branch --show-current` — for the briefs; `check-process` flags work on the base branch.
3. Figure out whether the repo is **single** or **split into subprojects**:
   - Look for multiple app roots: several `package.json` files in distinct directories, a workspaces field (`pnpm-workspace.yaml`, `workspaces` in root `package.json`), or conventional `front*/` `back*/` `api*/` `web*/` `server*/` splits.
   - Group the changed files by which subproject they belong to. Only subprojects with actual changes get processed.
   - If there's just one root, treat the whole repo as a single unit.
4. **Locate the checks** for each subproject (subproject-local first, else root): the core checks above, `diff.md`, `.claude/review-protocol.md`, and any project checks. A missing core file → stop and say which; never improvise a check from memory.
5. **ERP**: `check-erp` runs only if `STACK-ERP.md` exists or `CLAUDE.md` says the project is CRM/ERP. Otherwise skip it and say so.
6. Check that `~/.claude/agents/lacayo-opus.md` and `~/.claude/agents/lacayo-sonnet.md` exist. If not, stop: "run `node install.mjs` from algusaem-claude".
7. Read each subproject's `package.json` scripts and `.husky/pre-commit` — the exact verification commands go in Sonnet's brief.

State the discovered shape, the checks that will run and the ones skipped, in two or three lines.

## Phase 1 — Review and verify

Launch, in a **single message** so they all run in parallel, for every affected subproject:

- one `lacayo-opus` per review check (the core ones that apply, `check-tests` Phases 0–4, and the project checks);
- one `lacayo-sonnet` with `check-verify`.

A reviewer whose domain has no changed files answers "Not applicable" and costs little — launch it anyway; it decides, not the main session.

## Phase 2 — Decide and fix

0. **Merge by root cause.** One defect can break rules in several lanes (a silenced error is a logging BLOCKER, a dead-end UI state and a spec gap). Group the findings that point at the same code and the same cause into one item, keeping every rule it breaks. Route each "Outside my lane" entry to its suggested owner: already reported there → merge it; not reported → it becomes a finding of its own, and that check is re-run in Phase 3.
1. **Decide** (main session), item by item, from every report:
   - **fix** — the rule is broken and the fix is clear;
   - **ask** — every APPROVAL, and every fix that would itself fall under `RULES.md` §1 (auth, permissions, config, migrations, scripts, files outside the task, a missing worked example…): stop and ask the user; what stays unanswered goes to the output as pending;
   - **dismiss** — only with the reason written in the report.
2. **Approve the test cases** `check-tests` listed. Ask the user for missing worked examples; an existing test that would have to change without a spec change in this diff → ask (`RULES.md` §3, §4).
3. **Fix** — apply the decided fixes (direct or `lacayo-sonnet`, per the table). A fix brief stays inside the change set: it never edits code or tests that existed before the change — not even to reuse a helper it adds ("use the new helper everywhere" rewrites pre-existing tests, which `RULES.md` §3 forbids without a spec change). A fix can introduce new problems; the next round's reviewers judge the fixes like any other change.
4. **Write the tests** — one `lacayo-sonnet` with `check-tests.md` Phases 0, 5 and 6 and the approved cases, exact file paths included. A red test is reported, not fixed: production code first (`check-tests.md` Phase 6), decided by the main session.

## Phase 3 — Re-check until clean

After fixes or new tests, launch **new** agents (never resumed ones), in one message:

- every check that reported a BLOCKER or ISSUE;
- every check whose domain the fixes or the new tests touched — new tests always bring `check-tests` and `check-good-practices` back; when in doubt, re-run the check;
- `check-verify`, always.

Repeat Phases 2–3 until every check comes back clean. Reviewers are not deterministic: a new reviewer may rate BLOCKER what an earlier one left as a NOTE, on the same code. Decide on the merits, not on which round said it — and prefer asking over looping when a finding only flips between rounds. If the same failure survives several rounds, stop and report what fails, what was tried and the likely cause (`RULES.md` §2) — no workaround that dodges it.

## Phase 4 — Screenshots and commit message

In one message, on the final state of the changes:

- **Screenshots** — when a subproject's change touches UI: one `lacayo-sonnet` with `check-visual.md` and the "Flow to capture" from the last `check-front` report, the app's port and how the project logs in for E2E. The main session then shows the user every screenshot (in the conversation, or sent as files), in order, with the caption of what each should show, and asks them to confirm the result looks right. What they point out is a finding for a new round (Phases 2–3). If the screenshots couldn't be taken, say why; item 5 stays pending until they are, or until the user explicitly waives them for this change.
- **Commit message** — one `lacayo-sonnet` per subproject with `diff.md`.

## Rules

- Do NOT run `git add`, `git commit`, `git push`, or open the PR — stop at the drafted commit message(s).
- Screenshots live outside the repo; they are never committed.
- If a subproject has no changes, skip it — don't review or commit it.

## Output

Per subproject (or one block for a single repo), self-contained so the right commit message can be copied without confusion:

1. **Checks** — one line per check: PASS / FIXED / ASKED / DISMISSED (with the reason) / NOT APPLICABLE / SKIPPED, and the findings that remain, with `path:line — description`. Number of rounds.
2. **Verification** — as Sonnet pasted it: command, exit code, totals.
3. **Tests** — cases written, passing.
4. **Screenshots** — when UI changed: each image with its step, viewport and caption, and the user's confirmation (or what couldn't be taken and why).
5. **Definition of done** — the 15 items of `RULES.md` §22: done (with the check that proved it) / missing / pending / n/a.
6. **Commit message** — the exact code block from `/diff`, unmodified, ready to copy.

Then, once:

- **Pending before merge** — APPROVAL items awaiting the user's confirmation, the screenshots awaiting the user's confirmation, manual checks listed by `check-front`, CI, and the PR text (`/check-pr` when opening the PR). A pass with pending approvals or unconfirmed screenshots is not ready to commit; say so in one line.
- **Verdict** — READY TO COMMIT (no blockers, no pending approvals, screenshots confirmed when UI changed, verification green) or NOT READY with what's missing, one line each.
- The delegation line: «Lacayos: N sonnet, M opus, K directos; reencargos: X». A run with 0 opus did not follow this command.
