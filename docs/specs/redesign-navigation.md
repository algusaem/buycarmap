# Redesign F2 — navigation

Key: HEAD
Status: Implemented
Last updated: 2026-10-22

---

## Problem

The approved BuyCarMap 2.0 design (`docs/design/`, F2 additions approved 2026-10-12) replaces the
whole way people move around the app, and today's navigation contradicts it at every point. One bar
serves every page with the same controls; the design gives each kind of page its own header (the map,
the signed-in pages, the landing, and the sign-in and legal pages), each with a different job. Today
a phone hides everything behind a menu sheet, and the account, language and sign-out controls sit in
a desktop dropdown; the design has no menu and no dropdown — on a phone the signed-in pages get a
floating bottom bar with the three sections, the avatar opens the account page, and signing out moves
to that page. The language control lives in a dropdown and a menu that are both going, so without a
new home a visitor could no longer switch language at all.

Until this phase lands, every later phase (map, landing, saved cars, alerts, account) would build its
screen under a navigation bar the design no longer has.

In scope: the desktop headers, the phone headers, the phone bottom nav, the language control in every
header, the sign-out control's move to the account page, and the removal of today's dropdown and menu
sheet. Out of scope: the search pill and «Crear alerta» in the map header (F3), and every page's own
layout (F3–F7).

## Acceptance criteria

- [x] HEAD-1 · component — At desktop width, signed in, `/map` shows the map header: the wordmark
  linking to `/`, then on the right the language control, a «Guardados» icon link to `/favorites`, an
  «Alertas» icon link to `/alerts` and the avatar linking to `/account`, and no section links. — the
  header's centre gains the search pill and «Crear alerta» (MAPUI-1, MAPUI-39)
  (amended 2026-10-13, MAPUI — redesign-map.md) — the header becomes a two-row band with «Filtros»
  and the quick filters on the second row (MAPUI-64) (amended 2026-10-17, MAPUI — redesign-map.md)
  — the right side is the pages header's navigation: the language control, «Mapa» (`/map`, current),
  «Guardados» (`/favorites`) and «Alertas» (`/alerts`) as section links, and the avatar; no icon
  links. Below 1440px the band takes three rows (MAPUI-70) (amended 2026-10-22, design accepted
  2026-10-22, #157)
- [x] HEAD-2 · component — At desktop width, signed out, `/map` shows the wordmark, the language
  control and «Entrar» linking to `/login`, and no link to saved cars, alerts or the account. — the
  header's centre gains the search pill and «Crear alerta» (MAPUI-1, MAPUI-39, MAPUI-46)
  (amended 2026-10-13, MAPUI — redesign-map.md)
- [x] HEAD-3 · component — At desktop width, signed in, `/favorites`, `/alerts`, `/alerts/[id]` and
  `/account` show the pages header: the wordmark, the language control, «Mapa» (`/map`), «Guardados»
  (`/favorites`), «Alertas» (`/alerts`) and the avatar (`/account`).
- [x] HEAD-4 · component — In the pages header exactly one destination is marked current
  (`aria-current="page"`): «Guardados» on `/favorites`, «Alertas» on `/alerts` and on `/alerts/[id]`,
  and the avatar on `/account`, where no section link is current. — the map header is held to the
  same rule: «Mapa» is current on `/map`, and nothing else is (amended 2026-10-22, #157)
- [x] HEAD-5 · component — The landing `/` shows, signed out, the language control, «Entrar»
  (`/login`) and «Crear cuenta» (`/register`); signed in, the pages header with no destination marked
  current.
- [x] HEAD-6 · component — The sign-in, account-recovery and legal pages (`/login`, `/register`,
  `/forgot-password`, `/reset-password`, `/verify-email`, `/confirm-email`, `/privacy`, `/terms`) show
  the wordmark, the language control and «Volver al mapa» linking to `/map`, signed in or not. — the
  not-found page takes the pages header and the tab bar signed in, except `/alerts/[id]`'s 404, which
  keeps «Alertas» current, and an error page takes its route's header (PAGES-66, PAGES-68) (amended
  2026-10-16, PAGES — redesign-pages.md)
- [x] HEAD-7 · component — At phone width each header shows the wordmark, the language control and
  one item on the right: «Entrar» on
  the signed-out landing, «Mapa» on the sign-in and account-recovery pages, and «Volver» on the legal
  pages; `/map` at phone width shows no app header. — `/favorites`, `/alerts`, `/alerts/[id]` and
  `/account` show no avatar, because «Cuenta» is in the tab bar (MAPUI-54), and the signed-in landing
  shows no item on the right, for the same reason (ENTRY-8)
  (amended 2026-10-13, MAPUI — redesign-map.md; amended 2026-10-14, ENTRY — redesign-entry.md)
  — `/alerts/[id]` also shows «Volver», a 40px round link to `/alerts` named «Volver», before the
  wordmark (ALERTUI-22) (amended 2026-10-15, ALERTUI — redesign-alerts.md)
  — the not-found page takes the access header signed out, «Volver al mapa» at desktop width, «Mapa»
  at phone width (PAGES-66) (amended 2026-10-16, PAGES — redesign-pages.md)
- [x] HEAD-8 · component — At phone width, signed in, `/favorites`, `/alerts`, `/alerts/[id]` and
  `/account` show the bottom nav with «Mapa», «Guardados» and «Alertas» links, the current section
  marked as in HEAD-4 and none marked on `/account`; it is absent at desktop width, when signed out,
  and on every other page. — the bottom nav becomes the full-width tab bar: signed in it adds
  «Cuenta» and also shows on the map, and signed out the map shows it with «Mapa» and «Entrar»
  (MAPUI-52) (amended 2026-10-13, MAPUI — redesign-map.md)
  — signed in, the not-found page shows the tab bar with no tab current, except `/alerts/[id]`'s 404,
  which keeps «Alertas» current (PAGES-66) (amended 2026-10-16, PAGES — redesign-pages.md)
- [x] HEAD-9 · component — The avatar shows the upper-case first letter of the user's name, or of
  their email when they have no name, and its accessible name is «Cuenta» ("Account" in English).
- [x] HEAD-10 · component — The language control is a group named «Idioma» with one button per
  locale; the active locale's button is pressed and the other is not; choosing the other locale writes
  the `locale` cookie and calls `setLocale` with it (amends ALERT-50 and keeps CORE-5).
- [x] HEAD-11 · component — While the session is resolving, no header offers signed-in or signed-out
  destinations, and the header keeps the size it will have once the session resolves. — on `/map` the
  desktop map header holds the pages header's placeholders (Mapa, Guardados, Alertas, avatar)
  instead of one (amended 2026-10-22, #157)
- [x] HEAD-12 · component — A session that ends while a signed-in header is on screen switches it to
  the signed-out header of the same page, without a reload.
- [x] HEAD-13 · component — The account page offers «Cerrar sesión»; using it ends the session and
  returns the user to `/`. — kept, with the new layout: «Cerrar sesión» on the heading's row at
  desktop width, after the last card at phone width (PAGES-25, PAGES-26) (amended 2026-10-16, PAGES —
  redesign-pages.md).
- [x] HEAD-14 · component — No page renders a navigation menu sheet, a hamburger trigger or an
  account dropdown.
- [x] HEAD-15 · e2e — Every header control and every bottom-nav link at phone width has a hit area of
  at least 44 × 44px (keeps NAV-2).
- [x] HEAD-16 · e2e — At 1024 and at 1440px wide, no header scrolls horizontally on `/`, `/map` and
  `/login`. — on `/map` this holds with the search pill and «Crear alerta» in the header (MAPUI-1)
  (amended 2026-10-13, MAPUI — redesign-map.md) — and with the section links: at 1024px the map
  header is the three-row band of MAPUI-70 (amended 2026-10-22, MAPUI — redesign-map.md, #157)
- [x] HEAD-17 · component — The bottom nav is offset from the bottom by the safe-area inset as well as
  its 24px, and the root layout's viewport opts into the safe area (`viewport-fit=cover`). — the
  24px float becomes a full-width tab bar padded by the safe-area inset (MAPUI-52)
  (amended 2026-10-13, MAPUI — redesign-map.md)
- [x] HEAD-18 · e2e — Signed in at phone width, the last control of `/account` («Cerrar sesión») can
  be scrolled fully clear of the bottom nav and is clickable. — kept, with the new layout (PAGES-26)
  (amended 2026-10-16, PAGES — redesign-pages.md).
- [x] HEAD-19 · e2e — Signed in at phone width, `/favorites` and `/alerts` scroll when their content is
  taller than the screen, and their last element can be scrolled fully clear of the bottom nav (bug
  fix, found 2026-10-12). — So does `/alerts/[id]`, whose last element is «Eliminar alerta», after
  its virtualised rows (ALERTUI-31) (amended 2026-10-15, ALERTUI — redesign-alerts.md)
- [x] HEAD-20 · node + e2e — The root layout's shell is as tall as the visible viewport, measured
  with the dynamic viewport height (`100dvh`), with `100vh` kept only as the fallback for browsers
  without dynamic viewport units. So on a phone whose browser shows its own toolbars, no part of any
  page, its tab bar or the map's results sheet sits under them (bug fix, found 2026-10-17, #133).
- [x] HEAD-21 · component — No header draws a bottom border. The map header, the pages header and the
  phone headers of `/favorites`, `/alerts`, `/alerts/[id]` and `/account` stand apart from the page
  by the `surface` background instead; the landing, sign-in, account-recovery and legal headers,
  which draw no divider today, keep the page background (owner decision, 2026-10-17, #134).

## Worked examples

**Header by route, session and width** (from the approved design; «current» is `aria-current="page"`).
The phone rows of `/map`, `/favorites`, `/alerts` and `/account` follow F3: the phone headers there
lose the avatar, and the bottom nav becomes the full-width tab bar, with «Cuenta» in it (MAPUI-52,
MAPUI-54) (amended 2026-10-13, MAPUI — redesign-map.md):

| Route | Session | Desktop right side | Phone right side | Tab bar (phone) |
| --- | --- | --- | --- | --- |
| `/map` | in | Idioma · **Mapa** · Guardados · Alertas · avatar | no header | **Mapa** · Guardados · Alertas · Cuenta |
| `/map` | out | Idioma · Entrar | no header | **Mapa** · Entrar |
| `/favorites` | in | Idioma · Mapa · **Guardados** · Alertas · avatar | Idioma | Mapa · **Guardados** · Alertas · Cuenta |
| `/alerts`, `/alerts/[id]` | in | Idioma · Mapa · Guardados · **Alertas** · avatar | Idioma | Mapa · Guardados · **Alertas** · Cuenta |
| `/account` | in | Idioma · Mapa · Guardados · Alertas · **avatar** (ring) | Idioma | Mapa · Guardados · Alertas · **Cuenta** |
| `/` | out | Idioma · Entrar · Crear cuenta | Idioma · Entrar | none |
| `/` | in | Idioma · Mapa · Guardados · Alertas · avatar (none current) | Idioma | Mapa · Guardados · Alertas · Cuenta (none current) |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/confirm-email` | any | Idioma · Volver al mapa | Idioma · Mapa | none |
| `/privacy`, `/terms` | any | Idioma · Volver al mapa | Idioma · Volver | none |

**HEAD-9** — name «Ada Lovelace» → «A»; no name, email `beatriz@example.com` → «B»; name «álvaro» →
«Á».

**HEAD-19 (bug fix)** — signed in at 390 × 844 on `/favorites`, with content 3,546px tall: today the
page's container reports scrollHeight 3,546 against clientHeight 780 with `overflow-y: hidden`,
`window.scrollBy(0, 600)` and the mouse wheel leave the content where it was, and everything below
the screen is unreachable (the same on `/alerts`, 3,566px). Correct result: scrolling 600px moves the
content up 600px, and at the end of the scroll the last element sits entirely above the tab bar
(amended 2026-10-13, MAPUI — redesign-map.md).

**HEAD-20 (bug fix)** — on an iPhone in Chrome, on production, with the browser's top and bottom
toolbars showing (owner report, 2026-10-17): today `<body>` is `100vh` tall, which on iOS is the
height with the toolbars hidden, and the document never scrolls (`overflow-hidden`), so the toolbars
never hide and the bottom strip of every page — its last controls, the tab bar's clearance, the
results sheet's lower edge — stays under the bottom toolbar. Correct result: the shell is the visible
height (`100dvh`), so everything sits between the toolbars. Desktop and phone emulators draw no
browser toolbars, where `100dvh` equals `100vh`: the test asserts the computed height comes from the
dynamic unit, and the toolbars themselves can only be checked on a real iPhone.

**HEAD-10** — locale `es`: «ES» pressed, «EN» not; press «EN» → cookie `locale=en`, `setLocale("en")`
called once.

## Data model

None. The header reads the session already available in the browser (`authClient.useSession()`:
`user.name`, `user.email`); no schema change.

## Permissions

The header is not an access control: `proxy.ts` and `getCurrentUser()` in each page's query decide
who sees a page. What the header guarantees is that a visitor without a session is never offered a
destination that needs one — no saved cars, alerts or account link (HEAD-2, HEAD-5, HEAD-6; keeps
NAV-10) — and that a session ending mid-page stops offering them (HEAD-12).

## Edge cases

- Session still resolving (HEAD-11) and session ending while on screen (HEAD-12).
- A user with no display name (HEAD-9): the initial comes from the email.
- `/alerts/[id]` marks «Alertas» current even though it is not `/alerts` (HEAD-4) — the alert detail
  belongs to that section.
- `/account`: the avatar, not a section, is current in the desktop header (HEAD-4), «Cuenta» is
  current in the phone tab bar (HEAD-8, MAPUI-52), and «Cerrar sesión» must not hide behind the tab
  bar (HEAD-18).
- Narrow desktops (HEAD-16): from 1024px the header must fit without scrolling. On `/map` the wordmark,
  the search group and the section links fit in one row only from 1440px; from 1024 to 1439px the
  band takes three rows (MAPUI-70). (amended 2026-10-22, #157)
- Phones with a home indicator (HEAD-17): the tab bar is padded by the safe area.
- No phone header shows the avatar: every signed-in page, the landing included, has «Cuenta» in the
  tab bar (MAPUI-54, ENTRY-8). (amended 2026-10-14, ENTRY — redesign-entry.md)
- Pages with no drawn header (`/palette`, `/typography`) take the sign-in/legal header (HEAD-6's
  shape); the not-found page takes the pages header signed in (PAGES-66) and an error page its
  route's header (PAGES-68). (amended 2026-10-16, PAGES — redesign-pages.md)

## Out of scope

- The search pill in the map header and «Crear alerta» beside it (F3). Today no screen lets a user
  create an alert at all; building that action belongs to F3, with the map's search.
- The phone map's own controls — the top band, the quick filters and the bottom sheet (F3, amended
  2026-10-17 by MAPUI-67).
- The landing and sign-in page layouts below the header (F4), the account page's cards (F7) — this
  phase only adds «Cerrar sesión» there.
- Showing the user's photo in the avatar: the design draws an initial only.

## Contracts

i18n keys, both locales (`messages/es.json`, `messages/en.json`, `lib/i18n/types.ts`):

- New: `nav.map` («Mapa» / "Map"), `nav.saved` («Guardados» / "Saved"), `nav.alerts` («Alertas» /
  "Alerts"), `nav.backToMap` («Volver al mapa» / "Back to map"), `nav.back` («Volver» / "Back"),
  `nav.language` («Idioma» / "Language"), `nav.main` («Principal» / "Main", the name of the header and bottom-nav landmarks), `nav.createAccount` («Crear cuenta» / "Create account"),
  `nav.localeEs` («Español» / "Spanish") and `nav.localeEn` («Inglés» / "English") as the language
  buttons' accessible names (their visible text stays «ES» / «EN»).
- Kept: `nav.signIn`, `nav.signOut`, `nav.account`.
- Removed once unused: `nav.menu`, `nav.closeMenu`, `nav.signUp`, `nav.favorites`.

**Criteria in other specs this phase changes** (each amended in the same change, statement kept and
marked):

- `navbar.md` (NAV) — the menu sheet and the account dropdown go, so the criteria about them are
  withdrawn: NAV-1, NAV-3, NAV-4, NAV-5, NAV-6 (sign-out moves to HEAD-13), NAV-12, NAV-13, NAV-14,
  NAV-16 (becomes HEAD-12), NAV-17 (the design offers registration on the phone through «Entrar»'s
  page, not in the header) and NAV-18. Amended: NAV-2 (touch targets → HEAD-15), NAV-7 (current page →
  HEAD-4), NAV-8 and NAV-9 (resolving session → HEAD-11), NAV-15 (no name → HEAD-9). Kept as they are:
  NAV-10, NAV-11.
- FAV-17 (`favorites.md`) — "from anywhere in the app" becomes "from every header and from the bottom
  nav", because the phone map and the phone landing have no saved-cars link of their own (the phone map
  gets one in F3; the phone landing reaches it through the avatar's account page and its bottom nav).
- ALERT-50 (`alerts.md`) — "either switcher (the language buttons and the navbar menu)" becomes "the
  header's language control" (HEAD-10).
- The e2e helpers that find today's navbar by its DOM (`e2e/auth.spec.ts`, `e2e/two-factor.spec.ts`,
  `e2e/favorites.spec.ts`, `e2e/visual.spec.ts`, and the old navbar e2e spec, now `e2e/navigation.spec.ts`) move to the new headers; the
  visual baselines are regenerated.

## Decisions and rationale

**One header component per kind of page, chosen by route.** The design draws four headers with
different jobs, not one bar with optional pieces. Choosing by route keeps each header's content fixed
and testable (the worked-example table is the whole contract) instead of a single bar growing
conditionals for every page.

**No menu, no dropdown.** The design has neither, and every destination they held has a home: the
sections in the pages header and the phone bottom nav, the account behind the avatar, the language in
every header, sign-out on the account page. Keeping a sheet "just in case" would be a second
navigation the design does not have.

**Language in every header (owner decision, 2026-10-12).** The app is bilingual and Spanish by default;
the old switchers lived in the menu and dropdown that this phase removes. A small «ES · EN» control at
the start of each header keeps the switch one tap away for signed-out visitors too. It carries no
accent colour: violet would fail contrast as small text and lime is for the current action. The phone
map has no header, so it has no language control; switching there means leaving the map.

**The map header uses the section links (owner decision, 2026-10-22, #157).** It first used a heart and
a bell, because the header's centre belongs to the search and section links were not expected to fit.
That made the navigation change between `/map` and `/favorites` or `/alerts`, with no «Mapa» marked on
the map, so it now carries the pages header's links, «Mapa» current. They fit beside the search from
1440px; below that the band takes three rows (MAPUI-70) rather than going back to icons, which would
bring the inconsistency back on laptops. «Crear alerta» is an action on the search, not a destination,
so it sits next to the search pill (F3), and the right side holds only navigation.

**Sign-out on the account page (owner decision).** Desktop puts it in the account page's header, phone
at the end of the page, above the bottom nav. It is the same control in both places.

**Owner decisions on the draft (2026-10-12).** The English copy in Contracts is approved as drafted. «Crear alerta» — the action that saves the map's current search as an alert, which no screen offers today — is built in F3 with the map's search, not here and not in F6.

**The two undrawn headers were derived and approved.** The signed-out map header keeps the search group
in the same place and swaps the section links and avatar for «Entrar» (amended 2026-10-22, #157); the signed-in landing reuses the pages
header with nothing current. Both are in the UI Kit and the HeaderNav guide.
