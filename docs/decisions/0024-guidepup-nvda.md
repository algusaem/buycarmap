# 0024 — Guidepup and NVDA on a Windows runner for the screen-reader tests

Status: Accepted · Date: 2026-10-20

## Context

axe in Playwright (FRONT-19, LOOK-18 and the rest) proves the accessibility tree is well-formed, not
what a screen reader says. Every redesign PR lists the screen reader as "not verified" (#127):
nobody has heard the search pill's segments, the result count, the empty and error lines, the pins
or the tab bar read aloud.

`STACK.md` names Playwright for e2e and axe for accessibility, and no library to drive a real screen
reader. The owner approved the screen-reader part of
[docs/specs/a11y-checks.md](../specs/a11y-checks.md) on 2026-10-19 and chose NVDA on a
GitHub-hosted Windows runner.

## Decided

- **Guidepup drives NVDA**: `@guidepup/guidepup`, `@guidepup/playwright` and `@guidepup/setup` (MIT),
  dev dependencies pinned to exact versions — 0.36.4, 0.20.0 and 0.29.3 — because they are 0.x and
  released weekly, so a range would change the suite under us between two runs.
- **On a GitHub-hosted `windows-2025` runner** (owner, 2026-10-19), in its own workflow
  (`.github/workflows/screen-reader.yml`): on pull requests that touch `app/`, `components/` or
  `messages/`, and on demand. `@guidepup/setup`'s CLI configures Windows and installs NVDA there at
  run time (`guidepup setup --ci`, then `guidepup install nvda`). Nothing is installed on the owner's machine.
- **Outside `pnpm check:full`**: the tests live in `e2e-sr/`, with their own Playwright config
  (`playwright.sr.config.ts`, serial and headed through `withGuidepup`, one worker, the e2e suite's
  web servers imported from `playwright.config.ts`) and their own script, `pnpm test:sr`.
- **Assertions on BuyCarMap's own Spanish strings** inside NVDA's spoken log, never on NVDA's role
  words, which follow the reader's language. Each test first asserts that NVDA said something, so a
  reader that is not speaking fails the run instead of passing it.
- **`ffmpeg-static` stays denied** in `pnpm-workspace.yaml`'s `allowBuilds`. It reaches the tree
  through `@guidepup/setup`'s optional `@guidepup/record`, which records the screen during the macOS
  setup; the NVDA suite on Windows never loads it, so its install script (a binary download) is not
  run.

The behaviour is specified in [docs/specs/a11y-checks.md](../specs/a11y-checks.md) (A11Y-9 to
A11Y-14).

## What it beat

- **VoiceOver on a macOS runner.** VoiceOver is what iPhone users hear, but VoiceOver on macOS 27
  has an open bug that returns empty phrases.
- **NVDA on the owner's machine.** No CI cost, but Guidepup does not list Windows 11 Home, and every
  local check would depend on a reader installed by hand.
- **Inside `pnpm test:e2e`.** One suite to run, but Guidepup forces serial, headed runs and needs a
  real reader: every local `check:full` would depend on NVDA.
- **axe alone.** Already in place, but it cannot say what is spoken, which is the question here.

## What it costs

- **A Windows job** on every pull request that touches the UI or its copy, which installs NVDA on
  each run. The runner is free for this public repository.
- **No local run.** `pnpm test:sr` needs NVDA, so the suite only runs in CI; a failure is read from
  the job's report.
- **Weekly upgrades by hand.** Exact pins on 0.x packages mean each upgrade is a deliberate change,
  checked against the workflow.
- **Phrases, not pixels.** NVDA's wording can change between releases; the tests only look for the
  app's own strings inside what it says, never for its exact sentence.

## What would change our mind

- Guidepup dropping NVDA or the `windows-2025` image, or the workflow failing on setup more than
  occasionally.
- The VoiceOver bug fixed: VoiceOver is what the iPhone users hear.
- `STACK.md` naming a screen-reader library of its own.

## See also

- [docs/specs/a11y-checks.md](../specs/a11y-checks.md)
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md) › Testing
- [0007](0007-adopt-core-rules.md) › Dependencies outside `STACK.md`
