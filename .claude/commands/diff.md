---
description: Draft a conventional commit message from working changes
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*)
---

Run `git diff` and `git diff --cached` to see all staged and unstaged changes. Also run `git diff --name-only` and `git diff --cached --name-only` to get the list of changed files. Run `git log --oneline -5` to see recent commit style.

Analyze the changes and draft a commit message following this format:

```
prefix: concise title describing the change

- Bullet point describing each meaningful change
- Group related changes together
- Use present tense ("add", "fix", "update", "remove")
- Reference component/file names when helpful
```

Select the correct prefix based on the nature of the changes:
- `feat:` — new feature or capability
- `fix:` — bug fix
- `refactor:` — restructuring without behavior change
- `style:` — code formatting only (a visual UI change is `feat` or `fix`)
- `chore:` — tooling, config, dependencies
- `perf:` — performance improvement
- `docs:` — documentation only

Rules:
- Title line under 72 characters
- Bullet points should describe *what changed and why*, not restate file names
- Omit trivial changes (whitespace, import reordering) from bullets
- If changes span multiple concerns, pick the dominant one for the prefix — and if they are unrelated purposes, say so above the message and propose how to split them into single-purpose commits (`RULES.md` §21)
- NEVER wrap lines. Each bullet must be on a single line, no matter how long. No soft wraps, no 72-char wrapping inside bullets.
- ALWAYS write the commit message in English — title and bullets — regardless of the project language, the user's language, the language of code/comments/translations in the diff, or any other context. No exceptions.

Print the commit message to the terminal inside a code block so I can copy it. Do NOT run `git commit` or `git add`.
