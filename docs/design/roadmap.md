# BuyCarMap 2.0 — redesign roadmap

The plan for building the approved redesign (`docs/design/`) into the app, phase by phase. **Read this
before starting any redesign work, and update it when a phase changes state.** It is the one place
that says what comes next; a phase's own spec says how.

Each phase:

- gets its own spec in `docs/specs/`, drafted when the phase starts (not before — later specs depend
  on what the earlier phases leave in the code), approved by the owner before its tests (`RULES.md` §4);
- builds only what the approved design draws — the screens in `docs/design/canvas/` win over this
  file, the UI Kit and the design system (`docs/design/README.md`);
- names the existing criteria it amends and amends them in the same pull request;
- is done when its spec is `Implemented`, `pnpm check:full` passes, the visual baselines it changes are
  regenerated, its screenshots (mobile and desktop) are approved by the owner, the docs it touches are
  updated, and its row below says `Done` with the pull request.

**Branch and merge (owner decision, 2026-10-12).** Every phase is built on the same branch,
`claude/app-structural-redesign-c4a34d`, committed there as it goes. Nothing reaches `master` until the
whole plan (F1–F7) is done and the screens match the design; the merge is one pull request at the end.
The keyboard, screen-reader and iPhone checks in [#127](https://github.com/algusaem/buycarmap/issues/127) did not run before that pull request (#129); they stay open after the merge.

A design change found during a phase goes to the design first (`CLAUDE.md` › Design first), then to
the phase's spec.

## Phases

| Phase | Spec | State | What it builds |
| --- | --- | --- | --- |
| F1 Foundation | [redesign-foundation.md](../specs/redesign-foundation.md) (LOOK) | Implemented 2026-10-12 on `claude/app-structural-redesign-c4a34d`, screenshots approved by the owner; not merged yet | Tokens, dark only, fonts, shared primitives, source badge, footer, `DESIGN.md` |
| F2 Navigation | [redesign-navigation.md](../specs/redesign-navigation.md) (HEAD) | Implemented 2026-10-12 on `claude/app-structural-redesign-c4a34d`; not merged yet | Desktop headers, phone headers, bottom nav |
| F3 Map and search | [redesign-map.md](../specs/redesign-map.md) (MAPUI) | Implemented 2026-10-14 on `claude/app-structural-redesign-c4a34d`, screenshots approved by the owner; not merged yet | The map screen and its states |
| F4 Landing and sign in | [redesign-entry.md](../specs/redesign-entry.md) (ENTRY) | Implemented 2026-10-15 on `claude/app-structural-redesign-c4a34d`, screenshots approved by the owner; not merged yet | `/` landing and `/login` |
| F5 Saved cars | [redesign-saved.md](../specs/redesign-saved.md) (SAVED) | Implemented 2026-10-15 on `claude/app-structural-redesign-c4a34d`, screenshots approved by the owner; not merged yet | `/favorites` |
| F6 Alerts | [redesign-alerts.md](../specs/redesign-alerts.md) (ALERTUI) | Implemented 2026-10-16 on `claude/app-structural-redesign-c4a34d`, screenshots approved by the owner; not merged yet | `/alerts` and `/alerts/[id]` |
| F7 Remaining pages | [redesign-pages.md](../specs/redesign-pages.md) (PAGES) | Implemented 2026-10-17 on `claude/app-structural-redesign-c4a34d`, screenshots approved by the owner; not merged yet | Register, account, password, legal, error pages |

Order matters: F1 before everything (every phase uses its tokens and primitives); F2 before F3–F7
(every screen sits under a header); F3 before F5 and F6 (they reuse its map, pins, preview card and
listing card). F4 and F7 only need F1 and F2.

## What each phase covers

**F1 Foundation.** Everything in [redesign-foundation.md](../specs/redesign-foundation.md): design tokens and
their aliases in `app/globals.css`, next-themes and the light theme removed, Unbounded + Rethink Sans
as local fonts, the shared primitives restyled (button, input, select with checkboxes, toggle chip,
card, skeleton, toast), the neutral source badge, the footer with the Storyset credit, `DESIGN.md`
and `.impeccable/design.json` regenerated, `/palette` and `/typography`. No screen changes structure.
Amends CORE-10, FRONT-19/23/26/27/29, MAP-23, NAV-14, PLAT-23.

**F2 Navigation.** Design: HeaderNav (map header with «Crear alerta», saved and avatar; pages header
with Mapa · Guardados · Alertas and the inverted current item; the avatar ring on Cuenta), the phone
headers, BottomNav. Governs: `navbar.md` (NAV). Open for its spec: what replaces today's account
menu and phone menu (the design links the avatar to `/account`), and the bottom nav on the map phone
screen, which the design leaves out.

**F3 Map and search.** Design: screens Mapa, Coche abierto + filtros, Mapa cargando, sin resultados,
error de búsqueda (`R2Base`, `R3-mapa-detalle`, `F0-estado-cargando`, `F0-estado-sin-resultados`,
`F0-estado-error-busqueda`). Pieces: SearchPill (desktop and phone), chips and «Filtros», FilterSheet,
PricePin, MapPreview, ListingCard, BottomSheet, StatusPill, MapZoom, EmptyState. Governs:
`map-and-search.md` (MAP), and the save heart on cards from `favorites.md` (FAV). F3 also replaces
every use of the Radix select primitive (radius, filters) with the design's
controls and the F1 checkbox select, then deletes it. F3 also builds «Crear alerta» (save the current
search as an alert, next to the search pill), which no screen offers today (owner decision, 2026-10-12). The map tile style
stays the dark CARTO one; the exact minimal style is issue #118.

**F4 Landing and sign in.** Design: `R3-landing`, `R3-login`. Pieces: Headline, the illustrations and
arrows, the landing search pill and map, GoogleButton, the form panel (`radius-panel`). Governs:
`auth-email-and-oauth.md` (AUTH) for the sign-in form, `cross-cutting.md` (CORE) where it covers the
landing.

**F5 Saved cars.** Design: `R3-favoritos`, `F5-guardados-coche`, `F5-guardados-estados`, `F0-estado-guardados-vacio`. Pieces: the phone car sheet (tap a row), the Guardados
ListingCard with «Ver anuncio», the sort chips, the compact phone row, the saved map with StatusPill.
Governs: `favorites.md` (FAV), through `redesign-saved.md` (SAVED), which amends `favorites.md`
(FAV), `redesign-map.md` (MAPUI), `core-frontend.md` (FRONT) and `core-platform.md` (PLAT).

**F6 Alerts.** Design: `R3-alertas`, `F6-alerta`, `F6-alerta-estados`, `F6-alertas-escritorio`, `F6-alerta-escritorio`, `F6-alerta-mas-estados`, `F0-estado-alertas-vacio`, `F0-estado-error-pagina`. Pieces: the phone alert page (zone map, matches, delete with confirmation, no matches), AlertCard (open and folded),
AlertZone, the match cards. Governs: `alerts.md` (ALERT), through `redesign-alerts.md` (ALERTUI), which
amends `alerts.md` (ALERT), `redesign-map.md` (MAPUI), `redesign-saved.md` (SAVED), `core-frontend.md`
(FRONT), `core-platform.md` (PLAT), `redesign-navigation.md` (HEAD) and `account-data-export.md`
(EXPORT). Showing which matches are new is issue #122.

**F7 Remaining pages.** Design: `F0-registro`, `F0-confirmar`, `F0-contrasena`,
`F0-nueva-contrasena`, `F0-cuenta`, `F0-legal`, `F0-estado-error-pagina`, and their state boards
`F7-registro-estados`, `F7-confirmar-estados`, `F7-contrasena-estados`, `F7-cuenta-editar`,
`F7-cuenta-dos-pasos`, `F7-cuenta-sesiones-google`, `F7-cuenta-eliminar-y-mas`, `F7-legal-estados`,
`F7-no-existe`. Pieces: PasswordField, AccountCard, the legal table of contents (LegalToc), the page
error state. Governs: `auth-email-and-oauth.md` (AUTH), `account-data-export.md` (EXPORT), and the
error pages' criteria in `core-frontend.md` (FRONT), through `redesign-pages.md` (PAGES), which amends
`auth-email-and-oauth.md` (AUTH), `core-better-auth.md` (BAUTH), `account-data-export.md` (EXPORT),
`core-data-model.md` (DATA), `core-frontend.md` (FRONT), `core-platform.md` (PLAT),
`redesign-navigation.md` (HEAD), `redesign-entry.md` (ENTRY) and `redesign-foundation.md` (LOOK).

## After the redesign

Each of these was left out of the phases on purpose and gets its own spec when picked up:

- [#117](https://github.com/algusaem/buycarmap/issues/117) Centre the map and the search on the user's geolocation
- [#118](https://github.com/algusaem/buycarmap/issues/118) Render the redesign's exact dark minimal map style
- [#119](https://github.com/algusaem/buycarmap/issues/119) Photo carousel on listing cards
- [#120](https://github.com/algusaem/buycarmap/issues/120) «Search as I move the map»
- [#121](https://github.com/algusaem/buycarmap/issues/121) Show the total number of results
- [#122](https://github.com/algusaem/buycarmap/issues/122) Show which alert matches are new
- [#123](https://github.com/algusaem/buycarmap/issues/123) Move the email templates to the redesign
- [#128](https://github.com/algusaem/buycarmap/issues/128) Refresh each saved listing's price and availability
