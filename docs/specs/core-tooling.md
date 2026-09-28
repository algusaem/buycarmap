# Spec: Verification contract and repository tooling (migration phase 3)

Key: TOOLING
Status: Implemented
Last updated: 2026-09-28

---

## 1. Problem

BuyCarMap has no single verification command: the steps that prove a change — lint, types, spec
and docs checks, tests with coverage, build — are a list in `CLAUDE.md` that an agent has to
remember. Nothing stops a commit that skips them, CI runs only part of them, nothing scans for
secrets, and releases have no changelog. The core fixes all of this with one contract,
`pnpm check`, and a fixed set of repository tooling (`STACK.md` §4, §5). This is phase 3 of
`docs/decisions/0007-adopt-core-rules.md`.

## 2. Scope

**In scope.** The `package.json` scripts of `STACK.md` §5; Biome instead of ESLint; knip and
type-coverage; Husky with lint-staged, commitlint and gitleaks; the pinned toolchain; the PR
workflow; the PR template, CODEOWNERS, Renovate and release-please; the root `TODO.md` turned
into issues; branch protection and squash-only merges on the repository.

**Out of scope.**

- dependency-cruiser and plop: their rules assume the `src/server` layout, so they come with it in
  phase 5.
- The Impeccable detector in `lint`: phase 9.
- E2E against the Vercel preview on `deployment_status`: phase 12. Until then the E2E job stays on
  `pull_request` against the local app.
- Renaming `master` to `main`: phase 12, with Vercel's production branch.
- Any change to what a user sees. Biome's formatting pass reformats files without changing what
  they do.

## 3. Acceptance criteria

`unit` means a `*.node.test.ts` under `scripts/` that reads the working tree.

| AC | Statement | Level | Verified by |
| --- | --- | --- | --- |
| TOOLING-1 | `package.json` has `lint`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:e2e`, `build`, `check` and `check:full`; `check` runs lint → typecheck → test → build in that order, and `check:full` runs `check` then `test:e2e` | unit | `scripts/core-tooling.node.test.ts` › TOOLING-1 |
| TOOLING-2 | `lint` runs Biome, knip, `spec:check` and `docs:check`; `typecheck` runs `tsc --noEmit` and type-coverage; `test` enforces the coverage thresholds | unit | `scripts/core-tooling.node.test.ts` › TOOLING-2 |
| TOOLING-3 | ESLint is gone: no `eslint*` dependency and no `eslint.config.*`; `biome.json` bans `any`, `console.log` and empty blocks, and caps cognitive complexity | unit | `scripts/core-tooling.node.test.ts` › TOOLING-3 |
| TOOLING-4 | type-coverage has a minimum no lower than the coverage measured when it was added, and ratchets toward 99% | unit | `scripts/core-tooling.node.test.ts` › TOOLING-4 |
| TOOLING-5 | knip reports nothing: no unused file, export or dependency (so lib/mock/listings.ts is gone) | unit | `scripts/core-tooling.node.test.ts` › TOOLING-5 |
| TOOLING-6 | Husky runs lint-staged (Biome on staged files), `vitest related --run --project unit` and gitleaks on pre-commit, and commitlint on commit-msg | unit | `scripts/core-tooling.node.test.ts` › TOOLING-6 |
| TOOLING-7 | `package.json` pins pnpm in `packageManager` and Node ≥ 22.18 in `engines`, and `.nvmrc` matches it; every CI job runs on that Node | unit | `scripts/core-tooling.node.test.ts` › TOOLING-7 |
| TOOLING-8 | The PR workflow runs `pnpm check`, gitleaks and the Conventional Commits title check; the nightly live contract job still runs | unit | `scripts/core-tooling.node.test.ts` › TOOLING-8 |
| TOOLING-9 | The repository has `.github/pull_request_template.md` with the sections Description · Main changes · Impact · Tests · Validation · Decisions and open questions · Checklist, `.github/CODEOWNERS`, `renovate.json`, and release-please (config, manifest and workflow) | unit | `scripts/core-tooling.node.test.ts` › TOOLING-9 |
| TOOLING-10 | `TODO.md` is gone; each item it held is a GitHub issue | unit | `scripts/core-tooling.node.test.ts` › TOOLING-10 |
| TOOLING-11 | A failing hook or check is never bypassed: `--no-verify` and `HUSKY=0` appear in no `package.json` script, workflow or Git hook | unit | `scripts/core-tooling.node.test.ts` › TOOLING-11 |
| TOOLING-12 | `lint` fails when a code comment holds a `TODO` with no issue reference (`#<number>` in the same comment, on the same line), as `STACK.md` §5 requires and Biome cannot express (`scripts/todo-check.mjs`, the owner's decision, 2026-09-28). Worked examples: `// TODO: handle retries` → reported; `// TODO(#42): handle retries` → accepted; `/* TODO see #7 */` → accepted; `const doc = "TODO.md";` → accepted (not a comment); a JSDoc block `/**` / ` * TODO: tidy` / ` */` → reported at line 2; `const u = "https://example.test/TODO";` → accepted (inside a string); a block comment whose first line is `/* Leaflet overrides.` and whose second line is `   TODO: drop after phase 9 */` → reported at line 2; `/* TODO tidy */ color: #123456;` → reported (the issue reference must be inside the comment); a regex literal containing a backtick (`` const r = /`/; ``) followed by a line `// TODO: x` → reported at line 2; `const x = a` then a line `  * b("TODO")` → accepted (a string, not a comment); CSS `* { margin: 0; } /* start` then a line ` TODO here` then `*/` → reported at line 2; `const s = "a \" // TODO: x";` → accepted (inside a string); a template literal spanning lines whose middle line is `// TODO: not a comment` → accepted; `// TODO: a` CRLF `// TODO(#3): b` → reported at line 1 only. | unit | `scripts/todo-check.node.test.ts` › TOOLING-12 and `scripts/core-tooling.node.test.ts` › TOOLING-2 |

## 4. Decisions and rationale

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
is not an issue (the owner's decision, 2026-09-28). **Comments are found by a parser, not by
pattern**: TypeScript's own scanner for script files, `/* */` blocks for CSS — a hand-rolled
scanner missed comments after a regex literal.

## 5. Data and contracts

No Prisma, API or environment change.

Repository settings, outside the working tree: branch protection on the base branch and
squash-only merges (approved by the owner, 2026-09-27). No test can read them; the phase report
states them as measured with `gh api`.

## 6. Open questions

None.
