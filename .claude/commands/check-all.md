---
description: Run the full review pipeline (/check + /check-tests + /diff), adapting to the project's shape
allowed-tools: Read, Grep, Glob, Bash(npm:*), Bash(npx:*), Bash(pnpm:*), Bash(git:*), Edit, Write, Task
---

Run the complete pre-commit flow on the current working changes. First figure out the project's shape, then apply the pipeline to each affected part. Read each referenced command file in `.claude/commands/` and apply it fully. Do NOT skip phases.

## Phase 0 — Discover the project shape

Do this before anything else — do not assume a topology.

1. `git diff --name-only` + `git diff --cached --name-only` + `git status` — the changed files. If both diffs are empty, report "no changes" and stop.
2. Figure out whether the repo is **single** or **split into subprojects**:
   - Look for multiple app roots: several `package.json` files in distinct directories, a workspaces field (`pnpm-workspace.yaml`, `workspaces` in root `package.json`), or conventional `front*/` `back*/` `api*/` `web*/` `server*/` splits.
   - Group the changed files by which subproject they belong to. Only subprojects with actual changes get processed.
   - If there's just one root, treat the whole repo as a single unit.
3. Note whether a **subproject-local command** exists (e.g. `<subproject>/.claude/commands/check.md`). If it does, prefer it over the root one — projects specialize their own review (a backend `/check` looks different from a frontend one). Fall back to the root command otherwise.
4. Detect the toolchain per subproject from its `package.json` scripts (`npm`/`pnpm`/`yarn`, `build`/`lint`/`test`/`typecheck`). Use the real commands the project defines — don't guess.

State the discovered shape in one or two lines before proceeding.

## Phase 1 — Run the pipeline per affected subproject

For **each** subproject that has changes (or the single repo), run this in order, from that subproject's directory:

1. **`/check`** — full code review + build/lint/type verification. Apply every phase of the relevant `check.md` (subproject-local if present, else root).
2. **Fix everything it surfaces**, until `/check` comes back clean. Don't move on with unresolved issues.
3. **`/check-tests`** — ensure meaningful tests exist and pass. Apply every phase of the relevant `check-tests.md`. Respect its Phase 0 (no tautological / self-fulfilling / mock-the-SUT tests) and its rule: when a test is red, fix the production code, not the test — unless the test itself was wrong.
4. **Spec conformance** — only where the project keeps specs (`docs/specs/`):
   - Run `pnpm spec:check`. It fails when an approved criterion has lost its test, or a test names a criterion that no longer exists.
   - If the change altered observable behaviour, confirm the governing spec was updated: a new or changed criterion, and its **Verified by** cell pointing at the test that now proves it. Behaviour that changed without a spec edit is the failure mode this whole process exists to prevent — flag it rather than fixing it silently.
   - If the change is a pure refactor, styling, or dependency bump, say so and move on. Not everything needs a spec.
5. **Documentation conformance** — only where the project keeps docs (`docs/`):
   - Run `pnpm docs:check` if the project defines it. It catches the mechanical rot — a link to a file or anchor that no longer exists, a doc naming a source path that was moved or deleted, a doc nobody links to. It cannot tell you whether the prose is still *true*; that is the rest of this phase.
   - **Work out which docs govern the change**, from `docs/README.md`'s ownership map if there is one, otherwise by area. Name them explicitly — "no docs needed" is a claim, and it has to survive being stated with the file list next to it.
   - **Update them in the same change.** A doc that describes the old behaviour is worse than a missing one, because it is trusted. If you changed an upstream contract, an env var, a command, a model, a route, or a bootstrap step, the doc that records it is part of the diff — not a follow-up.
   - **Docs are not specs and must not restate them.** `docs/specs/` owns *what the software does and why it is built that way*; `docs/` owns *how to get in, how it fits together, how to operate it*. When both would say the same thing, the doc links to the spec. Duplicated prose is how two sources of truth start disagreeing.
   - **No doc is needed** for an internal refactor with no observable surface, a test-only change, a styling tweak that changes no interaction, or a dependency bump that changes no command. Say which one applies and move on — this gate exists to catch silent drift, not to tax every commit.
   - When a change genuinely needs a doc that does not exist yet, **write it** rather than filing it. Deferred documentation is how `docs/` becomes a graveyard of half-covered areas.
6. **`/diff`** — draft the conventional commit message for that subproject's changes.

When there are multiple affected subprojects, you may run their pipelines concurrently by dispatching one `Agent` per subproject in a single message (each agent works only within its subproject directory and returns its own per-phase summary + commit message). Keep each subproject's findings and commit message fully separate — never merge them.

## Rules

- Do NOT run `git add` or `git commit` — stop at the drafted commit message(s).
- If a fix in one step invalidates an earlier step, re-run the earlier step.
- If a subproject has no changes, skip it — don't review or commit it.

## Output

Present results grouped by subproject (or one block for a single repo), each self-contained so the right commit message can be copied without confusion:

1. A per-phase summary from `/check` (PASS / ISSUES FOUND → FIXED, with `path:line — description`).
2. A per-phase summary from `/check-tests` (tests written / passing).
3. Spec conformance: `spec:check` result, and either the spec that was updated or the reason none was needed.
4. Documentation conformance: `docs:check` result if the script exists, then a line per governing doc — `updated`, `already accurate`, or `none needed (<reason>)`. If you claim none were needed, the reason goes in that line. Never report this phase as a bare "done".
5. The exact commit-message code block from `/diff`, unmodified, ready to copy.
