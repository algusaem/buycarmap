---
description: Review working changes for design and copy with Impeccable — slop in the UI and its text, direction against PRODUCT.md, DESIGN.md and the page briefs, existing visual patterns, setup, and Impeccable's design critique
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*)
---

Review the working changes for **design and copy**, with Impeccable. The question behind every section: does this look and read like a product someone decided, or like what an agent produces by default? Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

**Owns:** `STACK.md` §17 "Impeccable" (except its waivers → `check-process`; detector config and hook weakened → `check-tests`; running the detector → `check-verify`, inside `pnpm check`); `RULES.md` §17 "keep the existing visual patterns"; the quality of the UI copy; the design quality of the changed UI.
**Applies to:** `src/app/**` pages and layouts; `src/components/**`; `globals.css`; `messages/**` (next-intl) and any other user-facing string; `PRODUCT.md`, `DESIGN.md`, `.impeccable/**`, `.claude/skills/impeccable/**`, and the design hook in `.claude/settings.json`.

Not yours, even when Impeccable's own procedures cover it: accessibility, whether route and list states exist, Motion, forms, theme tokens and hardcoded values, technical details leaking into messages — all `check-front`'s. A problem there goes to "Outside my lane". What those states and messages *say* is yours.

## 1. Setup (`STACK.md` §17 "Impeccable")

Only when the change touches UI. Missing any of these → BLOCKER, unless the adoption ADR accepts it (then a NOTE citing it): the change can't be judged against context that doesn't exist.

- `impeccable` in `devDependencies` with an exact version; the skill in `.claude/skills/impeccable/` and the `impeccable-*` agents in `.claude/agents/`, tracked by git; `.claude/skills/impeccable/scripts/VERSION` equal to the `@impeccable/cli-*` version the pinned package declares.
- The design hook in the committed `.claude/settings.json` — only in `.claude/settings.local.json` doesn't count.
- `.impeccable/config.json` with `buildPath` `code`; the `.gitignore` block, plus `.impeccable/critique/`.
- `PRODUCT.md` at the root; `DESIGN.md` at the root once the project has a theme.
- A new surface (page or flow) has its brief in `.impeccable/surfaces/`, and its spec links it.
- Nothing from the "not without an ADR" list: `live` wiring (`.impeccable/live/config.json`), `buildPath` other than `code`, generated variants.

## 2. Context

Read `PRODUCT.md`, `DESIGN.md`, the brief of every surface the change touches, and the feature's spec — they say who reads this UI and in what voice. Then read, from the skill in `.claude/skills/impeccable/`: `SKILL.md`, `reference/craft-floor.md` (the visual slop list), `reference/clarify.md` (how interface text should work) and `reference/critique.md` (the review procedure). Read them; don't run them (section 7).

## 3. Slop (BLOCKER)

Walk the `STACK.md` §17 slop list over every changed component and every changed string — in `messages/**` for every locale, and anywhere else the user reads text: `alt`, `aria-label`, `title`, placeholders, toasts, emails. Also what the list doesn't name but works the same way: text that could sit in any product unchanged, decoration that carries no meaning, a layout picked because it's the default rather than because the content needs it.

Each hit → BLOCKER, unless the spec or the brief asks for that exact thing (cite it). Every finding names **what goes instead**, never just "improve it":

```
- **BLOCKER** `messages/en.json:14` — "Oops! Something went wrong 😕" → "We couldn't save the invoice. Check your connection and try again." — pep and an emoji where the user needs what failed and how to recover (STACK.md §17, slop: errors)
- **BLOCKER** `src/components/stats-header.tsx:22` — eyebrow "OVERVIEW" above "Your invoices" → delete the eyebrow; the heading carries itself — (STACK.md §17, slop: visual, craft-floor)
```

The replacement copy uses the product's own terms from `PRODUCT.md` and the surrounding UI, in the same locale and voice. If you can't write it without inventing a fact (what actually failed, what the next step is), say which fact is missing instead of guessing.

## 4. Direction (BLOCKER)

- The change contradicts `DESIGN.md` — its type scale, colour roles, spacing, components, its do's and don'ts — or `PRODUCT.md`'s constraints or voice, or the brief's mode and direction → BLOCKER.
- A new aesthetic direction the spec doesn't ask for — what `bolder`, `quieter`, `overdrive`, `colorize`, `delight` or `animate` produce, brutalist or any other new style, a new typographic voice — → BLOCKER. The existing visual patterns stay. (A new theme colour or token is also an APPROVAL: `check-process`.)
- The spec asks for a new direction, but `DESIGN.md` or the brief wasn't updated in the same change → BLOCKER.
- `PRODUCT.md`, `DESIGN.md` or a brief changed so they no longer match the code, or the change leaves them stale → BLOCKER.

## 5. Copy that works (ISSUE)

Beyond slop, `reference/clarify.md` over the changed text: vague labels and outcomes, the same concept named two ways, jargon the audience doesn't share, a heading and an intro that say the same thing, text that won't survive a longer translation. Each finding as in section 3 — `file:line`, the current text → the proposed text, and why — as an **ISSUE**.

## 6. Critique (ISSUE / NOTE)

Apply `reference/critique.md` to each changed surface: hierarchy, clarity, typography, layout and spacing rhythm, use of colour within the theme, fit to `PRODUCT.md`'s audience.

- Each finding is an **ISSUE**: `file:line`, what the user sees now → what it should be, why, and the Impeccable command that would get there (`/impeccable typeset` on the page header, `/impeccable distill` on the settings panel…) — as long as that command fits the task's scope and doesn't change the direction without the spec.
- Taste with no clear cost for the user → **NOTE**.
- Never BLOCKER: critique is judgement. A broken rule is section 3 or 4.

## 7. Limits

- Don't run the skill's commands, the detector or the app: `critique`, `audit` and `polish` write reports and screenshots under `.impeccable/` or edit code, and the detector runs in `pnpm check` (`check-verify`). Take their procedure by reading the skill.
- Don't ask the user the questions the skill would ask. A missing fact (a surface's mode, the audience) is reported as missing.

## Definition of done

Owns no `RULES.md` §22 item. Its BLOCKERs still make the change not ready, like any other check's.
