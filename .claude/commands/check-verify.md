---
description: Run the project's verification — pnpm check, pnpm check:full when UI or user flows changed, gitleaks — and report the outputs verbatim
allowed-tools: Read, Grep, Glob, Bash(pnpm:*), Bash(npm:*), Bash(npx:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Bash(gitleaks:*), Agent
---

Run the verification of the working changes and report exactly what came out. **This command runs, it doesn't review and it doesn't fix**: every output is pasted as it came, a failure is reported, never worked around.

**Owns:** `RULES.md` §22 item 4, and the §3 rule "never claim something works without having run it"; `STACK.md` §5 (the commands).

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
The main session never runs the verification itself (the guard hook blocks it):
- **Everything → one `Agent` with `subagent_type: "lacayo-sonnet"`**, told it is the delegated agent and spawns no agents, and briefed with the exact commands — the `check` scripts — and the reference numbers of the last run, so it reports deltas; outputs pasted verbatim, a failure reported, never worked around.
- **The mastermind** uses the outputs as pasted and never re-runs them; it re-measures only a fact it will quote that is not a verification result.
Inside `/check-all` this paragraph does not apply: there the agent running this file is already the delegated hand. Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 sonnet» did not follow this command.

## 1. Find the commands

Detect the package manager from the lockfile and use the project's own scripts — don't guess. Read `package.json` scripts and `.husky/pre-commit`.

- If the project has no `check` script but `STACK.md` applies → BLOCKER, unless the adoption ADR accepts it (then a NOTE citing the ADR); either way run its individual scripts (`lint`, `typecheck`, `test`, `build`) instead. Read `docs/decisions/` for the adoption ADR first: every requirement below it accepts as a deviation is a NOTE, not a BLOCKER.
- Without `STACK.md`, run whatever build, lint, typecheck and test scripts the project defines.

## 2. Run

**Every command runs detached from the terminal and with a time limit** — e.g. `setsid timeout 900 <cmd> </dev/null` on Linux/WSL. A tool that wants input (a `psql` asking for a password, an interactive prompt) then fails at once instead of waiting forever. Exit 124 is a hang: report it with the last lines of output. Never retry a command that hung or failed, never leave one running in the background, and before reporting make sure nothing you started is still running.

1. **`pnpm check`** — lint + dependency-cruiser + knip + the Impeccable detector, typecheck + type-coverage, unit and integration tests with the coverage threshold, build. It must pass.
2. **`pnpm check:full`** — required when the change touches UI or user flows (`src/app/**`, `src/components/**`, `tests/e2e/**`, or the brief says so). If the environment can't run it (no Docker, no Playwright browsers), say so and why: `RULES.md` §22 item 4 asks for it locally, so the change is not done until it passes here.
3. **gitleaks** — exactly as `.husky/pre-commit` runs it; with no hook, `gitleaks detect --no-banner --redact` and say it's the fallback. Not installed → "not run — gitleaks not installed".

A tool the project doesn't have (no dependency-cruiser, knip, Impeccable detector, type-coverage, coverage threshold) is reported as **not configured**, which is different from **not run**: the first is a gap in the project's setup, the second a gap in this run.

## 3. Report

For each command: the command line, the exit code, the totals (tests passed/failed, coverage against its threshold, type-coverage), and every error with `file:line` pasted verbatim. Anything not run is reported as **not run**, with the reason. **Never state a result you haven't seen.**

```

- `pnpm check` — exit <n> — <totals>
- `pnpm check:full` — exit <n> | not run (<reason>) | not required
- gitleaks — exit <n> — <findings>

<verbatim errors, grouped by command>

#### Definition of done
Item 4: done (every required command ran and passed) | missing (which failed, which didn't exist, which didn't run)
```
