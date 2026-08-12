# CLAUDE.md - BuyCarMap

## Project Overview

BuyCarMap aggregates second-hand car listings and displays them on an interactive map. Users search and filter by location, price, make/model, year, mileage, horsepower, fuel, transmission, and recency, then browse results as a synchronized card list + map.

What is and is not built is under **Current state** below. Everything else in this
file is a rule; the explanations live in `docs/`.

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript · PostgreSQL (Neon) via Prisma 7
with the **`@prisma/adapter-pg`** driver adapter · NextAuth 4 (JWT sessions) ·
React Hook Form + Zod 4 · Tailwind CSS 4 · Radix primitives wrapped in
`components/ui/*` · Motion · Sonner · next-themes · Leaflet + react-leaflet ·
Lucide React and React Icons.

Constraints that follow from it, and that a plausible-looking change will break:

- **No data-fetching library.** No TanStack Query, SWR or Redux. Hooks in
  `lib/hooks/*` own every request lifecycle. Adding one is a decision to raise,
  not to make — `docs/decisions/0001-no-data-fetching-library.md`.
- **pnpm 11 only.** There is no `package-lock.json`, deliberately.
- `@neondatabase/serverless` is a dependency, but Prisma connects through
  `@prisma/adapter-pg` with a plain `DATABASE_URL`. Do not "fix" this.
- The Prisma client is generated to `app/generated/prisma` — gitignored, and
  required before tests will even import.

Full detail: `docs/architecture.md`.

## Commands

```bash
# Package manager is pnpm (v11). Do not use npm/yarn — there is no package-lock.json.
pnpm dev              # Start dev server (next dev)
pnpm build            # prisma generate && next build
pnpm start            # next start
pnpm lint             # eslint
pnpm spec:check       # Assert every approved acceptance criterion still has a test
pnpm docs:check       # Assert doc links, referenced source paths and the ownership map resolve
pnpm test             # Vitest (unit + hook + integration + component + contract)
pnpm test:watch       # Vitest watch mode
pnpm test:coverage    # Vitest with v8 coverage
pnpm test:e2e         # Playwright end-to-end (needs a runnable app + browsers)
pnpm test:e2e:db      # DB-backed round trips — needs `pnpm db:branch` first. NOT in CI
pnpm test:visual      # Screenshot comparisons alone (baselines are per-platform)
pnpm test:contract       # Contract tests vs fixtures (offline)
pnpm test:contract:live  # Contract tests vs the real upstream APIs (all three sources)

pnpm db:branch        # Give the current git branch its own Neon database (see below)
pnpm db:branch:rm     # Delete this branch's Neon branch when the work is merged
```

> pnpm blocks dependency build/postinstall scripts by default. Packages allowed to run them are allowlisted in `pnpm-workspace.yaml` under `onlyBuiltDependencies` (currently prisma, `@prisma/engines`, msw, sharp, unrs-resolver). If you add a dependency with a native/build step and `pnpm install` reports `ERR_PNPM_IGNORED_BUILDS`, add it there.

> **A script that sets an env var inline must use `cross-env`.** `FOO=1 cmd` is
> POSIX syntax that cmd.exe does not understand, so the bare form works in CI
> (ubuntu) and silently fails on Windows with `'FOO' is not recognized`.

## Where things are

Reference material lives in `docs/`, not here. This file is rules; those files
are explanation. `docs/README.md` carries the index and the **ownership map**
(source glob → governing doc) that tells you which doc a change needs.

| To understand | Read |
| --- | --- |
| How the pieces fit, the search fan-out, the write path, the directory map | `docs/architecture.md` |
| The map components, design system, palette, theming, animation, i18n | `docs/frontend.md` |
| What each upstream actually does, and how it breaks | `docs/integrations/{wallapop,cochesnet,milanuncios}.md` |
| The eleven Prisma models and the migration rules | `docs/data-model.md` |
| Test levels, MSW conventions, the environment traps | `docs/testing.md` |
| Deploy, env vars, Neon branches, CI, runbooks | `docs/operations.md` |
| Authentication | `docs/auth.md`, then `docs/specs/auth-email-and-oauth.md` |
| Why something is the way it is | `docs/decisions/` |

**Verify against the code before asserting.** These docs are checked
mechanically by `pnpm docs:check` — links and referenced paths resolve — but no
script can prove prose is still true.

## Invariants

The handful of facts most likely to be broken by a reasonable-looking change.
Each is explained in the doc that owns it; they are repeated here because
breaking one is silent.

- **Never call an upstream marketplace from the browser.** CORS, CloudFront and
  bot protection all block it. Everything goes through `app/api/<source>/`.
- **Wallapop coordinates are always sent**, even with no location chosen —
  otherwise it geo-filters by the server's IP and a Spanish user gets US
  listings from Vercel. Invisible locally.
- **One shared filter set drives every source.** The UI builds a single
  `SearchInput`; each client translates it. Do not add a per-source filter UI.
- **coches.net and Milanuncios items carry no coordinates.** Their pins are
  city- or province-level approximations. Wallapop's are exact.
- **The merge post-filters by radius and model** (`applyResultFilters` in
  `lib/hooks/useListingsSearch.ts`). It looks redundant — "upstream already
  filters" — but only Wallapop enforces the radius and Milanuncios matches the
  model as free text. Removing it silently reverts to nationwide results
  (MAP-16..18). **Because that filter can empty a page**, the first search and
  `loadMore` both keep fetching until a round yields a listing or the sources
  run out — collapsing either loop back to one fetch strands the scroll and
  makes an empty first page permanent (MAP-19).
- **Never call `getServerSession` directly** — use `getCurrentUser()`. Only it
  honours revocation. `proxy.ts` is UX, not authorization.
- **Any flow that changes a password must bump `passwordChangedAt`**, or it
  signs nobody out.
- **All user-facing text goes through `t.*` keys** in both locales. The default
  locale is **`es`**, so a hardcoded English string reaches most users.
- **Errors are codes, not prose.** Server code cannot read the client i18n
  context.
- `lib/mock/listings.ts` is dead. Do not wire anything to it.

## Current state

Live sources: **Wallapop**, **coches.net**, **Milanuncios** — all proxied and
merged into one result set. Auth is complete: register, login, password reset,
account management, two-factor, optional OAuth. **Favorites are built** — model,
server actions, `/favorites`, and reconciliation into search results.

**Car alerts are built.** Saved criteria (deduplicated across users), a
Postgres queue drained by a GitHub Actions cron every five minutes, email
digests, `/alerts` and `/alerts/[id]`, one-click unsubscribe. The runner cannot
use `lib/*/client.ts` — those resolve URLs against `window.location.origin` —
so it goes through `lib/alerts/search.ts`. See `docs/specs/alerts.md`.

Not built, and not to be assumed: normalized `Car` listing persistence,
in-app notifications, web push.

## Spec-Driven Development

Feature work starts with a spec, not with code. The spec is the agreement about
*what* the software does; the tests prove it; the implementation follows. Full
conventions in `docs/specs/README.md`; adoption status in
`docs/sdd-adoption-plan.md`.

**The loop.** Write the spec from `docs/specs/_template.md` (Status `Draft`) →
get it approved (`Approved`) → write one **failing** test per acceptance
criterion → implement until green → fill in "Verified by" and set
`Implemented`.

**Criteria are identified, not just numbered.** Each spec declares a unique
`Key` of 2–8 uppercase letters; criteria are `KEY-1`, `KEY-2`, … and are
**append-only** — never renumber, because test titles point at those ids:

```ts
it("FAV-3: removes a listing from favorites when the button is toggled off", …)
```

`pnpm spec:check` (in CI, before the suite) fails when an approved criterion is
named by no test, or when a test names a criterion no spec declares. It proves
an id is *mentioned*, not that the assertion is meaningful — the `/check-tests`
quality bar is still what makes a test worth having.

**When a spec is required:** any change to observable behaviour — a feature, a
data source, a changed flow, a new failure mode. **Not required:** behaviour-
preserving refactors, dependency bumps, styling that changes no interaction, or
fixing a bug an existing criterion already forbids (that is a missing test, not
a missing spec).

**Changing behaviour means editing the spec first**, then the tests, then the
code. A spec that disagrees with the code is worse than no spec, because it is
trusted.

### How this triggers — Claude runs it, the user does not

**Do not wait to be asked for a spec.** When a request would change observable
behaviour, invoke `/spec` yourself as the first action, before reading further
into implementation and before writing any code. The user asking for a feature
*is* the request for a spec.

| The user says | Do this first |
| --- | --- |
| "add X", "build X", "I want users to be able to X" | `/spec X` — draft it, then stop and get it approved |
| "change how X works", "X should also do Y" | Open the governing spec, amend it, re-approve; then `/spec-tests` |
| "X is broken" | Find the criterion that forbids it. **Exists** → write the failing test, fix, no spec change. **Missing** → the spec has a hole: add a criterion, then fix |
| "refactor X", "rename X", "bump X" | No spec. Say so in one line and proceed |
| "why does X do Y?" | No spec. Answer the question |

After a spec is approved, invoke `/spec-tests` yourself — do not implement
straight from the spec. The tests come first or the process is theatre.

**Two rules that override the urge to be helpful:**

1. **Stop after drafting a spec.** Approval is the user's decision, and it is
   the only checkpoint in the loop where the cost of being wrong is still low.
   Drafting a spec and immediately implementing it defeats the entire point.
2. **When it is genuinely ambiguous whether something needs a spec, say which
   way you are going and why, in one sentence, then proceed.** Do not stall the
   work on a process question — but do not silently skip the spec either.

**Commands:** `/spec <feature>` drafts one; `/spec-tests <spec>` turns an
approved spec's criteria into failing tests. Both live in `.claude/commands/`.
They are Claude-invoked; the user may also call them directly.

This section is an instruction, not documentation. `pnpm spec:check` in CI is
the backstop that catches what gets missed — it cannot catch a feature built
with no spec at all, only a criterion that lost its test.

> All five specs are on the current template and enforced. `auth-email-and-oauth.md`
> predates it and was converted in Wave C: its criteria table is §0, ahead of the
> original prose. That layout is the exception, not a pattern to copy — new specs
> start from `_template.md`.

## Documentation

**Docs ship with the change, not after it.** `/check-all` has a documentation
phase and it runs before every commit — but do not wait for it. If a change
touches an upstream contract, an env var, a command, a Prisma model, a route, or
a bootstrap step, the doc that records it is part of the diff.

Know which artifact you are writing in — mixing them is how two sources of truth
start disagreeing:

| | Owns | Enforced by |
| --- | --- | --- |
| `docs/specs/` | What the software does, and why it is built that way | `pnpm spec:check` |
| `docs/` guides | How it fits together, how to run it, how to operate it | `/check-all` |
| `CLAUDE.md` | Rules an agent must follow | `/check` |

**Every fact lives in exactly one file; everywhere else links to it.** When a doc
and a spec would say the same thing, the doc links to the spec — the enforced
copy wins.

No doc is needed for an internal refactor with no observable surface, a
test-only change, styling that changes no interaction, or a dependency bump that
changes no command. Say which applies rather than staying silent about it.

`docs/README.md` carries the **ownership map**: source glob → governing doc. Read
it to answer "which docs does this change need?". Areas with no doc yet are
declared **—** there, and `pnpm docs:check` lists them on every run.

Plan and current progress: `docs/documentation-plan.md`. Most of the document set
is not written yet, so **a change may need a doc that does not exist** — write it
rather than filing it, then replace that area's **—** with the new doc and update
the plan's status table.

## Testing

Stack, levels, MSW conventions, the environment traps and the e2e setup are all
in `docs/testing.md`. **Read it before writing a test** — nearly every entry
there is a trap someone already fell into, and most of them cost an hour.

Rules, not explanation:

- **Colocate.** `foo.ts` → `foo.test.ts`. No `__tests__/` folders.
- **Opt into the node project by filename**: `*.node.test.ts` for route handlers,
  server actions and scripts. Everything else runs in jsdom.
- **MSW is the only way to fake network.** Never hand-stub `global.fetch`.
  `onUnhandledRequest: "error"` is on, so a stray request fails loudly.
- **Use `renderWithI18n`** from `test/utils/render.tsx` so labels are stable
  English. Without a provider, `useTranslation` falls back to Spanish.
- **Override only the field under test** in a fixture.
- **Hand-derive every expected value.** Computing the expectation the way the
  code does proves nothing.
- **Cover a negative path**: invalid input, empty result, upstream failure,
  unauthorised caller.
- **When a test is red, fix the production code, not the test** — unless the test
  itself was wrong.
- **Never lower a coverage threshold** to make a red build green.
- No tautological or self-fulfilling tests, and never mock the unit under test.
  The `/check-tests` bar is the real gate; `pnpm spec:check` only proves a
  criterion id is *mentioned*.

## Rules for Claude

### Worktrees and the dev database

**Never run `prisma migrate reset`, `prisma db push --force-reset`, or any command that drops or
recreates the database.** The Neon database holds real accounts and there is no seed script, so
"reset" rebuilds the schema with zero rows. Prisma offers it for bookkeeping problems that do not
need it — treat the offer as a bug report, not an instruction. A stale checksum is repaired with an
`UPDATE` on `_prisma_migrations`; see `docs/data-model.md`.

**Before any Prisma command or `pnpm dev` from a worktree, run `pnpm db:branch`.** It gives the
current git branch its own copy-on-write Neon branch and writes `DATABASE_URL` into that worktree's
`.env`. Do this first, unprompted, whenever starting on a new branch or worktree — it is idempotent,
so re-running just reuses the branch. Then:

```bash
pnpm install && pnpm exec prisma generate
```

`prisma generate` is easy to forget because nothing prompts for it: without `app/generated/prisma`,
four test files fail at *import* while every test that does run passes, which reads like an
unrelated breakage rather than a missing bootstrap step.

**This is enforced.** `scripts/require-branch-db.mjs` refuses database-touching commands from a
worktree with no branch database, wired to every Bash/PowerShell call by a `PreToolUse` hook in the
committed `.claude/settings.json`. If you see "Refusing to run", the fix is `pnpm db:branch` —
**never work around the guard.**

Why it is mandatory, and the two traps that follow from it, are in
`docs/getting-started.md` and `docs/data-model.md`.

### TypeScript

- Never use `any` or `unknown`
- Use `interface` instead of `type` (unions/utility types excepted)
- Reusable typings go in `/interfaces`; small non-reusable typings stay in the component
- Do not over-type trivial values

### Data Fetching (this project's actual pattern)

- **No data-fetching library is installed.** Do not add one without asking.
- Never call `fetch` directly inside a component. Extract request logic into a hook in `lib/hooks/*` (like `useListingsSearch`, `useCarModels`, `useLocationSearch`). Components consume hooks only.
- Cross-cutting fetch helpers (Wallapop client, filters, geocoding) live in `lib/wallapop/*` and `lib/geo/*`. Hooks call those, not raw endpoints.
- Surface request errors with `toast.error(...)`, not inline error text.
- Guard against out-of-order responses (version ref / `cancelled` flag) as existing hooks do.

### Server Actions & API

- **Prefer server actions over API routes** for mutations; place them in `app/actions/`.
- Validate input with Zod (`schema.safeParse()`); return typed `{ success, error?, data? }`. Never trust client validation alone.
- API routes only for proxying/external integrations (like the Wallapop proxies) or webhooks. One folder per resource, one file per endpoint. Never create aggregated/global API files.

### Forms

- Always React Hook Form + Zod; schemas in `lib/validations/` with exported inferred types (`auth.ts` → `loginSchema`/`registerSchema`, `search.ts` → `searchSchema`).
- Use `zodResolver`, inline field errors, and `isSubmitting` for loading state.

### Authentication

The system is documented in `docs/auth.md` (one-page orientation) and specified
in full in `docs/specs/auth-email-and-oauth.md`. **Read the spec before changing
anything here** — every property below is load-bearing and most are not obvious.

Rules, not explanation:

- **Never call `getServerSession` directly** — use `getCurrentUser()` from
  `lib/auth/session.ts`. Every server action touching user data must call it.
  `proxy.ts` only decodes the JWT and cannot see revocations, so it is UX, not
  authorization.
- **`authOptions` lives in `lib/auth/options.ts`**, never the route file —
  server components and actions import it, and pulling it from a route would
  drag the handler along.
- **Any flow that sets a password must call `validateNewPassword()`**
  (`lib/auth/password-policy.ts`) **and bump `passwordChangedAt`.** Skipping the
  second signs nobody out. The client strength meter is a hint; the server gate
  is what counts.
- **Password reset must not bypass 2FA**, and the email-change link must go to
  the **new** address with the current password required to start the change.
- **Return codes, never prose** (`AUTH_ERROR`). Forms resolve them with
  `translateAuthError(t, code)`; pass `setError` the raw code.
- **Do not add a scheduler.** Expired tokens are pruned opportunistically by
  `lib/auth/cleanup.ts`, the same way `lib/rate-limit.ts` prunes its rows.
- **Do not weaken enumeration resistance.** Identical responses, dummy-hash
  timing equalization, and bcrypt run *before* any existence check. Registration
  is verify-first when email is configured — `register` writes a
  `PendingRegistration`, never a `User`.
- **Do not change the TOTP parameters** (HMAC-SHA1, 6 digits, 30s step, ±1 step
  drift). They are what real authenticator apps assume.
- **Do not "fix" `allowDangerousEmailAccountLinking`** or the `signIn` callback's
  refusal to auto-link a new provider to a 2FA account, without reading the
  reasoning in `options.ts` first. Both look wrong and are not.

### Theming

- next-themes, `attribute="class"`, dark default, `.light` for light. Components using `useTheme` must wait for `mounted` (`lib/hooks/useMounted.ts`) to stay hydration-safe. Use CSS variables (`var(--...)`) for theme-aware styles.

### Toasts

- Sonner. `toast.success` / `toast.error`. Toaster is in the root layout; style via `classNames`, not inline styles.

### Icons

- Never raw SVGs. Lucide React for UI icons, React Icons for brand icons. Size with Tailwind (`h-4 w-4`).

### Animations

- Motion library (`import * as motion from "motion/react-client"`, `import { AnimatePresence } from "motion/react"`) over CSS animations for React components. Keep motion subtle, honor `prefers-reduced-motion`, animate only `transform`/`opacity`.
- Reuse the shared presets in `lib/animations.ts` (`fadeInUp`, `fadeInDown`, `scaleIn`, `fadeIn(delay)`, `slideInLeft(delay)`, `staggerContainer(delay)`, `buttonTap`) instead of re-declaring `initial`/`animate` inline.
- Theme switching uses the View Transitions API via `lib/hooks/useThemeTransition.ts` (expanding-circle clip-path from the click point) — use it rather than calling `setTheme` directly in the toggle.

### React & Components

- Avoid unnecessary `useEffect` (no effects purely to sync state). Prefer `.map` over `forEach`.
- Keep components single-responsibility; split beyond ~250 lines. Reuse only to remove real duplication, never preemptively.
- Do not refactor working code unless it improves correctness or clarity. No speculative abstractions.
- **Never use render functions that return JSX.** If logic produces markup, extract it into a proper React component with props — not a plain function called inside JSX.
- **Extract repeated JSX into private components:** when a pattern repeats within a component, extract it as a non-exported component in the same file.
- **Single code path over ternary branches:** prefer one JSX structure with conditional rendering (`{condition && …}`) over duplicating large blocks in a ternary.

### Code Style

- Readability over cleverness. No unused variables/hooks/imports. Never over-engineer.
- Use `await` — never `.then()` chains.
- **Guard clauses over nested ifs:** use early returns to flatten logic instead of deeply nested conditionals.
- **Only create what's asked for:** don't generate extra files, hooks, configs, or interfaces beyond what was explicitly requested.

### Styling & Layout

- Follow existing Tailwind patterns and the spacing system. Avoid absolute positioning unless necessary. All UI must be responsive.

### UX

- Prefer pages over modals unless a modal is clearly better UX.

### Communication

- Direct and concise. No emojis, filler, or motivational language. If something is a bad idea, say so.

## UI Quality Bar (MUST / SHOULD / NEVER)

### Interactions

- MUST: Full keyboard support ([WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)); visible focus rings (`:focus-visible`, group with `:focus-within`); manage focus (trap/move/return). NEVER `outline: none` without a replacement.
- MUST: Hit targets ≥24px (mobile ≥44px); expand hit area if visual is smaller. Mobile `<input>` font-size ≥16px. `touch-action: manipulation`. NEVER disable zoom (`user-scalable=no`, `maximum-scale=1`).

### Forms

- MUST: Hydration-safe inputs (no lost focus/value). NEVER block paste. Loading buttons show a spinner and keep their label. Enter submits; in `<textarea>` ⌘/Ctrl+Enter submits. Keep submit enabled until request starts. Accept free text, validate after. Errors inline; focus first error on submit. Correct `autocomplete`/`name`/`type`/`inputmode`. Trim values. Warn on unsaved changes. Compatible with password managers/2FA.

### State & Navigation

- MUST: URL reflects state (deep-link filters/tabs/pagination). Back/Forward restores scroll. Use `<a>`/`<Link>` for navigation (support Cmd/Ctrl/middle-click). NEVER `<div onClick>` for navigation.

### Feedback

- SHOULD: Optimistic UI, reconcile on response, rollback/Undo on failure. MUST: Confirm destructive actions or offer Undo. Polite `aria-live` for toasts/validation. Ellipsis `…` for follow-up options and loading states.

### Animation

- MUST: Honor `prefers-reduced-motion`. Animate compositor-friendly props (`transform`, `opacity`) only. NEVER animate layout props or use `transition: all`. Animations interruptible and input-driven. Correct `transform-origin`.

### Layout

- MUST: Deliberate alignment to grid/baseline/edges. Verify mobile, laptop, ultra-wide (test at 50% zoom). Respect safe areas (`env(safe-area-inset-*)`). Avoid unwanted scrollbars. Prefer flex/grid over JS measurement.

### Content & Accessibility

- MUST: Skeletons mirror final content (no layout shift). `<title>` matches context. No dead ends — always offer a next step. Design empty/sparse/dense/error states. `font-variant-numeric: tabular-nums` for compared numbers. Redundant status cues (not color-only). Icon-only buttons need descriptive `aria-label`. Prefer native semantics before ARIA. Use the `…` character (not `...`). Locale-aware dates/numbers (`Intl.*`). Non-breaking spaces for units/brands.

### Content Handling

- MUST: `truncate`/`line-clamp-*`/`break-words` for long content; flex children need `min-w-0` to truncate. Handle empty states (no broken UI for empty strings/arrays).

### Performance

- MUST: Track/minimize re-renders. Profile with throttling. Mutations target <500ms. Virtualize lists >50 items. Preload above-fold images, lazy-load the rest. Prevent CLS (explicit image dimensions). `preconnect` for CDN domains.

### Dark Mode & Theming

- MUST: `color-scheme: dark` on `<html>` for dark themes. `<meta name="theme-color">` matches page bg. Native `<select>`: explicit `background-color` and `color`.

### Design

- SHOULD: Layered shadows (ambient + direct); crisp edges via semi-transparent borders + shadows; nested radii (child ≤ parent); hue consistency (tint borders/shadows toward bg hue). MUST: Accessible/color-blind-friendly charts; meet contrast (prefer [APCA](https://apcacontrast.com/)); increase contrast on hover/active/focus.

## Scraping / Integration Guidelines

- Respect robots.txt and rate limits. Store raw data separately from normalized data. Handle deduplication across sources. Track listing freshness and availability. Cluster/limit markers and lazy-load detail where it helps performance.
