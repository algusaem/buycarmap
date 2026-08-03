---
description: Full code review and quality checks on working changes
allowed-tools: Read, Grep, Glob, Bash(pnpm:*), Bash(npx:*), Bash(git:*), Edit, Task
---

You are performing a thorough code review on the current working changes. Work through each phase sequentially. Do NOT skip phases. Be direct: flag real problems, skip praise.

This is a single Next.js 16 / React 19 repo using **pnpm** (v11 — no `package-lock.json`; never use npm/yarn here). The authoritative conventions live in `CLAUDE.md` (Rules for Claude, UI Quality Bar, Testing) — treat those as the rubric, and the phases below as the checklist.

## Phase 1 — Scope

Run `git diff --name-only` and `git diff --cached --name-only` to identify all changed files. Read every changed file in full. If a changed file imports from or is consumed by nearby files, read those too for context.

## Phase 2 — Clean Code & Architecture

Review every changed file against these rules. Flag violations with file path and line number.

**Code quality:**
- KISS: no over-engineering, no speculative abstractions, no patterns "just in case"
- Single responsibility: components/functions do one thing
- Components exceeding ~250 lines should be split
- No unused variables, hooks, imports, or dead code
- Readability over cleverness — if it needs a comment to explain a one-liner, rewrite it
- Reuse components/hooks only when it genuinely reduces duplication, not preemptively
- No backwards-compatibility shims or `_unused` renames — delete what's unused

**React specifics:**
- No unnecessary `useEffect` (especially syncing derived state)
- Prefer `.map()` over `.forEach()`
- No render functions that return JSX — extract a real component; extract repeated JSX into private components in the same file
- Guard clauses over nested ifs; `await` over `.then()` chains
- **No raw `fetch` in components.** This project has NO data-fetching library — do NOT suggest adding TanStack Query/SWR. Request logic goes in a hook under `lib/hooks/*`; cross-cutting fetch helpers live in `lib/<source>/*` and `lib/geo/*`. Components consume hooks only.

**API / server actions:**
- API routes are for proxying/webhooks only; prefer server actions (`app/actions/`) for mutations. One folder per resource, one file per endpoint — no aggregated/barrel files.
- Validate input with Zod (`safeParse`); surface request errors via `toast.error`, not inline text.

## Phase 3 — TypeScript Strictness

Scan every changed file for type issues:
- No `any` or `unknown` — find concrete types
- `interface` over `type` for object shapes
- Reusable typings belong in `/interfaces`; small one-off typings stay in the component
- No over-typing trivial values (e.g. `const x: number = 5`)
- Function parameters and return types should be explicit when non-obvious
- Generic components should have constrained type parameters

## Phase 4 — Styling & Tailwind Consistency

Check every changed file for styling issues:
- Identify hardcoded magic values: inline `font-size`, `color`, `margin`, `padding`, `width`, `height`, `border-radius`, `gap`, `line-height`, percentages, pixel values
- For each magic value, check if an equivalent Tailwind utility class exists — if it does, flag it for replacement
- Verify that theme tokens (colors, spacing, font sizes) from the project's Tailwind config or design system are used instead of raw values
- No arbitrary paddings, margins, or positioning hacks
- No `absolute` positioning unless strictly required
- Layout should be responsive — check for fixed widths or missing breakpoints
- Respect the existing styling solution (Tailwind, Chakra, DaisyUI, Mantine — whatever the project uses)

## Phase 5 — Accessibility

Check changed components against these rules:
- Interactive elements: full keyboard support, visible `:focus-visible` rings
- Hit targets >= 24px (mobile >= 44px)
- Forms: correct `autocomplete`, `type`, `inputmode`; inline errors near fields; Enter submits
- Navigation: links use `<a>`/`<Link>`, not `<div onClick>`
- Destructive actions: confirmation or undo
- Icon-only buttons: `aria-label` present
- Status cues: not color-only; redundant signals (icons + text)
- Images: explicit dimensions to prevent CLS
- Empty/error/loading states: handled, no dead ends

Only flag accessibility issues in code that was actually changed or added.

## Phase 6 — Build & Test Verification

Run these sequentially and report results (fast checks first, slowest last):

1. `pnpm lint` — no warnings or errors.
2. `pnpm exec tsc --noEmit` — no type errors (includes test files).
3. `pnpm test` — the Vitest suite (unit + hook + integration + component + contract) must pass.
4. `pnpm build` — must complete (runs `prisma generate && next build`).

**End-to-end:** if the change touches a user-facing page/flow, the map, or auth, also run `pnpm test:e2e` (Playwright — needs browsers via `pnpm exec playwright install` and boots a dev server, so it's slower). Skip e2e for pure-logic or type-only changes. Do NOT run `test:visual` here (platform-specific baselines) or `test:contract:live` (hits real external APIs).

If any fail, list every error with file path and line number. Suggest specific fixes. Note: `pnpm test` here does not gate on new-test coverage — that's `/check-tests`.

## Output Format

For each phase, use this structure:

### Phase N — Title
**Status:** PASS | ISSUES FOUND

If issues found, list them as:
- `file/path.tsx:42` — Description of the issue and how to fix it
