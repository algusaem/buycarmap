# Spec: Navigation bar

Key: NAV
Status: Implemented
Last updated: 2026-08-05.

---

## 1. Problem

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

## 2. Scope

**In scope.** What the navigation bar offers, at every viewport: which
destinations a visitor and a signed-in user are given, how those collapse on a
phone, how the collapsed menu is opened, dismissed and navigated with a
keyboard, how the current page is indicated, and what the bar shows while the
session is still resolving.

**Out of scope, deliberately:**

- **What the theme and language controls do.** `ThemeSwitcher` and
  `LanguageSwitcher` are specified by [cross-cutting.md](cross-cutting.md)
  (CORE-5, CORE-10). This spec relocates them; it does not change their
  behaviour, and their existing tests render them directly, so those criteria
  are unaffected.
- **Authorisation.** `/favorites` and `/alerts` are guarded server-side. This
  spec decides which links are *offered*, which is a different question — see
  §4.
- **The mobile map overlay.** `MobileMapOverlay` covers the whole viewport
  including the navbar, and continues to. Its relationship to the menu is
  recorded in §4 but no behaviour changes.
- **The page content below the bar.** No route, layout height or scroll
  behaviour changes; the bar stays a 56px flex item in a `h-screen` shell.
- **Search.** The search field lives in `ListingsHeader`, not the navbar, and
  stays there.

## 3. Acceptance criteria

The navbar accepts no user input beyond clicks, so there is no invalid-input
criterion; the equivalent negative paths are an unresolved session (NAV-8), a
session that ends underneath the user (NAV-16), and a signed-out visitor being
offered links to guarded pages (NAV-10).

| AC | Statement | Level | Verified by |
| --- | --- | --- | --- |
| NAV-1 | Opening the menu while signed out offers both signing in and registering | component | `components/Navbar.test.tsx` |
| NAV-2 | Every navbar control on a phone viewport has a touch target of at least 44 by 44 pixels | e2e | `e2e/navbar.spec.ts` (bar + opened menu) |
| NAV-3 | Opening the menu while signed in offers saved cars, alerts, the account page and sign out | component | `components/Navbar.test.tsx` |
| NAV-4 | Dismissing the menu with Escape closes it and returns focus to the control that opened it | component | `components/Navbar.test.tsx` |
| NAV-5 | Following a link from the menu closes the menu, so the panel does not cover the page just navigated to | component | `components/Navbar.test.tsx` |
| NAV-6 | Signing out from the menu ends the session and returns the user to the home page | component | `components/Navbar.test.tsx` |
| NAV-7 | The navbar marks the destination matching the current page as current, and marks no other | component | `components/Navbar.test.tsx` |
| NAV-8 | While the session is still resolving, neither the signed-in nor the signed-out destinations are offered | component | `components/Navbar.test.tsx` |
| NAV-9 | The control cluster occupies the same box, and the bar the same height, before and after the session resolves | e2e | `e2e/navbar.spec.ts` |
| NAV-10 | A signed-out visitor is offered no link to saved cars or alerts, from the bar or the menu | component | `components/Navbar.test.tsx` |
| NAV-11 | Every navbar control, the menu trigger included, has an accessible name in the user's language | component | `components/Navbar.test.tsx` (Spanish render) |
| NAV-12 | The menu opens from the keyboard alone and moves focus into itself when it does | component | `components/Navbar.test.tsx` |
| NAV-13 | A phone viewport is not offered the full control row, and a desktop viewport is not offered the menu trigger | e2e | `e2e/navbar.spec.ts` |
| NAV-14 | The theme and language controls are reachable from the menu on a phone | component | `components/Navbar.test.tsx` |
| NAV-15 | A signed-in user with no display name is identified by their email address | component | `components/Navbar.test.tsx` |
| NAV-16 | A session ending while the menu is open stops the menu offering signed-in destinations | component | `components/Navbar.test.tsx` |
| NAV-17 | A signed-out visitor is offered registration without having to open the menu first | e2e | `e2e/navbar.spec.ts` |
| NAV-18 | The language can be chosen from the account menu using the keyboard alone | component | `components/Navbar.test.tsx` |

## 4. Decisions and rationale

### Breakpoints stay in CSS; the menu's contents are mounted only when open

The obvious way to build this is a `useMediaQuery` hook that returns "mobile" or
"desktop" and renders one tree or the other. It is also the way that quietly
breaks the test suite, and the reason is worth writing down because it is
invisible from the code.

jsdom has no layout engine, so Tailwind's `lg:hidden` and `hidden lg:flex` do
nothing there — every branch renders. A navbar that emits a mobile tree *and* a
desktop tree therefore emits every link twice, and `getByRole("link", { name:
/saved cars/i })` stops resolving. That is not hypothetical: it is exactly the
query FAV-17 uses in `components/Navbar.test.tsx` today, and it would start
failing on a change that alters no behaviour at all.

The way out is not a media-query hook — which would fix the duplication by
introducing a hydration flash, since the server cannot know the viewport — but
the Radix primitives' own behaviour. A `Dialog` mounts its content only while
open, and so does a `DropdownMenu`. So: visibility of the *triggers* is CSS
(`lg:hidden` on the menu button, `hidden lg:flex` on the row), and the panels
contribute nothing to the DOM until opened. A closed navbar in jsdom renders one
copy of each link. Tests that open the menu scope their queries with
`within(screen.getByRole("dialog"))`, which is the normal way to handle this and
does not need explaining twice.

The cost is that "hidden at this width" is not provable in jsdom at all — hence
NAV-13 being e2e, run under Playwright's existing `mobile` project. That is the
right trade: one slow test for the one property that genuinely needs a viewport,
rather than a hook that makes fifteen fast tests possible and the rendered
output worse.

### Two existing Navbar tests will change, and that is a spec decision, not a fudge

Moving account and sign out behind a dropdown trigger means they are absent from
the DOM until it is opened. Two tests in `components/Navbar.test.tsx` currently
assert them present without opening anything:
`"shows the user's name and signs out on click when logged in"` and the loading
test's `queryByRole("button", { name: /sign out/i })`.

The project rule is that a red test gets the production code fixed, not the
test. The exemption is a test whose *expectation* was wrong, and that is what
this is: the expectation encodes the flat row, which is the thing being
deliberately replaced. Recording it here is what makes it a decision rather than
a convenient reinterpretation of the rule six weeks from now. The name stays
visible on the trigger itself, so `getByText("Ada Lovelace")` is unaffected.

FAV-17 survives untouched, because saved cars and alerts stay top-level links on
desktop — see below.

### Saved cars and alerts stay visible; account and sign out do not

The dropdown could swallow all four. It should not. Favorites and alerts are
destinations a user goes to repeatedly and the whole reason they signed in;
burying a frequent destination one click deeper to tidy a row is a trade against
the user in favour of the layout.

Account and sign out are different: rarely used, and sign out is the one control
in the bar with a consequence. It currently sits immediately beside the account
link at 32px tall, which means the failure mode of a mistap on the thing you
visit rarely is being logged out. Moving it behind a deliberate open is the
point of the change, not a side effect.

### Hiding a link is user experience, not authorisation

NAV-10 says a signed-out visitor is offered no link to saved cars or alerts. It
would be a serious misreading to treat that as a security property. `useSession`
runs in the browser, the navbar is a client component, and anyone can type the
URL. The pages are guarded server-side and stay guarded.

The reason to hide the links is that they would be links to a sign-in redirect —
a dead end dressed as a destination. This is the same distinction `proxy.ts`
carries in the auth system, where the note is that it is UX and not
authorisation, and it is written here for the same reason: the criterion looks
like an access-control rule and is not one.

### The current page is announced, not merely coloured

NAV-7 requires the active destination be *marked*, which means `aria-current`,
not only a different colour. Colour alone fails the project's own rule against
color-only status cues, and tells a screen reader nothing. It also gives the
test something to assert that is not a class name.

### The placeholder is sized to what replaces it

NAV-9 exists because the current `h-8 w-16` skeleton is not a placeholder for
anything — it is a different shape from the row it becomes, so the bar reflows
when the session arrives and the logo moves. The project's UI bar requires
skeletons to mirror final content, and there is direct evidence of the cost:
`playwright.config.ts` records the visual suite racing this exact placeholder.

**NAV-9 was restated during implementation, because the original could not
fail.** It said "the bar occupies the same height and the logo the same
position". The bar is `justify-between`, so the logo is pinned to the left edge
and cannot move however badly the right-hand cluster reflows — the assertion was
true of the broken code too. A first rewrite was no better: it measured the menu
trigger, but waiting for that trigger to exist blocks until the session has
already resolved, so both measurements were taken after the swap.

What it measures now is the cluster itself, located by the `aria-hidden` it
genuinely carries while unresolved, with the loading state asserted first to pin
the measurement to the right moment. Falsified against the old `h-8 w-16`
placeholder: 64px against 125.6px, a 61px sideways jump on every page load.

The lesson worth keeping is that the first two versions of this test passed
against code known to be broken. A layout assertion that names the wrong element
is indistinguishable from a passing one.

### Radix, rather than hand-rolling the panel

Neither `@radix-ui/react-dialog` nor `@radix-ui/react-dropdown-menu` is
installed. Adding them is in-pattern — the stack is already "Radix primitives
wrapped in `components/ui/*`" and four Radix packages are present — and the
alternative is hand-writing a focus trap, Escape handling, restoration of focus,
`aria-expanded` wiring and scroll locking, which is a large amount of subtle
code that NAV-4 and NAV-12 would then be testing for the first time in this
codebase. Two dependencies is the cheaper side of that trade by a wide margin.

### The theme toggle stays in the bar; language does not

Only language moves into the desktop dropdown. Theme is the control people
actually reach for, and it carries a deliberate View Transitions animation —
burying a thing built to be enjoyed behind a menu is a poor trade for a tidier
row. Language is the opposite: set once, then never touched again for the life
of the account.

The theme control drops its `Dark` / `Light` text label **in the desktop bar
only**, where it sits beside an icon already saying the same thing. Inside the
menu it keeps the label: on a phone both controls move there (NAV-14), and a
panel has room a 56px bar does not.

That split is why `ThemeSwitcher` gains a `showLabel` prop rather than losing
the label outright. Losing it outright would also break CORE-10's second test in
[cross-cutting.md](cross-cutting.md), which asserts the button's text content —
and that criterion is about switching the theme, so breaking it over a layout
decision made here would be this spec damaging another one for no reason.

### Registration is one tap on a phone, not two

NAV-17 puts a sign-up button in the bar itself rather than only inside the menu.
Registration is the product's primary conversion action and it is currently
*absent* on phones; moving it from absent to two-taps-and-a-discovery-problem
would be a fix that still loses. A visitor has to be able to see that
registering is possible without opening anything.

Sign in stays inside the menu on mobile. Between the two, the one that must be
visible to someone who has never used the app is the one they do not have an
account for yet.

### The mobile map overlay is left alone

`MobileMapOverlay` is `fixed inset-0 z-50` and covers the navbar entirely, so
the menu trigger is unreachable while the map is open on a phone. That is
existing behaviour and is fine — the overlay has its own back button. It is
recorded because a drawer sharing `z-50` with the overlay looks like a conflict
waiting to happen, and it is not: the trigger cannot be reached while the
overlay is up, so the two are never open together.

## 5. Data and contracts

No database involvement, no server actions, no routes, no environment variables.
What does have to agree:

- **Two new dependencies**: `@radix-ui/react-dialog` (the mobile panel) and
  `@radix-ui/react-dropdown-menu` (the desktop account menu), wrapped as
  `components/ui/sheet.tsx` and `components/ui/dropdown-menu.tsx` following the
  existing `components/ui/select.tsx` pattern. Neither has a build step, so
  `pnpm-workspace.yaml`'s `onlyBuiltDependencies` is unaffected.
- **New i18n keys, in both locales.** `nav` currently holds `signIn`, `signUp`,
  `signOut`, `account`, `favorites`; alerts borrows `t.alerts.title`. The menu
  needs at minimum an open label and a close label. Spanish is the default
  locale, so an English-only key reaches most users — NAV-11 is what catches it.
- **`playwright.config.ts`.** The `mobile` project is scoped
  `testMatch: /(map|auth)\.spec\.ts/`. NAV-2 and NAV-13 need a phone viewport,
  so a new `e2e/navbar.spec.ts` must be added to that pattern or it will run
  only under Desktop Chrome and silently prove nothing.
- **Four e2e specs use the sign-out button as their "session has resolved"
  signal.** `e2e/auth.spec.ts`, `e2e/two-factor.spec.ts` and
  `e2e/favorites.spec.ts` (whose `waitForSession` helper is built on it) wait for
  a *visible* sign-out button to know hydration finished. NAV-3 moves that
  control behind a deliberate open, so the signal has to become the account
  trigger — which is a better one anyway, since it carries the user's name.
  Signing out in those specs becomes open-then-click, which is what a real user
  now does. `e2e/visual.spec.ts` is unaffected: its `waitForPageToSettle` keys on
  the signed-out sign-in link, which stays a top-level bar control on desktop.
- **Visual baselines.** `e2e/visual.spec.ts` snapshots include the navbar and
  will need regenerating. Baselines are per-platform, so this has to happen on a
  machine with the existing ones — CI stays green without them by design, which
  means a stale baseline fails locally and not in CI.
- **`docs/README.md` ownership map.** `components/*.tsx` currently maps to
  `frontend.md`. `components/Navbar.tsx` needs a row pointing here, and the
  index table in `docs/specs/README.md` needs a NAV entry.

## 6. Open questions

None. Three were raised while drafting and all three are settled; each is
recorded in §4 rather than left here, because the reasoning is what a reader
needs later, not the fact that it was once undecided:

- Theme stays in the desktop bar, language moves into the dropdown.
- A sign-up button stays in the bar on mobile; sign in lives in the menu.
- NAV-9 is kept, with its cost acknowledged — it remains the weakest criterion
  in this spec, and the reason it survives is that the visual suite has already
  been burned by this exact placeholder once.
