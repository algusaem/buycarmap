# Navigation bar

Key: NAV
Status: Implemented
Last updated: 2026-10-13

The BuyCarMap 2.0 redesign replaced this bar on 2026-10-12: the headers, the phone bottom nav and
the language control are specified by [redesign-navigation.md](redesign-navigation.md) (HEAD). The
criteria that still hold are kept here, the amended ones point at the HEAD criterion that carries
them, and the withdrawn ones are marked. The prose below records the old bar as history.

---

## Problem

The navigation bar is a single flat row that every feature has added a control
to, and nothing has ever been taken out of. A signed-in user on a phone is
offered six controls inside 56 pixels: the theme toggle (an icon *and* the word
"Dark"), the language switcher (a globe and `EN / ES`), favorites, alerts,
account, and sign out. Nothing collapses, so they compete for a width that does
not exist.

Three consequences are already live:

- **A visitor on a phone cannot register from the navbar.** The sign-up button
  is `hidden sm:inline-flex`, so the primary conversion action of the product is
  simply absent on the devices most people arrive on. Sign in is the only door.
- **The controls are too small to hit.** The language switcher's `EN` and `ES`
  are bare text with no padding — a target of roughly 20×16 CSS pixels, against
  the 44px the project's own UI bar requires on mobile. Missing and hitting the
  neighbour is the normal outcome, and the neighbour is sometimes sign out.
- **You cannot tell where you are.** Nothing in the navbar reads the current
  route, so `/favorites` and `/alerts` look exactly like every other page, and
  the two icons that lead to them look exactly like each other.

Underneath those, the bar shifts on every page load: the session placeholder is
`h-8 w-16` and resolves into a row several times wider, so the whole navbar
reflows once the session arrives. This already caused screenshot flake — the
comment in `playwright.config.ts` records the visual tests racing "the navbar's
session placeholder".

Adding the next nav item to this row makes all four worse.

In scope: what the navigation bar offers, at every viewport: which
destinations a visitor and a signed-in user are given, how those collapse on a
phone, how the collapsed menu is opened, dismissed and navigated with a
keyboard, how the current page is indicated, and what the bar shows while the
session is still resolving.

## Acceptance criteria

The navbar accepts no user input beyond clicks, so there is no invalid-input
criterion; the equivalent negative paths are an unresolved session (NAV-8), a
session that ends underneath the user (NAV-16), and a signed-out visitor being
offered links to guarded pages (NAV-10).

- [x] NAV-1 · component — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): the menu sheet and the account dropdown are gone — every destination it offered signed out now lives in the header itself (HEAD-2, HEAD-5, HEAD-6).
- [x] NAV-2 · e2e — Every touch target on a phone viewport (header and bottom nav alike) is at least 44 by 44 pixels — becomes HEAD-15 (amended 2026-10-12, HEAD — redesign-navigation.md)
- [x] NAV-3 · component — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): the menu sheet is gone; saved cars, alerts and the account are top-level destinations in the pages header and the bottom nav (HEAD-3, HEAD-8).
- [x] NAV-4 · component — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): the menu sheet is gone, so there is no panel left to dismiss with Escape.
- [x] NAV-5 · component — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): the menu sheet is gone, so there is no panel left for a route change to close.
- [x] NAV-6 · component — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): sign-out moved to the account page (HEAD-13).
- [x] NAV-7 · component — The destination matching the current page is marked current, and no other is — becomes HEAD-4, in the pages header (amended 2026-10-12, HEAD — redesign-navigation.md)
- [x] NAV-8 · component — While the session is still resolving, neither the signed-in nor the signed-out destinations are offered — becomes HEAD-11 (amended 2026-10-12, HEAD — redesign-navigation.md)
- [x] NAV-9 · e2e — The header keeps the size it will have once the session resolves — becomes HEAD-11 (amended 2026-10-12, HEAD — redesign-navigation.md)
- [x] NAV-10 · component — A signed-out visitor is offered no link to saved cars or alerts, from any header
- [x] NAV-11 · component — Every navbar control, the menu trigger included, has an accessible name in the user's language
- [x] NAV-12 · component — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): the menu sheet is gone, so there is no panel left for the keyboard to open.
- [x] NAV-13 · e2e — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): the menu sheet and the account dropdown are gone; what each viewport offers is now HEAD-7 and HEAD-8.
- [x] NAV-14 · component — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): the menu sheet is gone; the language control lives in every header instead (HEAD-10).
- [x] NAV-15 · component — A signed-in user with no display name is identified by their email address — becomes HEAD-9 (amended 2026-10-12, HEAD — redesign-navigation.md)
- [x] NAV-16 · component — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): becomes HEAD-12.
- [x] NAV-17 · e2e — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): registration on a phone is reached through «Entrar»'s own page, not a bar control of its own.
- [x] NAV-18 · component — Withdrawn 2026-10-12 (docs/specs/redesign-navigation.md): the account dropdown is gone; language is a group of two buttons (HEAD-10), not a menu needing its own keyboard model.

## Worked examples

None: no criterion here is on the critical list (a permission boundary, or a bug fix).

## Data model

None: this feature adds or changes no table or column.

## Permissions

None: navbar visibility is user experience, not authorisation (NAV-10; see
Decisions › Hiding a link is user experience, not authorisation); `/favorites`
and `/alerts` are guarded server-side.

## Edge cases

- NAV-8 — the session is still resolving; no destinations are offered (now HEAD-11).
- NAV-9 — the header keeps its size while the session resolves (now HEAD-11).
- NAV-10 — a signed-out visitor is offered no link to guarded pages.
- NAV-15 — a signed-in user with no display name is identified by email (now HEAD-9).
- NAV-16 (withdrawn 2026-10-12) — the session ending while the menu was open; a session ending under
  any signed-in header is now HEAD-12.
- No invalid-input case: the navbar accepts no input beyond clicks (see Acceptance criteria).
- The map overlay covering the bar: see Decisions › The mobile map overlay is left alone.

## Out of scope

Out of scope, deliberately:

- **What the language control does.** Its behaviour is specified by
  [cross-cutting.md](cross-cutting.md) (CORE-5). This spec relocated it once, into the old bar's
  dropdown and menu sheet; since 2026-10-12 it is `components/nav/LanguageControl.tsx`, in every
  header, specified by [redesign-navigation.md](redesign-navigation.md) (HEAD-10). The theme control
  this bullet also covered is gone since 2026-10-12, with CORE-10 withdrawn
  ([redesign-foundation.md](redesign-foundation.md), LOOK-5).
- **Authorisation.** `/favorites` and `/alerts` are guarded server-side. This
  spec decides which links are *offered*, which is a different question — see
  Decisions and rationale.
- **The mobile map overlay.** When this spec was written, `MobileMapOverlay` covered the whole
  viewport including the bar. Since 2026-10-12 `/map` has no app header at phone width at all
  (HEAD-7).
- **The page content below the bar.** This spec changed no route, layout height or scroll
  behaviour; the old bar was a 56px flex item in a `h-screen` shell. The BuyCarMap 2.0 header heights
  are in [`DESIGN.md`](../../DESIGN.md) › Components › Navigation.
- **Search.** The search field lived in `ListingsHeader`, not the navbar. From F3 it is the map
  header's search pill and the phone's floating search, specified by
  [redesign-map.md](redesign-map.md).

## Contracts

No database involvement, no server actions, no routes, no environment variables.
What had to agree when the old bar was built (2026-09-28), and what changed since:

- **Two dependencies**: `@radix-ui/react-dialog` (the old mobile panel) and
  `@radix-ui/react-dropdown-menu` (the old desktop account menu), wrapped as
  sheet.tsx and dropdown-menu.tsx in `components/ui/`. The sheet and the dropdown they
  served are gone since 2026-10-12 (HEAD-14).
- **i18n keys, in both locales.** The current `nav` keys, and the ones removed with the menu
  (`nav.menu`, `nav.closeMenu`), are listed in
  [redesign-navigation.md](redesign-navigation.md) › Contracts. Spanish is the default locale, so an
  English-only key reaches most users — NAV-11 is what catches it.
- **`playwright.config.ts`.** The phone-viewport criteria used to run from navbar.spec.ts in the
  `mobile` project. That file was replaced in F2 by `e2e/navigation.spec.ts`.
- **The e2e "session has resolved" signal.** The e2e helpers once waited for the old bar's sign-out
  button, then its account trigger, to know hydration finished. They move to the new headers in F2
  (redesign-navigation.md › Contracts).
- **Visual baselines.** `e2e/visual.spec.ts` snapshots include the header and are regenerated when
  it changes. Baselines are per-platform, so this has to happen on a machine with the existing
  ones — CI stays green without them by design, which means a stale baseline fails locally and not
  in CI.
- **Ownership map.** The old bar's files (Navbar.tsx, NavMenu.tsx) had a row pointing here. Since
  2026-10-12 `components/nav/**` is mapped to [redesign-navigation.md](redesign-navigation.md), in
  the root [`README.md`](../../README.md) › Ownership map.

## Decisions and rationale

### Breakpoints stay in CSS; the menu's contents are mounted only when open

Replaced 2026-10-12 by [redesign-navigation.md](redesign-navigation.md): there is no menu or
dropdown left to mount on open (HEAD-14). The half that survives is that the desktop and phone
regions still switch at `lg` in CSS, not through a media-query hook, which would flash on hydration
because the server cannot know the viewport. That is why what each viewport offers is proved in e2e,
not in jsdom, which has no layout engine.

### Two existing Navbar tests will change, and that is a spec decision, not a fudge

History: in 2026-09 two tests of the flat row were amended because the dropdown deliberately
replaced the row they encoded. Both tests went with the old bar on 2026-10-12; the headers are tested
against the HEAD criteria instead.

### Saved cars and alerts stay visible; account and sign out do not

Replaced 2026-10-12 by [redesign-navigation.md](redesign-navigation.md): saved cars and alerts are
still top-level destinations (pages header and bottom nav, HEAD-3, HEAD-8), the account is behind
the avatar (HEAD-9), and sign-out lives on the account page (HEAD-13). The reasoning still holds:
frequent destinations stay one click away, and the one control with a consequence is kept away from
the bar.

### Hiding a link is user experience, not authorisation

NAV-10 says a signed-out visitor is offered no link to saved cars or alerts. It
would be a serious misreading to treat that as a security property. `useSession`
runs in the browser, the header is a client component, and anyone can type the
URL. The pages are guarded server-side and stay guarded.

The reason to hide the links is that they would be links to a sign-in redirect —
a dead end dressed as a destination. This is the same distinction `proxy.ts`
carries in the auth system, where the note is that it is UX and not
authorisation, and it is written here for the same reason: the criterion looks
like an access-control rule and is not one.

### The current page is announced, not merely coloured

NAV-7 (now HEAD-4) requires the active destination be *marked*, which means `aria-current`,
not only a different colour. Colour alone fails the project's own rule against
color-only status cues, and tells a screen reader nothing. It also gives the
test something to assert that is not a class name.

### The placeholder is sized to what replaces it

NAV-9 (now HEAD-11) exists because the old bar's `h-8 w-16` skeleton was not a placeholder for
anything — it was a different shape from the row it became, so the bar reflowed when the session
arrived. The project's UI bar requires skeletons to mirror final content, and
`playwright.config.ts` recorded the visual suite racing this exact placeholder.

**NAV-9 was restated during implementation, because the original could not fail.** It said "the bar
occupies the same height and the logo the same position", but the logo was pinned to the left edge
and could not move however badly the right-hand cluster reflowed. A first rewrite measured the menu
trigger, which only exists once the session has resolved, so both measurements were taken after the
swap. The version that held measured the cluster itself while it was still unresolved; against the
old placeholder it found a 61px sideways jump on every page load.

The lesson worth keeping is that the first two versions of this test passed
against code known to be broken. A layout assertion that names the wrong element
is indistinguishable from a passing one.

### Radix, rather than hand-rolling the panel

Replaced 2026-10-12 by [redesign-navigation.md](redesign-navigation.md): the panel and the dropdown
are gone (HEAD-14), so there is no focus trap or Escape handling left to choose a library for.

### Language moves into the dropdown

Replaced 2026-10-12 by [redesign-navigation.md](redesign-navigation.md) › Decisions › Language in
every header: the language control sits in every header (HEAD-10), not in a dropdown or a menu.

The theme toggle this decision first kept beside it is gone too: the BuyCarMap 2.0 design is dark
only ([redesign-foundation.md](redesign-foundation.md), LOOK-5).

### Registration is one tap on a phone, not two

Replaced 2026-10-12 by [redesign-navigation.md](redesign-navigation.md): NAV-17 is withdrawn. On a
phone the signed-out landing offers «Entrar», and registration is reached from its page (HEAD-7);
at desktop width the landing offers «Crear cuenta» directly (HEAD-5).

### The mobile map overlay is left alone

Replaced 2026-10-12 by [redesign-navigation.md](redesign-navigation.md): `/map` at phone width
shows no app header (HEAD-7), so there is no bar for the overlay to cover.

## Open questions

None. Three were raised while drafting the old bar and all three were settled; each is recorded in
Decisions and rationale, and each answer was later replaced by
[redesign-navigation.md](redesign-navigation.md) (2026-10-12):

- Language moved into the dropdown — now in every header (HEAD-10).
- A sign-up button stayed in the bar on mobile — withdrawn with NAV-17.
- NAV-9 was kept, with its cost acknowledged — it lives on as HEAD-11.
