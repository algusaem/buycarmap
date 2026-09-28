---
description: Check the CHANGELOG entry the branch will produce through release-please — type by what users perceive, breaking marker, user-facing wording. First step of /check-pr.
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*)
---

The `CHANGELOG` is never edited by hand (`RULES.md` §3): release-please builds it from the commit that reaches the base branch, and with squash merge that commit is the PR title (plus a `BREAKING CHANGE:` footer from the body). So this command doesn't check the file — it decides the entry the branch will produce and makes sure it is right. **Its output is the title `/check-pr` uses.** It only writes text: never edit `CHANGELOG.md`, never commit.

**The changelog is for users.** Only what a user of the application perceives gets an entry: a new capability, changed behaviour, a visible UI change, a bug they could hit, a noticeably faster response. Internal work (refactors, tooling, tests, docs, dependencies with no visible effect) stays out. The commit type decides which is which, so the failure this command exists to catch is a misclassified type.

## Phase 1 — Scope

1. **Base branch**: `git symbolic-ref --short refs/remotes/origin/HEAD` without the `origin/` prefix; without `origin/HEAD`, the base branch `CLAUDE.md` declares; else `main`, and say it was assumed. If the current branch *is* the base branch, stop: "no changelog entry from the base branch". If it's release-please's own release branch (`release-please--…`), stop: nothing to check.
2. **What reaches the base branch**: `git log --format='%h %s%n%b' <base>..HEAD` and `git diff <base>...HEAD`. Uncommitted working changes are not part of the entry; mention them in a NOTE if there are any.
3. **Context**: the spec(s) in `docs/specs/` for the features touched — their Problem and Acceptance criteria say what the user sees.
4. `CHANGELOG.md` changed in the branch or the working changes → **BLOCKER** (`RULES.md` §3).
5. **release-please config**: read `release-please-config.json` and `.release-please-manifest.json`.
   - `changelog-sections`: which types are visible and under which section, which are `hidden`. Without it, the defaults apply: `feat`, `fix`, `perf` and `revert` visible; `docs`, `style`, `chore`, `refactor`, `test`, `build`, `ci` hidden. Breaking changes are always listed.
   - `packages`: in a monorepo, which packages the changed paths belong to — the entry lands in each of their changelogs.
   - `bump-minor-pre-major` / `bump-patch-for-minor-pre-major`, for the expected version bump before 1.0.
   - No release-please config while `STACK.md` applies → **BLOCKER** (release-please is mandatory, `STACK.md` §4), unless the adoption ADR in `docs/decisions/` accepts its absence — then a NOTE citing the ADR, and the entry is still written: CI validates the title either way.
   - **A hand-kept `CHANGELOG.md` the adoption ADR accepts** (no release-please): the check becomes that the branch's hand entry matches the classified type (a user-visible change has an entry, an internal one doesn't), its version follows the previous entry's, and its wording is for users. A missing or mismatched entry → ISSUE.
   - **Split repos** (a front and an API released separately): each repo gets its own entry. An API change that exists to enable a feature in the other repo is still a `feat` of the API when it adds something consumers can use (a new argument); say in the entry what it enables. A release-order dependency (the API must ship before the front) is not breaking — it goes to `/check-pr`'s Manual actions.

State in one line which config applies.

## Phase 2 — Classify by what users perceive

List every meaningful change in the branch and answer, for each: **would a user of the application notice it?** Users are the people using the app (and, for a public API, its consumers) — not the developers.

- Perceptible new capability or changed behaviour → `feat`
- Perceptible bug fixed → `fix`
- Perceptible speed-up → `perf`
- Nothing perceptible → `refactor`, `chore`, `docs`, `test`, `build`, `ci`, or `style` — and `style` means code formatting only: **a visual UI change is `feat` or `fix`, never `style`**.
- **Breaking**: removes or changes something users or API consumers rely on — a removed feature, a changed URL or public API contract (`STACK.md` §13), a changed default they depend on, a required action after deploy → `!` after the type and a `BREAKING CHANGE:` footer.

The branch type is the most significant one (`feat` > `fix` > `perf` > the rest). If the branch mixes perceptible changes that deserve separate entries, or a perceptible change with a large unrelated internal one → **ISSUE**: the branch isn't single-purpose (`RULES.md` §21); propose how to split it.

## Phase 3 — Check the entry against the config

- A perceptible change whose type the config hides → **BLOCKER**: it vanishes from the changelog and doesn't bump the version.
- An imperceptible change with a visible type → **BLOCKER**: it pollutes the changelog and bumps the version for nothing.
- A breaking change without `!` and the footer → **BLOCKER**: no major bump, consumers get no warning.
- **Monorepo**: the entry lands in every package whose paths the branch touches. If it reads wrong in one of them (a user-facing summary in an internal package's changelog, or the reverse) → **ISSUE**: split the branch per package.
- State the expected version bump: `feat` → minor, `fix` / `perf` → patch, breaking → major (adjusted by the pre-1.0 options).

## Phase 4 — Write the entry

- **Title**: Conventional Commits, `type(scope)?: summary` — lowercase, imperative, no final period, ≤ 72 characters. CI validates it (`amannn/action-semantic-pull-request`).
- **Summary written for the person reading the changelog**: the effect, not the implementation — `feat(invoices): show overdue invoices first`, not `refactor invoice query ordering`. Hidden types can stay technical; nobody reads them in the changelog.
- **Scope**: optional; the feature as users know it, not a folder name.
- **Breaking**: the footer `BREAKING CHANGE: <what breaks and what to do about it>`, for the PR body.
- **English**. No internal names, ticket numbers, people's names or AI attribution.

## Output

1. The findings, `BLOCKER` / `ISSUE` / `NOTE` with the reason, or "No findings."
2. The entry: the title in a code block, and the `BREAKING CHANGE:` footer in a second code block when there is one.
3. One line: in the changelog yes/no (and under which section), expected version bump, packages affected.
