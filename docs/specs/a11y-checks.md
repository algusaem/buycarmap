# Accessibility and device checks — keyboard, screen reader, WebKit

Key: A11Y
Status: Approved
Last updated: 2026-10-19

---

## Problem

The redesigned app (#129, #136, #141, #144) was merged with three kinds of check still undone, and
every redesign PR lists them as "not verified" (#127):

- **Keyboard.** Tab order is asserted only in scattered places (SAVED-28, ALERTUI-31, ALERTUI-54,
  MAPUI-66). No test crosses a whole screen with the keyboard, none checks that every Tab stop is
  visible and not inside something inert, and several openers return focus only in jsdom: the
  search pill's popovers, the desktop «Filtros» dropdown, the desktop «Crear alerta» popover and the
  phone filters and «Crear alerta» sheets. jsdom has no layout, no real focus ring and no
  scrolling, so a control hidden off-screen, clipped by a scroller or covered by the tab bar passes
  there and fails a real keyboard user. There is also no «Skip to content» link, which `RULES.md`
  §19 requires, so a keyboard user crosses the whole header on every page before reaching it.
- **Screen reader.** axe (FRONT-19, LOOK-18 and the rest) proves the accessibility tree is
  well-formed, not what a screen reader says. Nobody has heard the segment names, the result count,
  the empty and error lines, the pins or the tab bar read aloud.
- **Safari.** Playwright runs Chromium only (`playwright.config.ts`), so nothing exercises the
  engine every iPhone uses. The safe-area spacing and the browser toolbars can only be seen on a
  real iPhone.

The owner approved all three parts on 2026-10-19 and chose: NVDA on a GitHub-hosted Windows runner,
every redesigned screen in the first version, the skip link inside this spec, and WebKit inside
`check:full` and CI.

This spec is written for the MapLibre map (PR #147, `docs/specs/map-maplibre.md`): its
implementation starts once that PR is on `master`.

In scope: a «Skip to content» link on every page; a keyboard walk-through of every redesigned screen
at desktop and phone width; focus return, in a real browser, for the openers that only jsdom covers
today; screen-reader output for the map flows, the empty and error states and the tab bar, with
NVDA; two WebKit projects for the map and navigation flows; the manual iPhone checklist.

## Acceptance criteria

Skip link

- [x] A11Y-1 · e2e — On every page listed in Worked examples › Pages, the first Tab from a freshly
  loaded page focuses a link «Saltar al contenido» (es) / «Skip to content» (en). It is not visible
  until focused, and visible while focused (inside the viewport, with the lime focus outline of
  LOOK-11). Enter on it moves focus to the page's `main` landmark, so the next Tab focuses the first
  control after the header, as Worked examples › Tab order shows. The link is drawn as designed in
  the design canvas (designed and accepted before it is coded).
- [x] A11Y-2 · e2e — Each page has exactly one `main` landmark, and the skip link targets it; a page
  whose `main` is missing fails the walk-through instead of silently skipping.

Keyboard walk-through

- [x] A11Y-3 · e2e — On `/map` with the default search results, signed out, at 1440 × 900 and at
  390 × 844, pressing Tab from the skip link to the last focusable element visits exactly the
  sequence in Worked examples › Tab order, and Shift+Tab from the last element visits it in reverse.
- [x] A11Y-4 · e2e — At every Tab stop of every walk-through (A11Y-3, A11Y-6, A11Y-7), the focused
  element is visible: its box is non-empty and inside the viewport once the browser has scrolled it
  into view, not clipped by a scrolling ancestor, not covered by the tab bar or the results sheet,
  not inside an `inert` or `aria-hidden="true"` subtree, and it draws the focus outline of LOOK-11 —
  or, for a results card's link, the photo's lime ring of MAPUI-66, and for the map's attribution toggle, which sits in the map's rounded corner, the same outline drawn inside it. A control that is visually hidden
  until focused (the sheets' «Cerrar», SAVED-41; the skip link, A11Y-1) counts once focused. The
  outline and the scroll that brings a focused control into view appear at once, with no transition
  or smooth scroll, because a key caused them (`docs/specs/motion.md`). The map surface, which the
  phone's results sheet partly covers by design, counts as visible when a part of it is uncovered (the
  strip above the sheet), where its focus ring shows. A pin or a control the phone's
  results sheet covers is out of the tab order while it is covered. (amended 2026-10-20)
- [x] A11Y-5 · e2e — In a real browser, each of these closes on Escape with focus back on its
  opener: the «Dónde», «Coche» and «Precio» popovers (on their segment, MAPUI-2), the desktop
  «Filtros» dropdown (on «Filtros»; amends MAPUI-19, which did not say where focus goes), the
  desktop «Crear alerta» popover (on «Crear alerta», MAPUI-39), the phone filters sheet (on
  «Filtros», MAPUI-22) and the phone «Crear alerta» sheet (on «Crear alerta», MAPUI-39). Each opens
  and closes at once, with no animation, because a key caused it (MOTION-10, MOTION-12).
- [x] A11Y-6 · e2e — With the database (`E2E_DB=1`), signed in with two saved cars and two alerts
  (one with two matches), at both widths: `/favorites`, `/alerts`, `/alerts/[id]` and `/account`
  each walk from the skip link to the end in the order their own specs define (SAVED-28,
  ALERTUI-31, ALERTUI-54, PAGES-26, PAGES-38, HEAD-6 to HEAD-8), and Shift+Tab walks it back.
- [x] A11Y-7 · e2e — Signed out, at both widths: `/`, `/login`, `/register`, `/forgot-password`,
  `/privacy`, `/terms` and a page that does not exist each walk from the skip link to the end in the
  order of their specs (ENTRY-13, PAGES-66, PAGES-68, MOTION-15 for the legal index), and Shift+Tab
  walks it back.
- [x] A11Y-8 · e2e — The map surface is in the tab order only as one stop, named «Mapa: usa las
  flechas para moverlo y + o − para acercar o alejar» (es) / «Map: use the arrow keys to move it and
  + or − to zoom» (en); with it focused, an arrow key moves the map's centre and + raises the zoom by
  one. A pin keeps its own name (MAPUI-25). The phone zone preview is not in the tab order
  (ALERTUI-24).

Screen reader (NVDA)

- [ ] A11Y-9 · e2e — With NVDA reading `/map` in Spanish, moving through the search pill speaks each
  segment's visible label and value (for example «Dónde» and «Madrid · 50 km»), and the submit and
  «Crear alerta» buttons by their names.
- [ ] A11Y-10 · e2e — After a search, NVDA speaks the result count once, without the user moving
  focus (the polite status of MAPUI-3 and MAP-20), and speaks the no-match line when a search returns
  nothing.
- [ ] A11Y-11 · e2e — Moving to a pin, NVDA speaks its name (price and car, MAPUI-25); opening its
  preview with Enter speaks the car's name from the card; Escape returns to the pin and NVDA speaks
  the pin again.
- [ ] A11Y-12 · e2e — On the search error state and on the empty results state, NVDA speaks the
  headline and the line of each (EmptyState), and on a browser without WebGL it speaks «El mapa no
  está disponible en este navegador» (MAPLIBRE-15).
- [ ] A11Y-13 · e2e — At phone width, moving through the tab bar speaks each tab's label and marks
  the current one as current (MAPUI-52), and the tab bar is not read while it is hidden (MAPUI-53).
- [x] A11Y-14 · node — The screen-reader tests live outside `pnpm test:e2e` and `pnpm check:full`:
  their own Playwright config (serial, headed, as NVDA requires) and their own script, run by a
  GitHub Actions workflow on a `windows-2025` runner that installs NVDA, on pull requests that touch
  `app/`, `components/` or `messages/`, and on demand.

WebKit

- [x] A11Y-15 · node — `playwright.config.ts` has two WebKit projects, an iPhone (Playwright's
  iPhone device descriptor, touch, mobile) and desktop Safari (1440 × 900), both running
  `e2e/map.spec.ts` and `e2e/navigation.spec.ts`; `pnpm test:e2e` (and so `pnpm check:full`) runs
  them; the CI e2e job installs WebKit next to Chromium.
- [x] A11Y-16 · e2e — Every test in `e2e/map.spec.ts` and `e2e/navigation.spec.ts` passes on both
  WebKit projects, except a test that needs an input Playwright's WebKit does not provide, which
  runs on Chromium only, with the reason in the test. The only such tests: MAPUI-59 on the iPhone
  project (Playwright's mobile WebKit has no mouse wheel); MOTION-20 and the MAPUI-60 fast drags on
  the iPhone project (Playwright's mobile WebKit can deliver a drag's last move and its release in
  one frame, so Motion never starts the gesture; real touch input moves once per frame); MAPUI-66
  on the desktop Safari project (Safari's Tab skips links by default). (amended 2026-10-20, owner)

## Worked examples

**Pages (A11Y-1, A11Y-2).** `/`, `/map`, `/favorites`, `/alerts`, `/alerts/[id]`, `/account`,
`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/confirm-email`,
`/privacy`, `/terms`, and the not-found page. The dev-only `/palette` and `/typography` are not
included.

**Tab order on `/map`, signed out, default results (A11Y-3).** Read from the code (`app/layout.tsx`,
`components/nav/MapHeader.tsx`, `components/map/search/*`, `components/map/filters/FilterRow.tsx`,
`components/map/CarCard.tsx`, `components/map/ListingsMap.tsx`, `components/map/phone/*`) with the
three default e2e listings (Audi A3 2.0 TDI, BMW Serie 3 320d, SEAT León 1.5 TSI). **To confirm
with the owner before the tests are written.**

Desktop, 1440 × 900:

1. «Saltar al contenido»
2. the wordmark (link to `/`)
3. «Dónde» · 4. «Coche» · 5. «Precio» · 6. «Buscar» · 7. «Crear alerta»
8. «ES» · 9. «EN» · 10. «Entrar»
11. «Filtros» · 12–16. the quick filters «Gasolina», «Diésel», «Manual», «Automático»,
    «Hasta 100.000 km»
17–22. each card's link then its heart: Audi, BMW, SEAT
23. the map surface (A11Y-8)
24–26. the three pins, in list order
27. «Acercar» · 28. «Alejar»
29. the attribution's toggle «Mostrar u ocultar la atribución»
30–32. the attribution links: OpenFreeMap, OpenMapTiles, OpenStreetMap

After «Saltar al contenido» + Enter, the next Tab lands on 17 (the first card's link): the link skips
the whole header, the filters row included, which lives in the header (amended 2026-10-20, owner).

Phone, 390 × 844 (sheet at its middle position):

1. «Saltar al contenido»
2. the search summary · 3. «Filtros» · 4–8. the quick filters
9. the sheet's handle · 10. «Crear alerta»
11–12. the link and the heart of the one card the sheet shows at its middle position (MAPUI-23)
13. the map surface · then the pins the sheet does not cover, in list order
then the attribution's toggle and links, unless the sheet covers them (at the middle position it
does: they sit at the map's bottom edge)
then the tab bar: «Mapa», «Entrar»

(Amended 2026-10-20 while writing the tests: the attribution toggle was missing, the phone list
named no attribution, and «each card» is the single card the middle sheet shows. The code today puts
the attribution before the zoom buttons; the order above, zoom first, is the approved one.)

## Data model

None.

## Permissions

None: no data access changes. The signed-in walk-throughs (A11Y-6) use seeded e2e accounts, as the
existing DB-backed tests do.

## Edge cases

- **Visually hidden controls** (A11Y-4): «Cerrar» in the sheets and the skip link are hidden until
  focused; they count as visible once focused, never before.
- **Inert while hidden** (A11Y-4, A11Y-13): the tab bar while the sheet is full (MAPUI-53) and the
  sheet's list while it is dragged are inert; a walk-through that lands inside them fails.
- **Keyboard-instant** (A11Y-5): every assertion runs without waiting for a fade, because a key
  caused the change (`docs/specs/motion.md`); a fade that delays focus fails.
- **Long lists**: the walk-throughs use short lists; the 200-row cases stay with SAVED-28,
  ALERTUI-31 and ALERTUI-54.
- **No database in CI**: A11Y-6 runs only with `E2E_DB=1`, locally, like every DB-backed test.
- **NVDA not installed or not speaking** (A11Y-14): the workflow fails on setup; it never passes
  with an empty spoken log — each NVDA test first asserts that it heard something.
- **WebKit gaps** (A11Y-16): Playwright's WebKit reports a safe-area inset of 0 and has no real iOS
  toolbar or touch gestures; those stay on the manual checklist.

## Out of scope

- VoiceOver and real iOS Safari automation (no macOS runner); the manual checklist covers the
  iPhone.
- Screen-reader output for `/favorites`, `/alerts` and `/account` (they need the database, which
  the Windows runner does not have).
- Fixing what the walk-throughs find, beyond the skip link and A11Y-8: each finding is its own fix
  against its own spec.
- A Firefox project.
- Keyboard walk-throughs on WebKit: Safari's Tab skips links unless a preference is set, so the
  walk-throughs stay on Chromium.

## Contracts

- **Screen reader:** Guidepup (`@guidepup/guidepup`, `@guidepup/playwright`, `@guidepup/setup`,
  MIT) drives NVDA; new dependencies, recorded in ADR 0024 when they are installed, pinned to exact
  versions (they are 0.x and released weekly). The tests assert BuyCarMap's own Spanish strings
  inside NVDA's spoken log, never NVDA's role words, which follow the reader's language.
- **Runner:** GitHub-hosted `windows-2025` (free for this public repository), with NVDA installed
  by `@guidepup/setup` at run time. Nothing is installed on the owner's machine.
- **WebKit:** `pnpm exec playwright install webkit` locally, and the CI e2e job's install step
  gains `webkit` (`.github/workflows/test.yml`).
- **Map surface:** the MapLibre canvas, which MapLibre puts in the tab order for keyboard panning,
  gets `role="application"` and the name of A11Y-8, from new message keys in both locales.
- **Manual checks on a real iPhone** (owner, on a preview or production deployment, in Safari and in
  Chrome), recorded in the PR that implements this spec:
  - the map's floating search, the results sheet at full, the sheet footers and the tab bar clear
    the notch and the home indicator;
  - no page sits under the browser's toolbars (HEAD-20);
  - dragging the results sheet with a finger works, and a tap right after a drag does not open a
    card.

## Decisions and rationale

- **NVDA on a Windows runner** (owner, 2026-10-19), rather than VoiceOver on macOS or NVDA on the
  owner's machine: Guidepup's own CI proves NVDA on `windows-2022`/`2025`, the runner is free for a
  public repository, and nothing touches the owner's Windows 11 Home, which Guidepup does not list.
  VoiceOver on macOS 27 has an open bug that returns empty phrases.
- **Outside `check:full`** (A11Y-14): Guidepup forces serial, headed runs and needs a real reader;
  folding it into `test:e2e` would make every local check depend on NVDA.
- **Every screen in the first version** (owner): the DB-backed screens run locally only, like their
  other tests; CI still walks the map, access and legal pages.
- **The skip link here** (owner): `RULES.md` §19 requires it, and without it every walk-through
  would assert a header crossing the rule forbids.
- **The map surface stays focusable** (A11Y-8): MapLibre keeps keyboard panning and zoom, the only
  way to move the map without a pointer; it needs a name, and the
  name says how to use it. `role="application"` because the arrow keys belong to the map there.
- **WebKit in `check:full`** (owner): `check:full` is the local contract, so a Safari-only break is
  caught before CI.
- **MAPUI-19 amended** (A11Y-5): the dropdown already closed on Escape; returning focus to «Filtros»
  is what the WAI-ARIA menu-button pattern prescribes and what every other opener here does.
