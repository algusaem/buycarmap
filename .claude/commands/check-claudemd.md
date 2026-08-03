---
description: Decide if the session's work should be saved to CLAUDE.md
allowed-tools: Read, Grep, Glob, Bash(git:*), Edit
---

You are reviewing the current session and recent changes to decide if anything should be persisted to the project's `CLAUDE.md`. Be selective — only save things that will genuinely help future sessions.

## Phase 1 — Gather Context

Run these to understand what changed:

1. `git diff --name-only` and `git diff --cached --name-only` — working changes
2. `git log --oneline -10` — recent commits
3. Read the diff content for any significant changes (`git diff`, `git diff --cached`, or `git show HEAD` for the last commit)

Also review the conversation for: new patterns established, new dependencies added, gotchas discovered and how they were solved, and conventions confirmed or extended in a notable way.

## Phase 2 — Read Current Documentation

Find and read the project's `CLAUDE.md` file(s) — the root one, and any nested ones in subprojects that were touched — so you know what's already documented.

## Phase 3 — Evaluate What's Worth Saving

**Save to CLAUDE.md if:**
- A new architectural pattern was established that future code should follow.
- A new reusable component/module/endpoint convention was introduced.
- A new dependency was added with specific setup requirements or caveats.
- A registration point or wiring step was added that's easy to forget.
- An existing documented pattern changed or was replaced.
- A non-obvious gotcha was discovered that will recur (framework quirk, build caveat, environment trap).

**Do NOT save:**
- Session-specific context (what was being debugged, what order things happened).
- Information already covered by existing documentation.
- Trivial changes that don't affect how future work should be done.
- Speculative notes — only save confirmed patterns.
- One-off fixes that won't recur.

## Phase 4 — Apply Changes

For each change worth saving, apply it immediately with the Edit tool. Do NOT ask for confirmation — just do it. Present a brief summary of what you changed and why afterward.

When editing:
- Place new content in the most relevant existing section, or create a new section if none fits.
- Keep entries concise and consistent with the existing documentation style.
- Update existing entries rather than adding duplicates.

If there's nothing worth saving, say so explicitly — that's a valid outcome.
