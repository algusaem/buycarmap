---
description: Review working changes for the front end — route and list states, theme and styling, Motion, forms, user feedback, i18n and formatting, accessibility and interface guidelines
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git ls-files:*), Bash(git symbolic-ref:*), Bash(git rev-parse:*), Agent
---

Review the working changes for the **front end**. Follow `.claude/review-protocol.md` — read it first: it sets how to load the rules, the scope, the severities and the output.

**Owns:** `RULES.md` §9 (loading, error and empty states per route), §13, §15 (messages to the user), §17 (except keeping the existing visual patterns → `check-impeccable`), §18, §19; `STACK.md` §14. Design direction and quality — `STACK.md` §17 "Impeccable" — are `check-impeccable`'s.
**Applies to:** `src/app/**` pages, layouts, `loading.tsx`, `error.tsx`; `src/components/**`; client hooks; `globals.css`; `messages/` (next-intl).

Delegation (`CLAUDE.md` › Model delegation) — **The main session (Opus 5.5, high effort) is the mastermind, not the hands; `lacayo-sonnet` (Sonnet 5, high effort) and `lacayo-opus` (Opus 5.5, medium effort) are its hands.**
Run on its own, the main session does not review the front end itself, however capable it is of doing so:
- **The whole review → one `Agent` with `subagent_type: "lacayo-opus"`**, told it is the delegated agent and spawns no agents, and briefed with this file, `.claude/review-protocol.md`, the change set, the task in the user's words and the approvals the user gave, quoted; it returns the output of review protocol §7.
- **The mastermind** re-measures with its own eyes only the facts it will state (a quoted `file:line`, the changed files: single read-only commands), and writes the report; which findings get fixed is the user's decision when the check runs on its own (review protocol §6). The fixes the user asks for are dictated edits: direct for two or three steps in one file, `lacayo-sonnet` for anything longer.
Inside `/check-all` this paragraph does not apply: there the agent running this file is already the delegated hand. Close the report with the delegation line («Lacayos: N sonnet, M opus, K directos; reencargos: X»); a run with «0 opus» did not follow this command.

## 1. Route and list states (`RULES.md` §9, `STACK.md` §14)

- A new route without `loading.tsx`, `error.tsx` and an empty state → BLOCKER.
- Every list has loading (skeleton mirroring the final content, not a spinner), empty (with the primary action), error (with retry) and populated states. What their text says is `check-impeccable`'s.

## 2. Theme and styling (`RULES.md` §17)

- **Colours and styles only from the theme**: grep the changed files for hex values, `rgb(` / `hsl(` / `oklch(` outside `globals.css`, arbitrary Tailwind classes (`[#…]`, `[13px]`, `[…]`) and inline `style` with colours or sizes → BLOCKER. (A new theme colour needs approval: `check-process`.)
- Magic values (font-size, spacing, radius, widths) with an equivalent Tailwind utility or theme token → flag for replacement.
- shadcn primitives from `components/ui/` reused instead of hand-rolled equivalents.
- No arbitrary paddings or margins; no `absolute` unless strictly required; responsive — no fixed widths, no missing breakpoints.
- Modals only where a page wouldn't be the better UX.

## 3. Motion (`RULES.md` §17, §19 "Animation")

- Every conditionally rendered modal, dropdown, popover, panel or list item wrapped in `AnimatePresence` + `motion.*` (toasts excepted). A conditional mount with no animation → BLOCKER.
- `MotionConfig reducedMotion="user"` present at the root.
- Only `transform` / `opacity` animated, no `transition: all`, CSS transitions only for state changes (hover, focus, active).

## 4. Forms (`RULES.md` §13, §19 "Forms", `STACK.md` §14)

- React Hook Form + Zod, the same schema from the feature's `schema.ts` on client and server — a duplicated or hand-written schema → BLOCKER.
- Validate on blur; server errors mapped to the offending field; unsaved-changes guard on navigation.
- Correct `autocomplete`, `name`, `type`, `inputmode`; inline errors next to fields, first error focused on submit; Enter submits; submit enabled until the request starts, then spinner with the original label; paste never blocked.

## 5. Feedback and messages (`RULES.md` §15, `STACK.md` §14)

- Messages to the user carry no technical details (no exception messages, stack traces, internal codes).
- Channel: toast (Sonner) for background success, inline for validation — never a toast for a validation error — and a dialog for errors needing a decision.
- Destructive actions confirm naming the object; irreversible ones require typing it. Optimistic updates only where rollback is safe, never on monetary or irreversible actions → otherwise BLOCKER (`STACK.md` §14 makes it mandatory, above the SHOULD in `RULES.md` §19).

## 6. i18n, formatting and URL state (`STACK.md` §14)

- No hardcoded user-facing strings (next-intl), locale or timezone.
- Dates, numbers and currency through the shared `Intl` formatters — never an inline `toFixed`.
- URL state via nuqs; tables with sticky header, persisted column visibility, selection preserved across pagination, bulk actions behind confirmation.

## 7. Accessibility and interface guidelines (`RULES.md` §18, §19)

Walk `RULES.md` §18 and every subsection of §19 over each changed component. MUST/NEVER → BLOCKER, SHOULD → ISSUE — except the MUSTs only hands-on testing can prove (verifying on mobile, laptop and ultra-wide; measuring and profiling; re-render tracking; mutation latency): those go to Manual checks as pending, not BLOCKER. At minimum:

- Semantic HTML: `<button>` for actions, `<a>` / `<Link>` for navigation, never `<div onClick>`; native semantics before ARIA.
- Full keyboard support, visible `:focus-visible` rings, focus managed in dialogs.
- Every input with a label, every image with `alt` and explicit dimensions; icon-only buttons with `aria-label`; decorative elements `aria-hidden`.
- Hit targets ≥ 24px (mobile ≥ 44px); mobile inputs ≥ 16px font.
- Status cues not colour-only; no dead ends.
- `…` character, `tabular-nums` for compared numbers, text containers handle long content (`min-w-0`, `truncate`, `break-words`).

## 8. Flow to capture

For `check-visual`, which takes the screenshots the user confirms before committing (`RULES.md` §22 item 5). Add this section to your output: the numbered steps that show the result and the new or changed flow, each with the route, the role, the action, and the state the screenshot should show — the control before and after using it, what appears or disappears, the states the change adds (empty, error, selected, open…). Say which roles see it only on mobile or only on desktop. Base it on the spec's acceptance criteria and the changed components; list only what a user would see.

## 9. Manual checks

List what neither the tests nor the screenshots can show and still needs checking by hand: keyboard use and focus, screen reader, behaviour on a real device. You can't do them from here: they are **pending**, never "passed".

## Definition of done

Owns `RULES.md` §22 item 8 (route states). For item 5 it provides the flow `check-visual` captures and lists the manual checks as pending.
