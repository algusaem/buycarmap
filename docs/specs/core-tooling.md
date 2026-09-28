# Verification contract and repository tooling (migration phase 3)

Key: TOOLING
Status: Implemented
Last updated: 2026-09-28

---

## Problem

BuyCarMap has no single verification command: the steps that prove a change — lint, types, spec
and docs checks, tests with coverage, build — are a list in `CLAUDE.md` that an agent has to
remember. Nothing stops a commit that skips them, CI runs only part of them, nothing scans for
secrets, and releases have no changelog. The core fixes all of this with one contract,
`pnpm check`, and a fixed set of repository tooling (`STACK.md` §4, §5). This is phase 3 of
`docs/decisions/0007-adopt-core-rules.md`.

In scope: the `package.json` scripts of `STACK.md` §5; Biome instead of ESLint; knip and
type-coverage; Husky with lint-staged, commitlint and gitleaks; the pinned toolchain; the PR
workflow; the PR template, CODEOWNERS, Renovate and release-please; the root `TODO.md` turned
into issues; branch protection and squash-only merges on the repository.

MAP-20, MAP-21 and MAP-22 (`docs/specs/map-and-search.md`) were added in this phase with the owner's
approval (2026-09-28); MAP-20 is its only user-visible change.

## Acceptance criteria

`unit` means a `*.node.test.ts` under `scripts/` that reads the working tree.

- [x] TOOLING-1 · unit — `package.json` has `lint`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:e2e`, `build`, `check` and `check:full`; `check` runs lint → typecheck → test → build in that order, and `check:full` runs `check` then `test:e2e`
- [x] TOOLING-2 · unit — `lint` runs Biome, knip, `spec:check` and `docs:check`; `typecheck` runs `tsc --noEmit` and type-coverage; `test` enforces the coverage thresholds
- [x] TOOLING-3 · unit — ESLint is gone: no `eslint*` dependency and no `eslint.config.*`; `biome.json` bans `any`, `console.log` and empty blocks, and caps cognitive complexity
- [x] TOOLING-4 · unit — type-coverage has a minimum no lower than the coverage measured when it was added, and ratchets toward 99%
- [x] TOOLING-5 · unit — knip reports nothing: no unused file, export or dependency (so lib/mock/listings.ts is gone)
- [x] TOOLING-6 · unit — Husky runs lint-staged (Biome on staged files), `vitest related --run --project unit` and gitleaks on pre-commit, and commitlint on commit-msg
- [x] TOOLING-7 · unit — `package.json` pins pnpm in `packageManager` and Node ≥ 22.18 in `engines`, and `.nvmrc` matches it; every CI job runs on that Node
- [x] TOOLING-8 · unit — The PR workflow runs `pnpm check`, gitleaks and the Conventional Commits title check; the nightly live contract job still runs
- [x] TOOLING-9 · unit — The repository has `.github/pull_request_template.md` with the sections Description · Main changes · Impact · Tests · Validation · Decisions and open questions · Checklist, `.github/CODEOWNERS`, `renovate.json`, and release-please (config, manifest and workflow)
- [x] TOOLING-10 · unit — `TODO.md` is gone; each item it held is a GitHub issue
- [x] TOOLING-11 · unit — A failing hook or check is never bypassed: `--no-verify` and `HUSKY=0` appear in no `package.json` script, workflow or Git hook
- [x] TOOLING-12 · unit — `lint` fails when a code comment holds a `TODO` with no issue reference (`#<number>` in the same comment, on the same line), as `STACK.md` §5 requires and Biome cannot express (`scripts/todo-check.mjs`, the owner's decision, 2026-09-28). Scanned: the tracked `.ts`, `.tsx`, `.mjs`, `.cjs`, `.js` and `.css` files.

## Worked examples

- **TOOLING-12** — `// TODO: handle retries` → reported; `// TODO(#42): handle retries` → accepted; `/* TODO see #7 */` → accepted; `const doc = "TODO.md";` → accepted (not a comment); a JSDoc block `/**` / ` * TODO: tidy` / ` */` → reported at line 2; `const u = "https://example.test/TODO";` → accepted (inside a string); a block comment whose first line is `/* Leaflet overrides.` and whose second line is `   TODO: drop after phase 9 */` → reported at line 2; `/* TODO tidy */ color: #123456;` → reported (the issue reference must be inside the comment); a regex literal containing a backtick (`` const r = /`/; ``) followed by a line `// TODO: x` → reported at line 2; `const x = a` then a line `  * b("TODO")` → accepted (a string, not a comment); CSS `* { margin: 0; } /* start` then a line ` TODO here` then `*/` → reported at line 2; `const s = "a \" // TODO: x";` → accepted (inside a string); a template literal spanning lines whose middle line is `// TODO: not a comment` → accepted; `// TODO: a` CRLF `// TODO(#3): b` → reported at line 1 only; `function f() {` / `  // TODO: x` / `}` → reported at line 2; `function f() {` / `  g();` / `  // TODO: more` / `}` → reported at line 3; `const o = {` / `  // TODO: fill` / `};` → line 2; `const a = [` / `  1,` / `  // TODO: more` / `];` → line 3; `foo(/* TODO */);` → line 1; in a `.tsx` file `const e = <div>{/* TODO: x */}</div>;` → line 1; in a `.tsx` file `const e = <p>// TODO later</p>;` → accepted (JSX text, not a comment); `// TODO: x` in `x.mjs`, `x.cjs` and `x.js` → each reported at line 1; the same line in `notes.md` → accepted (not scanned); in a file named `Makefile` → accepted (not scanned); a tracked `a.ts` holding `// TODO: x` makes `pnpm todo:check` exit 1 printing `a.ts:1  TODO without an issue reference`; with `// TODO(#1): x` it exits 0 printing `todo:check passed - 1 file(s) scanned.`.

## Data model

None: this feature adds or changes no table or column. No Prisma, API or environment change.

## Permissions

No application user data or authorization changes (see Out of scope). On the repository, a change
reaches the base branch only through a PR with green CI, at least one approving review and the
branch up to date, merged by squash; on a one-person repository merges go through the admin bypass
(see Decisions › Branch protection as `STACK.md` §4 says).

## Edge cases

- TOOLING-5 — an unused file, export or dependency fails `lint`.
- TOOLING-11 — a bypass flag in a script, workflow or Git hook.
- TOOLING-12 — a `TODO` comment with no issue reference fails `lint`.
- A bypass flag named in a doc: see Decisions › TOOLING-11 covers where a bypass takes effect.
- An issue reference outside the comment, and comments the scanner could miss: see Decisions › The issue reference counts only inside the comment.

## Out of scope

- dependency-cruiser and plop: their rules assume the `src/server` layout, so they come with it in
  phase 5.
- The Impeccable detector in `lint`: phase 9.
- E2E against the Vercel preview on `deployment_status`: phase 12. Until then the E2E job stays on
  `pull_request` against the local app.
- Renaming `master` to `main`: phase 12, with Vercel's production branch.
- Any change to what a user sees. Biome's formatting pass reformats files without changing what
  they do.

## Contracts

Repository settings, outside the working tree: branch protection on the base branch and
squash-only merges (approved by the owner, 2026-09-27). No test can read them; the phase report
states them as measured with `gh api`.

## Decisions and rationale

**`spec:check` and `docs:check` inside `lint`.** `STACK.md` §5 fixes `check` as lint → typecheck →
test → build. The two project checks are static and fail fast, so they join `lint` rather than
adding a fifth step the core's `check-verify` would not know about. Nothing the old checks ran is
dropped.

**`test:integration` before Testcontainers.** The script exists from this phase so the contract in
`STACK.md` §5 is complete; until phase 7 it runs the `node` project (ADR 0007 row 16).

**The TODO list becomes issues.** `RULES.md` §22 item 7 bans a `TODO` without an issue, and a
list at the root is the same thing at file scale.

**gitleaks locally.** The pre-commit hook needs the gitleaks binary on the development machine; it
is installed with `winget` (the owner approved it, 2026-09-27), and in CI through its official
action.

**Branch protection as `STACK.md` §4 says** (the owner's decision, 2026-09-27): PR only, green CI,
at least one approving review, branch up to date with the base branch; squash-only merges. On a
one-person repository nobody else can approve, so merges go through the admin bypass — the owner's,
or the agent's on the owner's instruction.

**`prisma generate` before `pnpm check` in CI.** `typecheck` and the tests import the generated
client, which is gitignored; the build regenerates it anyway.

**E2E without retries.** ADR 0007 row 4 scheduled it for this phase (approved by the owner,
2026-09-28): a flaky test is a broken test (`STACK.md` §16).

**TOOLING-11 covers where a bypass takes effect.** A skip flag written in a doc runs nothing; the
docs that name the flags do so as prohibitions, which `check-process` reviews (the owner's
decision, 2026-09-28).

**The issue reference counts only inside the comment.** A colour or anchor elsewhere on the line
is not an issue (the owner's decision, 2026-09-28). **Comments are found by TypeScript's syntactic classification** — what editors use to colour
comments — for script files, and by `/* */` blocks for CSS. A hand-rolled scanner missed comments
after a regex literal, and an AST walk missed comments before a closing bracket and inside JSX;
the recorded decision is ADR 0010.
