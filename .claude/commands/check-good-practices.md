---
description: Review working changes for good practices — reuse and duplication, clean code, TypeScript, React and components, and the project's own CLAUDE.md rules
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Agent
---

Review the working changes for **good practices**. Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

**Owns:** `RULES.md` §6 (except security → `check-security`), §7, §8, §3 (`any`, `as unknown as`); `STACK.md` §7; the rules in the project's `CLAUDE.md` that no other check's domain covers (review protocol §2); comments the change makes false.
**Applies to:** every changed source file (`.ts`, `.tsx`), tests included.

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
Run on its own, the main session does not review good practices itself, however capable it is of doing so:
- **The whole review → one `Agent` with `subagent_type: "lacayo-opus"`**, told it is the delegated agent and spawns no agents, and briefed with this file, `.claude/review-protocol.md`, the change set, the task in the user's words and the approvals the user gave, quoted; it returns the output of review protocol §7.
- **The mastermind** re-measures with its own eyes only the facts it will state (a quoted `file:line`, the changed files: single read-only commands), and writes the report; which findings get fixed is the user's decision when the check runs on its own (review protocol §6). The fixes the user asks for are dictated edits: direct for two or three steps in one file, `lacayo-sonnet` for anything longer.
Inside `/check-all` this paragraph does not apply: there the agent running this file is already the delegated hand. Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 opus» did not follow this command.

## 1. Code (`RULES.md` §6)

- **Duplication**: before accepting a new function, component, hook or utility, grep the repo for one that already does the same; and look for the same rule written twice inside the change (two loops, two copies of a condition). Duplicated logic → BLOCKER.
- **Comments** the change makes false (a comment describing what the code no longer does) → ISSUE.
- Only what was asked: extra files, hooks, configs or interfaces beyond the task; speculative abstractions; patterns "just in case".
- Dead code: unused variables, hooks, imports, exports; backwards-compatibility shims or `_unused` renames → BLOCKER.
- `.then()` chains, nested ifs a guard clause would flatten, clever one-liners that need a comment.
- Refactors of working code that don't improve correctness or clarity.

## 2. TypeScript (`RULES.md` §7, §3, `STACK.md` §7)

- `any` or `as unknown as` → BLOCKER, always.
- `unknown` outside a `catch` or a parser boundary, or not narrowed right away → BLOCKER.
- `interface` for object shapes; `type` only for unions, branded types and `z.infer`.
- Validated data typed via `z.infer` next to its schema — a hand-written duplicate → BLOCKER; other reusable typings in `/interfaces`; small one-off typings stay in the component.
- IDs branded; discriminated unions over nullable-field soup; exhaustive switches end in `assertNever`; `satisfies` over annotation for config; no `as` outside test factories and parser boundaries.
- No over-typing trivial values (`const x: number = 5`).

(`@ts-ignore`, `@ts-expect-error`, `biome-ignore` and `!` are `check-process`'.)

## 3. React and components (`RULES.md` §8)

- `useEffect` syncing derived state or added "just in case"; `.forEach` where `.map` fits.
- Render functions returning JSX; repeated JSX not extracted into a private component; a ternary duplicating large blocks instead of one structure with `{condition && …}`.
- Components over ~250 lines or doing more than one thing; a shared component extracted preemptively.
- Several states managed inline instead of in a `/hooks` hook; components managing request lifecycle.

## 4. Project rules (`CLAUDE.md`)

Walk the rules written in the root `CLAUDE.md` and in each subdirectory `CLAUDE.md` / `AGENTS.md` covering changed files — only the text of those files (`RULES.md` imported through `@RULES.md` and the stack files have their own owners). The rules in another check's domain (testing, UI, security, data, stack, process) are that check's (review protocol §2); skip them, and skip the sections a project-specific `check-*` command claims. Walk the rest one by one.

- A rule the diff breaks → BLOCKER if it's mandatory (MUST, NEVER, always, or a description of how the code is organised that the change contradicts), ISSUE if it's a preference. Cite it as `CLAUDE.md › <section>`.
- Rules about how to work rather than what the code is (communication, delegation, when to ask) can't be judged from the diff: skip them.
- Contradictions with `RULES.md` or the stack: as the review protocol §2 says — only when the change touches the rule.

## Definition of done

Owns `RULES.md` §22 item 7 for dead code.
