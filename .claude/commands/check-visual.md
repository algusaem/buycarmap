---
description: Take Playwright screenshots of a UI change — the result and every step of the new user flow, on mobile and desktop — for the user to confirm before committing
allowed-tools: Read, Grep, Glob, Write, Bash(pnpm:*), Bash(npx:*), Bash(node:*), Bash(curl:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git rev-parse:*)
---

Show the user how a UI change looks, and the flow they will follow, before it's committed. **This command runs, it doesn't review and it doesn't fix**: it takes the screenshots, says what each one should show, and says what it couldn't capture.

**Owns:** `RULES.md` §22 item 5 (the screenshots). The user's confirmation of them is what closes the item — `/check-all` can't say READY without it.

## 1. When

The change touches UI: pages, layouts, components, styles or theme, or the messages shown on screen (`src/app/**`, `src/components/**`, `globals.css`, `messages/**`, or their equivalents in the project's layout). Otherwise report "Not applicable — no UI change" and stop.

## 2. What to capture

- **The flow**: inside `/check-all`, the "Flow to capture" list from `check-front`'s report, in the brief. On its own, derive it from the spec's acceptance criteria and the changed components: numbered steps, each with the route, the role, the action and the state it should show.
- **Always**: the final result, and every step of the new or changed flow — the control before and after using it, what appears or disappears, the states the change adds (empty, error, selected, open…) when they're reachable.
- **Viewports**: mobile 375×812 and desktop 1440×900. If the spec limits a role to one of them, that role only on that one.

## 3. Run

- **The app**: if a dev server already answers on the project's port, use it — never start a second one. Otherwise start the app the way the project's Playwright `webServer` does, and stop it at the end.
- **Real screens only**: the app must load real data (its backend, its database, its seed). If it can't, stop and report "not taken — <reason>". Never mock the UI or fake data to get a picture.
- **Login**: the project's E2E auth helper or storage state if there is one; otherwise the test user from the project's seed or fixture files. Never real credentials.
- **The script**: a throwaway Playwright script outside the repo (scratchpad or `/tmp`), using the project's installed `playwright` / `@playwright/test`. Nothing is added to the repo: this isn't a visual-regression test.
- **Data**: use seed or test data. If a step would create, change or delete records in a database other people use, stop and say so instead.
- **Every command detached from the terminal and with a time limit** (e.g. `setsid timeout 600 <cmd> </dev/null`), as in `check-verify`. Leave nothing running.
- **Files**: `<NN>-<step-slug>-<mobile|desktop>.png` in one folder. Full page, unless the step is about a modal, panel or menu — then the viewport.

## 4. Report

```
### check-visual — TAKEN | PARTIAL (what's missing) | NOT TAKEN (reason) | NOT APPLICABLE
Folder: <absolute path>
1. `01-<step>-mobile.png` — step 1, mobile, <role> — what it should show
2. `01-<step>-desktop.png` — …

#### Not captured
<steps or states that couldn't be reached, and why — or "None">

#### Still manual
What screenshots can't prove: keyboard use, focus, screen reader, performance.

#### Definition of done
Item 5 (screenshots): pending the user's confirmation | not taken (reason)
```

Do not invent data: if a fact is missing, say so instead of assuming it.
