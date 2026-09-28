# RULES.md

Development rules for our web projects. `CLAUDE.md` imports this file, so it is in context in every
session; `/check-all` enforces it on every change, through the `check-*` reviews.

[`STACK.md`](STACK.md) (plus [`STACK-ERP.md`](STACK-ERP.md) in CRM/ERP projects) says what we use and
the code patterns; this file says how we work. They never contradict each other — if they seem to,
stop and raise it.

**Every rule is mandatory** unless it is marked SHOULD or phrased as a preference ("Prefer…",
"Avoid…"). The checks report a broken mandatory rule as a BLOCKER and a SHOULD as an ISSUE.

**Stack-bound sections.** §9, §11, §13, §14 and §16, and the tool names elsewhere (§1, §3, §7, §10,
§12, §15, §17, §20, §22 name ESLint, Prettier, Zod, Prisma, Sonner, Pino, Sentry, Vercel, Impeccable…), are
written for the stack in `STACK.md`. A project on another stack adapts them to its own equivalents when it
adopts this file — keeping each rule's intent (validate input on the server, authorize every entry
point, transactions around related writes, one validated env module, rate-limit sensitive actions) —
and says so in its adoption ADR. Every other section applies as written.

---

## 1. Stop and ask before continuing when

- A dependency is needed and `STACK.md` / `STACK-ERP.md` define no library for that purpose.
- Information is missing, ambiguous, or the spec has a gap. Never assume.
- The decision affects the business: flows, prices, permissions, customer data, functional scope.
- A colour, token or visual pattern is needed that the theme doesn't have.
- A database migration is destructive (dropping or renaming columns or tables, changing types with
  existing data) or not compatible with the previous version of the code.
- The change touches authentication, authorization, security headers or rate limiting.
- A new role or permission is needed, or who can do what changes.
- A new piece of personal data will be stored, or its retention is not defined.
- Personal data will be sent to an external service that didn't receive it before.
- CI, Git hooks, or the Biome, TypeScript or Vercel configuration must change.
- The Vitest or Playwright configuration, the coverage thresholds or exclusions, or the
  `package.json` scripts (especially `check` and `check:full`) must change.
- The Impeccable configuration (`.impeccable/config.json`) or its design hook must change.
- Files outside the task's scope must be touched.
- An escape hatch from §3 is needed, or raw SQL (§11).

An approval covers the case it was given for, not the next one.

## 2. When stuck

- If `pnpm check` keeps failing after several attempts at the same problem, stop. Explain what
  fails, what was tried and what the cause seems to be.
- No contrived workarounds to make verification pass. A detour that dodges the problem is worse
  than asking.

## 3. Prohibited

- Disabling, skipping (`.skip`, `.only`) or deleting tests to make the suite pass.
- Changing a test to fit incorrect code: when a test fails, the code gets fixed. The only exception
  is a spec change (§4). If a test looks wrong, stop and raise it.
- Weakening verification: removing steps from `check`, lowering coverage thresholds, excluding
  files from coverage or typecheck, relaxing Biome or TypeScript rules, disabling the
  Impeccable detector, a whole detector rule or its design hook.
- `any` and `as unknown as`, always.
- `@ts-ignore`, `@ts-expect-error`, `biome-ignore`, Impeccable waivers (`impeccable-disable`
  comments, detector ignores for a value or a file) and the non-null operator (`!`) without a
  comment or reason justifying why and prior approval.
- `git commit --no-verify` or any other way of skipping the hooks.
- Pushing directly to `main`.
- Editing migrations that were already applied. Every schema change is a new migration.
- Editing the `CHANGELOG` by hand (release-please generates it).
- `console.log` in application code (use Pino).
- Checking roles or permissions by hand outside the central permissions layer.
- Real data in seeds, fixtures or tests.
- Claiming something works without having run it. If it couldn't be verified, say so explicitly.

## 4. Methodology (SDD + TDD)

- Order, for every change — UI, CRUD and glue code included: spec in `docs/specs/` → failing
  tests → minimal code that makes them pass → refactor.
- Critical-path specs carry worked examples with exact values, and the tests use them. Every bug
  fix adds one: the input that failed and the correct result. If they are missing, ask for them —
  never invent expected values.
- If the spec doesn't cover a case, stop and ask (§1).
- If the spec changes: first the spec is updated, then the affected tests (which must fail), and
  last the code. It is the only case in which an existing test is modified.

## 5. Dependencies

- Before installing anything, check whether `STACK.md` / `STACK-ERP.md` define a library for that
  purpose. If they do, use it. If they don't, stop and ask (§1); once approved, it gets an ADR in
  `docs/decisions/`.
- Always install with pnpm.

## 6. Code

- Reuse before creating: search for existing functions, components, hooks or utilities that solve
  the same thing. Duplicating logic is forbidden.
- Apply the stack's good practices: strict typing, separation of responsibilities, no dead code.
- Security: never introduce changes that compromise the application, its users or their data —
  input validation, authorization, secrets out of the code, no sensitive data exposed.
- Only create what's asked for: no extra files, hooks, configs or interfaces beyond the task.
- Prefer readability over cleverness.
- No unused variables, hooks or imports.
- Avoid speculative abstractions. Never introduce patterns "just in case". Never over-engineer.
- Use `await` — never `.then()` chains.
- Guard clauses over nested ifs: early returns flatten the logic.
- Do not refactor working code unless it improves correctness or clarity.

## 7. TypeScript

- `any` is banned (§3). `unknown` only at boundaries — the error in a `catch`, the input of a
  parser (Zod, JSON, webhook payloads) — and narrowed right away; nowhere else.
- `interface` for object shapes; `type` only where an interface can't express it (unions, branded
  types, `z.infer`).
- Types for validated data come from Zod via `z.infer`, next to the schema in `schema.ts` — never
  a hand-written duplicate.
- Other reusable typings go in `/interfaces`. Small, non-reusable typings stay in the component.
- Do not over-type trivial values.

## 8. React and components

- Avoid unnecessary `useEffect`. Never add effects just to sync state unless required.
- Prefer `.map` over `forEach`.
- Never use render functions that return JSX. If logic produces markup, extract it into a proper
  React component with props — not a plain function called inside JSX.
- Extract repeated JSX into a non-exported component in the same file.
- Single code path over ternary branches: one JSX structure with conditional rendering
  (`{condition && …}`) rather than two large blocks in a ternary.
- Keep components focused on a single responsibility. Split them for readability, especially past
  250 lines.
- Extract a shared component only when it removes real duplication, not preemptively.
- State logic (especially several states) goes in custom hooks in `/hooks`. Components consume
  hooks; they don't manage request lifecycle. A single trivial `useState` can stay in the component.

## 9. Next.js and data access

- Server Components by default. `"use client"` only when interactivity is needed, and on the
  smallest possible component.
- Reads happen in Server Components through `src/server/<feature>/queries.ts`. Mutations go
  through Server Actions in `src/server/<feature>/actions.ts`.
- Reading data from a Client Component through a Server Action only when justified (search,
  incremental loading). Server Actions run serially and are not cached.
- Never `fetch` or Prisma inside components; never TanStack Query or `useEffect` for server data.
- Route handlers only where a Server Action doesn't work: webhooks, health checks, Better Auth
  routes and the public API (`STACK.md` §13). One folder per resource, one file per endpoint.
- Every Server Action and route handler validates its input with Zod and checks authentication and
  authorization on the server, always. Never trust client-side checks: a Server Action is a public
  endpoint even without a visible URL.
- Business logic lives only in `service.ts` — never duplicated across queries, actions or
  components.
- Server code: one folder per feature under `src/server/` (`queries.ts`, `actions.ts`,
  `service.ts`, `schema.ts`). Never aggregated or global files (`brands.ts`, barrel `index.ts`).
- Every new route has its loading, error and empty states (`loading.tsx`, `error.tsx`, empty state
  in the UI).

## 10. Authorization

- Every permission check goes through the central permissions layer —
  `can(user, action, resource)` in `src/lib/auth/permissions.ts`.
- Permissions also filter queries: the user only receives the data they may see. Filter in the
  query, not after fetching the data.
- Every protected Server Action or route handler has an integration test verifying that a user
  without permission is rejected (authorization error in Server Actions, 403 in route handlers).
- Every permission-filtered query has an integration test verifying that a user doesn't receive
  data they may not see.

## 11. Data (Prisma)

- Database access only through Prisma and the single database access module (`src/lib/db/`).
  Never instantiate `PrismaClient` or a driver adapter anywhere else.
- Raw SQL only when justified and approved.
- Select only the fields needed (`select`); never return full models with sensitive data to the
  client.
- Avoid N+1 queries (`include` or grouped queries).
- Operations that modify several related tables run inside a transaction.
- Schema changes: migration generated locally with `prisma migrate dev` and committed. Outside
  local, only `prisma migrate deploy`, which the Vercel build runs.
- Every migration is compatible with the previous version of the code, because production applies
  it before the new code is live. Expand/contract:
  - First add (new column nullable or with a default, new table) and move the code onto it.
  - Dropping or renaming the old one goes in a later PR, once no deployed code uses it.
- Update the seeds when the schema change requires it.

## 12. Personal data (GDPR)

- Collect only the personal data the feature needs.
- Every personal field is recorded in `docs/privacy/data-inventory.md` (model, field, purpose,
  retention).
- The application can export and delete (or anonymize) a person's data. Every schema change that
  adds personal data updates the export, the deletion, the inventory and Pino's `redact` paths.
- The client defines retention. If it isn't defined, stop and ask.
- Never send personal data to external services (Sentry, logs, Cloudinary…) unless the feature
  can't work without it. Sentry with `sendDefaultPii: false`. If an external service starts
  receiving personal data, update `docs/privacy/processors.md`.

## 13. Forms and validation

- React Hook Form + Zod. The same Zod schema is used on the client and the server.
- Schemas live in one shared place — the feature's `schema.ts` — never duplicated.

## 14. Environment variables

- Every new variable is declared in the `@t3-oss/env-nextjs` schema and added to `.env.example`
  with an example value.
- Never read `process.env` outside that schema.
- If the variable must be set in Vercel, say so in the PR description.

## 15. Errors and logging

- Logging only with Pino. Never log passwords, tokens or personal data.
- Never silence errors (empty `catch`). Every error is handled, logged or propagated.
- Unexpected errors reach Sentry.
- Messages to the user never carry internal technical details. Toasts use Sonner; which channel
  applies — toast, inline or dialog — follows `STACK.md` §14 (never a toast for a validation
  error).

## 16. Rate limiting

- Server Actions and route handlers that send emails, upload files or are sensitive carry rate
  limiting with `@upstash/ratelimit`.
- Better Auth's rate limiting uses Upstash Redis, never in-memory storage.

## 17. UI

- Colours and styles only from the theme in `globals.css` (Tailwind). No hardcoded values (hex,
  `rgb`, arbitrary classes like `[#…]`). A new colour is added to the theme, after approval (§1).
- Keep the existing visual patterns. No new styles without asking.
- Every element that appears or disappears (modals, dropdowns, conditional lists…) is animated
  with Motion (`AnimatePresence` + `motion.*`). Exception: toasts, which Sonner already animates.
- Respect `prefers-reduced-motion` (`MotionConfig reducedMotion="user"`).
- Responsive design: check it on mobile and desktop.
- Never absolute positioning unless strictly necessary.
- No arbitrary paddings or margins; keep a logical, consistent spacing system.
- Prefer pages over modals unless a modal is clearly the better UX.

## 18. Accessibility

- Semantic HTML (buttons are `<button>`, links are `<a>`).
- Every interactive element is usable with the keyboard and has visible focus.
- Every input has its label, every image its `alt`.
- The detailed rules are in §19.

## 19. Interface guidelines

Concise rules for building accessible, fast, delightful UIs, marked MUST / SHOULD / NEVER.

### Keyboard

- MUST: Full keyboard support per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
- MUST: Visible focus rings (`:focus-visible`; group with `:focus-within`)
- MUST: Manage focus (trap, move, return) per APG patterns
- NEVER: `outline: none` without visible focus replacement

### Targets & Input

- MUST: Hit target ≥24px (mobile ≥44px); if visual <24px, expand hit area
- MUST: Mobile `<input>` font-size ≥16px to prevent iOS zoom
- NEVER: Disable browser zoom (`user-scalable=no`, `maximum-scale=1`)
- MUST: `touch-action: manipulation` to prevent double-tap zoom
- SHOULD: Set `-webkit-tap-highlight-color` to match design

### Forms

- MUST: Hydration-safe inputs (no lost focus/value)
- NEVER: Block paste in `<input>`/`<textarea>`
- MUST: Loading buttons show spinner and keep original label
- MUST: Enter submits focused input; in `<textarea>`, ⌘/Ctrl+Enter submits
- MUST: Keep submit enabled until request starts; then disable with spinner
- MUST: Accept free text, validate after—don't block typing
- MUST: Allow incomplete form submission to surface validation
- MUST: Errors inline next to fields; on submit, focus first error
- MUST: `autocomplete` + meaningful `name`; correct `type` and `inputmode`
- SHOULD: Disable spellcheck for emails/codes/usernames
- SHOULD: Placeholders end with `…` and show example pattern
- MUST: Warn on unsaved changes before navigation
- MUST: Compatible with password managers & 2FA; allow pasting codes
- MUST: Trim values to handle text expansion trailing spaces
- MUST: No dead zones on checkboxes/radios; label+control share one hit target

### State & Navigation

- MUST: URL reflects state (deep-link filters/tabs/pagination/expanded panels)
- MUST: Back/Forward restores scroll position
- MUST: Links use `<a>`/`<Link>` for navigation (support Cmd/Ctrl/middle-click)
- NEVER: Use `<div onClick>` for navigation

### Feedback

- SHOULD: Optimistic UI where rollback is safe — never on monetary or irreversible actions; reconcile on response; on failure rollback or offer Undo
- MUST: Confirm destructive actions or provide Undo window
- MUST: Use polite `aria-live` for toasts/inline validation
- SHOULD: Ellipsis (`…`) for options opening follow-ups ("Rename…") and loading states ("Loading…")

### Touch & Drag

- MUST: Generous targets, clear affordances; avoid finicky interactions
- MUST: Delay first tooltip; subsequent peers instant
- MUST: `overscroll-behavior: contain` in modals/drawers
- MUST: During drag, disable text selection and set `inert` on dragged elements
- MUST: If it looks clickable, it must be clickable

### Autofocus

- SHOULD: Autofocus on desktop with single primary input; rarely on mobile

### Animation

- MUST: Elements that appear or disappear animate with Motion (§17); CSS transitions only for state changes (hover, focus, active)
- MUST: Honor `prefers-reduced-motion` (§17)
- MUST: Animate compositor-friendly props (`transform`, `opacity`) only
- NEVER: Animate layout props (`top`, `left`, `width`, `height`)
- NEVER: `transition: all`—list properties explicitly
- SHOULD: Choose easing to match the change (size/distance/trigger)
- MUST: Animations interruptible and input-driven (no autoplay)
- MUST: Correct `transform-origin` (motion starts where it "physically" should)
- MUST: SVG transforms on `<g>` wrapper with `transform-box: fill-box`

### Layout

- SHOULD: Optical alignment; adjust ±1px when perception beats geometry
- MUST: Deliberate alignment to grid/baseline/edges—no accidental placement
- SHOULD: Balance icon/text lockups (weight/size/spacing/color)
- MUST: Verify mobile, laptop, ultra-wide (simulate ultra-wide at 50% zoom)
- MUST: Respect safe areas (`env(safe-area-inset-*)`)
- MUST: Avoid unwanted scrollbars; fix overflows
- SHOULD: Flex/grid over JS measurement for layout

### Content & Accessibility

- SHOULD: Inline help first; tooltips last resort
- MUST: Skeletons mirror final content to avoid layout shift
- MUST: `<title>` matches current context
- MUST: No dead ends; always offer next step/recovery
- MUST: Design empty/sparse/dense/error states
- SHOULD: Curly quotes (" "); avoid widows/orphans (`text-wrap: balance`)
- MUST: `font-variant-numeric: tabular-nums` for number comparisons
- MUST: Redundant status cues (not color-only); icons have text labels
- MUST: Accessible names exist even when visuals omit labels
- MUST: Use `…` character (not `...`)
- MUST: `scroll-margin-top` on headings; "Skip to content" link; hierarchical `<h1>`–`<h6>`
- MUST: Resilient to user-generated content (short/avg/very long)
- MUST: Locale-aware dates/times/numbers (`Intl.DateTimeFormat`, `Intl.NumberFormat`)
- MUST: Accurate `aria-label`; decorative elements `aria-hidden`
- MUST: Icon-only buttons have descriptive `aria-label`
- MUST: Prefer native semantics (`button`, `a`, `label`, `table`) before ARIA
- MUST: Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names

### Content Handling

- MUST: Text containers handle long content (`truncate`, `line-clamp-*`, `break-words`)
- MUST: Flex children need `min-w-0` to allow truncation
- MUST: Handle empty states—no broken UI for empty strings/arrays

### Performance

- SHOULD: Test iOS Low Power Mode and macOS Safari
- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid reflows/repaints
- MUST: Mutations (`POST`/`PATCH`/`DELETE`) target <500ms
- SHOULD: Prefer uncontrolled inputs; controlled inputs cheap per keystroke
- MUST: Virtualize large lists (>50 items)
- MUST: Preload above-fold images; lazy-load the rest
- MUST: Prevent CLS (explicit image dimensions)
- SHOULD: `<link rel="preconnect">` for CDN domains
- SHOULD: Critical fonts: `<link rel="preload" as="font">` with `font-display: swap`

### Dark Mode & Theming

- MUST: `color-scheme: dark` on `<html>` for dark themes
- SHOULD: `<meta name="theme-color">` matches page background
- MUST: Native `<select>`: explicit `background-color` and `color` (Windows fix)

### Hydration

- MUST: Inputs with `value` need `onChange` (or use `defaultValue`)
- SHOULD: Guard date/time rendering against hydration mismatch

### Design

- SHOULD: Layered shadows (ambient + direct)
- SHOULD: Crisp edges via semi-transparent borders + shadows
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: tint borders/shadows/text toward bg hue
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrast.com/) over WCAG 2
- MUST: Increase contrast on `:hover`/`:active`/`:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid dark color gradient banding (use background images when needed)

## 20. Testing

- Unit tests in the Vitest `unit` project: no database, no Docker, no network.
- Tests that need the database in the `integration` project (Testcontainers).
- External APIs mocked with MSW.

## 21. Git

- Commits in Conventional Commits format, small and with a single purpose.
- The PR title also follows Conventional Commits, because it is the commit that reaches `main`
  with the squash merge.
- One branch per task, always through a PR.

## 22. Definition of done

A task is NOT done until all of the following hold.

**Spec and tests**

1. The spec covers the change and is up to date.
2. Tests added or updated to cover the change, including edge cases, error cases and the rejection
   of users without permission.
3. If the change affects a user flow, it has an E2E test. If it touches UI, it passes the
   accessibility tests.

**Verification**

4. `pnpm check` passes locally. If the change touches UI or user flows, `pnpm check:full` too.
5. UI changes: Playwright screenshots of the result and of every step of the new or changed flow,
   on mobile and desktop, reviewed and confirmed by the user before committing. What screenshots
   can't show (keyboard use, screen reader) is checked by hand. Anything that couldn't be verified
   is stated explicitly.
6. CI green, including the E2E workflow against the preview.

**Quality**

7. No dead code, no `console.log`, no `TODO` without an issue.
8. New routes have loading, error and empty states.
9. No rule in §3 broken.

**Data**

10. Schema change: new migration, compatible with the previous version of the code, and seeds
    updated.
11. New personal data: inventory, export, deletion and Pino `redact` updated, and retention
    defined.
12. New environment variables in the schema and in `.env.example`.

**Docs and delivery**

13. `docs/` updated. An ADR if there is an architectural decision.
14. PR titled in Conventional Commits, with the template's checklist completed.
15. The PR description includes a summary for the reviewer:
    - What changes and why.
    - How it was verified.
    - What couldn't be verified.
    - Decisions taken and open questions.
    - Manual actions needed (variables in Vercel, configuration in providers).
