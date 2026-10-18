# Redesign F5 — saved cars

Key: SAVED
Status: Implemented
Last updated: 2026-10-15

---

## Problem

`/favorites` is the page a buyer comes back to, to look again at the cars they picked out. It still
wears the pre-redesign look, and it does not behave the way the approved design draws it. The design
is `docs/design/canvas/R3-favoritos.dc.html`, `F5-guardados-coche.dc.html`,
`F5-guardados-estados.dc.html`, `F0-estado-guardados-vacio.dc.html` and
`F0-estado-error-pagina.dc.html`, accepted by the owner on 2026-10-15.

- **No map.** The saved cars carry their coordinates (FAV › Data model), but the page shows a grid
  and nothing else. A buyer comparing cars in three cities cannot see where they are. The design
  never shows Guardados without its map on desktop.
- **One fixed order.** The list is newest first, always. A buyer with thirty saved cars who wants the
  cheapest, or the one with the fewest kilometres, reads all thirty.
- **The phone gets the desktop card.** Each card is 250px of photo, so a phone shows two cars a
  screen. The design gives the phone compact rows and a car sheet.
- **Removing is final and silent.** The heart turns the card unsaved and leaves it on the page. The
  page only empties on the next visit, and a mistaken tap has no undo, although the server keeps the
  row (DATA-10, DATA-11).
- **A page that mounts every card.** Every saved car is rendered at once, photo included. That works
  for ten cars and not for two hundred (`RULES.md` §19: virtualise lists over 50 items).
- **The states are the old ones.** Loading is the map's card grid. Empty is a heart icon and one line.
  The error is a centred icon with «No se pudo cargar esta página». None of them is the design's.
- **Copy the design drops.** A subtitle, «Los precios son del día en que los guardaste.». A back
  arrow to `/map`, named «Volver al inicio».

In scope:
- the `/favorites` page at desktop and phone width: its title, the sort, the Guardados card, the
  compact phone row and the phone car sheet;
- the saved map with its pins, grouping, preview and title pill;
- removing a saved car with undo;
- the virtualised list;
- the route's loading, empty and error states.

## Acceptance criteria

Here "desktop width" is 1024px and up and "phone width" is under 1024px, the boundary `useIsPhone`
uses (`lib/hooks/useIsPhone.ts`: `(width < 64rem)`). "The list" is the cards on desktop and the rows on
the phone. "In order" means the order of the sort in force.

Page

- [x] SAVED-1 · component — At desktop width `/favorites` shows:
  - the page heading «Guardados» (`h1`, drawn in capitals);
  - the sort chips (SAVED-6);
  - the saved cars as Guardados cards (SAVED-9);
  - the map, a region named «Mapa de tus guardados», with the pill «Tus guardados en el mapa» at its
    top left (SAVED-13).

  It shows no subtitle, no count beside the heading, and no back link to `/map`. The browser title
  is «Guardados · Buy Car Map».
- [x] SAVED-2 · component — At phone width `/favorites` shows:
  - the phone header (MAPUI-54);
  - the heading «Guardados»;
  - the saved cars as compact rows (SAVED-19);
  - the tab bar with «Guardados» current (MAPUI-52).

  It shows no map, no sort chips and no Guardados cards.
- [x] SAVED-3 · e2e — The layout by width follows the viewport table under Worked examples. Widths
  are border boxes, ±1px:
  - from 1280px wide (measured at 1440×900 and 1280×900), the list column is 830px wide, its 32px
    padding on each side included. It holds three card columns 242px wide with 20px between them.
    The chips sit on the heading's row (their boxes overlap it vertically). The map fills the rest of
    the width to the right: 610px at 1440×900, 450px at 1280×900;
  - from 1024px to 1279px wide (measured at 1024×900 and 1279×900), the list column is 546px wide,
    its 32px padding on each side included. It holds two card columns 231px wide with 20px between
    them. The chips sit on their own row, their top below the heading's bottom. The map is beside the
    list and fills the rest: 478px at 1024×900, 733px at 1279×900;
  - at 1023×900 and 390×844, the phone composition of SAVED-2: no map region and no chip displayed.
- [x] SAVED-4 · e2e — At 1440×900, with more saved cars than fit, scrolling the list moves the list
  column only:
  - the header's and the map's boxes do not move;
  - the document does not scroll (its scrolling element's scroll height equals its client height);
  - the heading and the chips go up with the cards, out of view.

Sort

- [x] SAVED-5 · unit — The saved-cars order is a pure function of the saved cars, newest first as the
  page query returns them (SAVED-34), and a sort: «Recientes», «Precio» or «Km». It gives exactly the
  orders of the worked example "Sort", where:
  - «Recientes» is newest saved first;
  - «Precio» is cheapest first and «Km» fewest kilometres first;
  - a car whose price (for «Precio») or kilometres (for «Km») is unknown, stored as 0, goes after
    every car where it is known;
  - cars that tie go newest saved first.
- [x] SAVED-6 · component — At desktop width the chips are three buttons, «Recientes», «Precio» and
  «Km», each with `aria-pressed`, exactly one pressed. With no sort in the URL «Recientes» is pressed.
  Pressing a chip presses it and puts the cards in that sort's order. The pins do not change.
- [x] SAVED-7 · unit + e2e — The sort lives in the URL as `sort`:
  - «Precio» is `sort=price` and «Km» is `sort=km`;
  - «Recientes» is the default and writes no `sort` parameter;
  - a missing, empty or unknown value (`sort=year`) reads as «Recientes», with no error;
  - opening `/favorites?sort=km` shows «Km» pressed and the cars in that order;
  - each chip pressed adds a history entry, and Back restores the previous sort.
- [x] SAVED-8 · component — At phone width the rows are newest saved first whatever the URL's
  `sort` says, and the page leaves the URL as it is.

The Guardados card (desktop)

- [x] SAVED-9 · component — A Guardados card shows:
  - the photo at 20:17, or the car's tint with the car icon when it has none or it fails to load,
    with the source badge and the heart over it;
  - the name, with the city beside it;
  - «año · km», never the fuel; each part shows only when known (MAPUI-35's rule);
  - the price, with «Ver anuncio» and its `arrow-up-right` icon on the same row.
- [x] SAVED-10 · component — The card is one link to the listing, opened in a new tab
  (`target="_blank"`, `rel="noopener noreferrer"`), and «Ver anuncio» is visible text inside it. The
  heart is a button outside that link, named «Quitar de guardados» and drawn saved (MAPUI-36).

List and map

- [x] SAVED-11 · component — At desktop width:
  - hovering or focusing a card marks its pin active (MAPUI-28);
  - activating a pin opens its preview as MAPUI-27 describes, with the heart named «Quitar de
    guardados». The pin is marked active and its card outlined. A grouped pin outlines every card of
    its group.
- [x] SAVED-12 · component — The map has one pin per saved car with coordinates. Cars at the same
  point share one pin, «N coches · desde <precio más bajo>», whose preview stacks its cars in price
  order (MAPUI-25, MAPUI-26; worked example "Grouped pin"). A car whose price is unknown, stored as
  0, is ignored for «desde» and goes after every car with a known price, as in «Precio» (SAVED-5).
  A group where every price is unknown reads «N coches · desde 0 €», as a single pin with an unknown
  price reads «0 €» on `/map` today. The pins account for exactly the cars in
  the list, after a removal and after an undo too. The map fits all the pins once, when the page
  loads. A removal or an undo does not move it, and «Acercar» and «Alejar» work as MAPUI-29 says.
- [x] SAVED-13 · component — The map's pill reads «Tus guardados en el mapa», with no role, while
  there are saved cars and while the page loads. With none it reads «Aquí saldrán tus guardados» with
  `role="status"`.

Removing a saved car (desktop)

- [x] SAVED-14 · component — Pressing the heart of a card or of the preview removes that car at once,
  before the server answers, and with no confirmation:
  - the card leaves the list, and the cards after it move up;
  - its pin leaves the map, or its group's pin loses it and relabels;
  - `removeFavorite` is called with its id;
  - the toast «Quitado de guardados» appears with «Deshacer».

  A single car's preview closes with its pin. A grouped preview stays open with the cars left
  (Decisions › Values not drawn).
- [x] SAVED-15 · component — «Deshacer» calls `saveFavorite` with that car. The car comes back at once:
  - in its place under the sort in force, also when the sort changed after the removal;
  - with its pin;
  - with its heart saved.
- [x] SAVED-16 · component — A removal the server refuses, or that throws, puts the car back in its
  place and its pin back. The «Quitado de guardados» toast gives way to the error toast (FRONT-15): the
  refusal code's `favoriteErrors.*` copy, or «Algo ha salido mal. Inténtalo de nuevo.» when it throws.
- [x] SAVED-17 · component — An undo the server refuses, or that throws, shows the same error toast.
  The car leaves the list and the map again, so it ends out of both.
- [x] SAVED-18 · component — After a removal, focus goes to:
  - the next item's first control (the card's link, or the row);
  - the previous item's, when the removed one was the last;
  - the empty state's heading, when none is left.

  This holds for the card's heart and the preview's on desktop, and for the car sheet on the phone
  (SAVED-22). Decisions › Values not drawn.

The phone

- [x] SAVED-19 · component — A compact row is one button with `aria-haspopup="dialog"`. It holds:
  - a 110×86 thumbnail, the photo or the car's tint, with no badge and no heart;
  - the name;
  - «año · km · ciudad», each part only when known;
  - the price.
- [x] SAVED-20 · component — Pressing a row opens the car sheet, a dialog named by the car's name. It
  holds:
  - the handle and «Cerrar», which is visually hidden (SAVED-41; amended 2026-10-15, owner: no visible close on phone sheets; drag down to close);
  - the photo, 200px tall, with the source badge, or the tint with the car icon;
  - the name and the city on one row;
  - «año · km · combustible», where the fuel follows MAPUI-35;
  - the price;
  - «Quitar de guardados», a button;
  - «Ver anuncio», a link to the listing in a new tab.
- [x] SAVED-21 · component — The car sheet fades and slides in and out with Motion. It closes with
  a drag down from its handle (SAVED-37), the visually hidden «Cerrar», Escape or a press outside it,
  and focus returns to its row (amended 2026-10-15, owner: no visible close on phone sheets; drag down to close).
- [x] SAVED-22 · component — «Quitar de guardados» in the car sheet does three things:
  - it closes the sheet;
  - it removes the row at once;
  - it shows «Quitado de guardados» with «Deshacer».

  «Deshacer» brings the row back in its place. A failed removal or a failed undo follows SAVED-16
  and SAVED-17, and focus follows SAVED-18.
- [x] SAVED-23 · e2e — At 390×844 the row, the car sheet's «Cerrar» once it has keyboard focus, «Quitar
  de guardados» and «Ver anuncio» each have a hit area of at least 44 × 44px (amended 2026-10-15, owner: no visible close on phone sheets; drag down to close).

Every phone bottom sheet (added 2026-10-15, owner: no visible close on phone sheets; drag down to
close)

"Phone bottom sheet" means each sheet built on `PhoneBottomSheet` with a handle: the car sheet (on
`/favorites`), the «BUSCAR» sheet (MAPUI-21) and the phone «Crear alerta» sheet
(MAPUI-39). The phone filters panel is full-screen, with no handle, and is not one (Decisions › No
visible close on phone sheets). The alert page's car sheet and its confirmation sheet, «¿Eliminar
esta alerta?», are phone bottom sheets too (amended 2026-10-15, ALERTUI-26 and ALERTUI-34 —
redesign-alerts.md).

- [x] SAVED-37 · e2e — At 390×844 no phone bottom sheet shows a close «×». Pressing the handle and
  dragging it down more than 100px closes the sheet, and focus returns to the control that opened it,
  as it does after Escape: the car sheet from a row on `/favorites` (database run) and the «BUSCAR»
  sheet from the search summary on `/map`. — Also the car sheet from a match row on `/alerts/[id]`
  and the confirmation sheet from «Eliminar alerta» (database run; amended 2026-10-15, ALERTUI-32 —
  redesign-alerts.md).
- [x] SAVED-38 · e2e — At 390×844, dragging the handle down 40px slowly (under 800px/s) and letting
  go springs the sheet back to where it was, and it stays open. Dragging from the sheet's content
  instead of the handle moves nothing: the car sheet's photo on `/favorites` (database run) and the
  «BUSCAR» sheet's body on `/map`. — Also the alert page's car sheet, from its photo, and the
  confirmation sheet, from its title (database run; amended 2026-10-15, ALERTUI-32 —
  redesign-alerts.md).
- [x] SAVED-39 · unit — The release closes the sheet when the drag went down more than 100px or the
  release moved down faster than 800px/s, and never otherwise (worked example "Drag to close").
- [x] SAVED-40 · component — Every phone bottom sheet still closes with Escape and with a press on the
  dimmed screen outside it, and focus returns to the control that opened it.
- [x] SAVED-41 · component — The car sheet's and the «BUSCAR» sheet's «Cerrar» is visually hidden
  (`sr-only`) but stays a button named «Cerrar», reachable with Tab, and pressing it closes the
  sheet. It shows only with keyboard focus (`focus-visible`), drawn at 40px with the `x` of 14px
  and a 44px hit area (SAVED-23). The phone «Crear alerta» sheet keeps «Cancelar» and has no
  «Cerrar». — The alert page's car sheet has the same visually hidden «Cerrar»; the alert's
  confirmation sheet keeps «Cancelar» and has no «Cerrar» (amended 2026-10-15, ALERTUI-26 and
  ALERTUI-34 — redesign-alerts.md).

The toast

- [x] SAVED-24 · e2e — Every toast in the app comes from the one global Toaster
  (`components/Toaster.tsx`) and sits where the Toast README and the boards draw it
  (`docs/design/system/components/Toast/README.md`, `R3-favoritos`, `F3-crear-alerta-estados`). It
  is at most 380px wide. Measured ±1px against the toast's border box:
  - **at phone width**, its top 12px below the header's bottom. Under 600px it is 16px from each
    side of the viewport: «Quitado de guardados» on `/favorites` at 390×844. From 600px to 1023px it
    is centred, at most 380px wide (amended 2026-10-15, Decisions › The toast's phone band);
  - **on `/favorites` at desktop width**, its top 12px below the header's bottom, its centre over
    the list column's centre: x = 415px at 1440×900 and 1280×900, x = 273px at 1024×900
    («Quitado de guardados»);
  - **on `/map` at desktop width**, its top 12px below the bottom of the filter row under the header,
    its centre over the results list's centre: x = 415px at 1440×900, where the list is 830px wide,
    and x = 256px at 1024×900, where it is half the width («Alerta creada», in the DB suite as
    FRONT-23's trigger);
  - **on `/alerts` and `/alerts/[id]` at desktop width**, its top 12px below the header's bottom,
    its centre over the list column's centre: x = 415px at 1440×900 and 1280×900, x = 273px at
    1024×900 (amended 2026-10-15, ALERTUI-37 — redesign-alerts.md);
  - **on any other page at desktop width**, which has no list column, its top 12px below the
    header's bottom and its centre on the viewport's centre, the README's «arriba al centro».

  Each page states its own centre because the boards centre the toast over the list on `/map` and
  on `/favorites`, never over the viewport (Decisions › One Toaster, placed per page).
- [x] SAVED-36 · component — Every toast's close button is named «Cerrar aviso» (`common.closeToast`,
  new; "Close notice" in English), in place of «Cerrar» (`common.close`), on every page. The
  Toaster renders the close button on every toast, as today.

The virtualised list (database run, 200 saved cars)

"Mounted" means present in the DOM. Each criterion below seeds 200 saved cars for one user and runs in
`pnpm test:e2e:db`.

- [x] SAVED-25 · e2e — Only the visible items and a bounded margin are mounted. At the list's top,
  middle and end, at most 30 cards are mounted at 1440×900 and at most 25 rows at 390×844. The
  arithmetic is under Worked examples.
- [x] SAVED-26 · e2e — At 1440×900, with the list at its top, activating the pin of the 150th card in
  order mounts that card, scrolls it wholly into the list column's view and outlines it, and its
  preview opens.
- [x] SAVED-27 · e2e — Back restores the list's scroll. Scroll the list until a card well down the
  list is the first wholly in view, follow the header's «Mapa» to `/map`, and go Back: that same card
  is the first wholly in view again. The same holds for a row at 390×844, which follows the tab
  bar's «Mapa».
- [x] SAVED-28 · e2e — Tab reaches every item in order. At 1440×900, Tab from «Km» goes through the
  first card's link and heart, then the second card's, and so on, ending with the 200th card's heart.
  The focused card is each time wholly in the list column's view. At 390×844, Tab goes through the
  200 rows in order.
- [x] SAVED-29 · e2e — Removal and undo keep the right items. At 1440×900, scrolled to the 150th card:
  - removing it with its heart leaves the 149th card followed by the 151st, and 199 cards in the list;
  - «Deshacer» puts the 150th back between them, with 200 in the list.

  At no point is a car shown twice, or a car's heart shown for another car.

States

- [x] SAVED-30 · component — `/favorites`' `loading.tsx` mirrors the populated page (FRONT-14):
  - at desktop width, the heading and the chips; placeholder cards shaped like the Guardados card
    (the 20:17 photo, the name, «año · km» and the price bars); and the map with no pin, only «Tus
    guardados en el mapa»;
  - at phone width, the heading and placeholder rows (the 110×86 thumbnail and three bars), with no
    chips.

  The placeholders are one region with `aria-busy="true"`, each placeholder `aria-hidden`. The region
  holds the visually hidden «Cargando…» in a polite status, the page's only live region while it
  loads.
- [x] SAVED-31 · component — With no saved car, `/favorites` shows the heading «Guardados» and the
  empty state:
  - «¿Aún nada?» over «Guarda alguno» (`h2`);
  - at desktop width, the line «Pulsa el corazón en cualquier coche y aparecerá aquí, con su precio
    del día.»;
  - at phone width, the line «Pulsa el corazón en cualquier coche y aparecerá aquí.»;
  - «Buscar coches», a link to `/map`.

  It shows no sort chips. At desktop width the map shows no pin and the pill «Aquí saldrán tus
  guardados» (SAVED-13). Removing the last saved car brings the same state, with the «Quitado de
  guardados» toast still offering «Deshacer».
- [x] SAVED-32 · component — `/favorites`' `error.tsx` is the page-error state of
  `F0-estado-error-pagina`. It shows:
  - «¿Se ha roto algo?» over «No es culpa tuya», the page's `h1`;
  - the line «Esta página no ha cargado. Vuelve a intentarlo y, si sigue, vuelve al mapa.»;
  - «Reintentar», a button that refreshes the route's server data and resets the boundary (PLAT-14);
  - «Volver al mapa», a link to `/map`.

  At desktop width the map region beside it shows no pin and no pill. The page shows no «Guardados»
  heading and no chips. The thrown error is not shown.
- [x] SAVED-33 · e2e — `/favorites` passes axe with no serious or critical violation at 1440×900 and
  at 390×844, with saved cars and with none (amends FRONT-19).

Server

- [x] SAVED-34 · node — The page query returns the signed-in user's saved cars only, newest saved
  first. Cars saved at the same instant come in a fixed order, so the order never changes between
  two reads. Soft-deleted cars are left out. Ada sees only Ada's three cars, while Grace holds one
  (worked example "Page query"). Signed out, the page redirects to
  `/login?callbackUrl=%2Ffavorites` and reads nothing (FAV-15, kept).
- [x] SAVED-35 · node — Undo restores the same row. Ada removes a car and saves it again: the same
  row comes back, with `deletedAt` null and its original `createdAt` and snapshot, even when the
  listing sent with the save differs. Grace saving the same listing id creates her own row, and
  Ada's stays removed.

## Worked examples

**Sort (SAVED-5, SAVED-6, SAVED-7).** Ada's seven saved cars. A price or km of 0 is unknown
(FAV › Data model).

| Car | Price | Km | Saved |
| --- | --- | --- | --- |
| A Audi A3 2.0 TDI | 14.500 € | 95.000 | 2026-10-01 10:00 |
| B SEAT León 1.5 TSI | 16.500 € | 64.000 | 2026-10-03 09:00 |
| C Renault Clio TCe 90 | 0 (unknown) | 71.000 | 2026-10-05 18:00 |
| D VW Golf 1.6 TDI | 11.900 € | 0 (unknown) | 2026-10-02 12:00 |
| E Kia Ceed 1.6 CRDi | 14.500 € | 81.000 | 2026-10-04 08:00 |
| F Mazda MX-5 2.0 | 21.500 € | 64.000 | 2026-09-28 20:00 |
| G Toyota Corolla 125H | 0 (unknown) | 48.000 | 2026-09-30 16:00 |

| Sort | URL | Order |
| --- | --- | --- |
| Recientes | `/favorites` | C, E, B, D, A, G, F |
| Precio | `/favorites?sort=price` | D, E, A, B, F, C, G |
| Km | `/favorites?sort=km` | G, B, F, C, E, A, D |

- **Precio:** D is 11.900 €. A and E tie at 14.500 €, so E (saved 10-04) comes before A (10-01).
  Then B at 16.500 € and F at 21.500 €. C and G have no price, so they go last, newest first: C
  (10-05), then G (09-30).
- **Km:** G is 48.000 km. B and F tie at 64.000, so B (10-03) comes before F (09-28). Then C at
  71.000, E at 81.000 and A at 95.000. D has no km, so it goes last.
- **URL:** `/favorites?sort=year` and `/favorites?sort=` show the Recientes order with «Recientes»
  pressed. Pressing «Recientes» from `?sort=price` goes to `/favorites`.
- **Phone (SAVED-8):** `/favorites?sort=price` at 390×844 lists C, E, B, D, A, G, F.

**Removal and undo (SAVED-14 to SAVED-17).** The same seven cars, sorted by «Precio» (D, E, A, B, F,
C, G).

| Step | List | Toast |
| --- | --- | --- |
| Press A's heart | D, E, B, F, C, G; A's pin gone | «Quitado de guardados» · «Deshacer» |
| «Deshacer» | D, E, A, B, F, C, G; A's pin back | — |
| Press A's heart, then «Km», then «Deshacer» | Km without A: G, B, F, C, E, D; after «Deshacer»: G, B, F, C, E, A, D | «Quitado de guardados», then none |
| Press B's heart; `removeFavorite` throws | D, E, A, F, C, G at once, then D, E, A, B, F, C, G | «Quitado de guardados», replaced by «Algo ha salido mal. Inténtalo de nuevo.» |
| Press A's heart; «Deshacer»; `saveFavorite` answers `invalidListing` | D, E, B, F, C, G; A back at once; then D, E, B, F, C, G | «No se pudo guardar ese anuncio.» |
| Press G's heart, the last card | D, E, A, B, F, C; focus on C's link (SAVED-18) | «Quitado de guardados» · «Deshacer» |

On the phone the same steps start from «Quitar de guardados» in the car sheet, which closes first
(SAVED-22).

**Grouped pin (SAVED-11, SAVED-12), from `R3-favoritos`.** The Audi A3 2.0 TDI (14.500 €) and the
Toyota Corolla 125H (19.750 €) are saved in Madrid at the same point:
- one pin, «2 coches · desde 14.500 €»;
- its preview lists the Audi, then the Corolla, each with its heart and «Ver anuncio»;
- both cards are outlined.

Removing the Audi from that preview relabels the pin «19.750 €» and leaves the preview open with the
Corolla.

**Grouped pin with an unknown price (SAVED-12; amends MAPUI-26).** Cars from the "Sort" example,
saved at the same point:
- A Audi A3 (14.500 €) and C Renault Clio (0, unknown): one pin, «2 coches · desde 14.500 €», not
  «desde 0 €». Its preview lists A, then C.
- C Renault Clio and G Toyota Corolla, both 0: one pin, «2 coches · desde 0 €». A single pin for C
  alone reads «0 €», which is what `/map` shows today (`groupPins` writes `formatPrice(0, "es")`).
- D VW Golf (11.900 €), C (0) and E Kia Ceed (14.500 €): «3 coches · desde 11.900 €», preview D, E, C.

**Page query (SAVED-34).** Ada saves `wallapop-first`, `wallapop-second` and `wallapop-third` in that
order, and Grace saves `wallapop-graces-car`. Ada's page gets `wallapop-third`, `wallapop-second`,
`wallapop-first`. Grace's page gets `wallapop-graces-car` only. After Ada removes `wallapop-second`,
her page gets `wallapop-third`, `wallapop-first`.

**Undo (SAVED-35).** Ada saved `wallapop-abc123` at 2026-10-01 10:00 with the price 14.500. She
removes it, then saves it again with a listing whose price is 13.900. The row comes back with
`deletedAt` null, `version` 2, `createdAt` 2026-10-01 10:00 and the price 14.500, as in DATA-11's
worked example: the removal sets only `deletedAt`, and the restore bumps `version`. Grace then saves
`wallapop-abc123`, which creates a second row, hers. Ada's row is unchanged.

**Viewport table (SAVED-1 to SAVED-4, SAVED-24).**

| Viewport | Header | List | Map | Sort | Toast |
| --- | --- | --- | --- | --- | --- |
| 390×844 | Phone: wordmark, language, 64px | «Guardados», compact rows; the page scrolls; tab bar at the bottom | none | none, newest first | 16px from each side, 12px below the header |
| 768×1024 (added 2026-10-15) | Phone | As 390×844 | none | none | 380px wide, centre at x = 384px, 12px below the header (Decisions › The toast's phone band) |
| 1023×900 | Phone | As 390×844 | none | none | As 390×844 |
| 1024×900 | Desktop, 80px, fixed | 546px column with its 32px padding, two 231px columns of cards; only the list column scrolls | 478px, beside the list, all the pins, the pill | chips on their own row under «Guardados» | 12px below the header, centre at x = 273px |
| 1279×900 | Desktop, fixed | As 1024×900 | 733px | As 1024×900 | As 1024×900 |
| 1280×900 | Desktop, fixed | 830px column with its 32px padding, three 242px columns of cards | 450px | chips on the heading's row | 12px below the header, centre at x = 415px |
| 1440×900 | Desktop, fixed | As 1280×900 | 610px | As 1280×900 | As 1280×900 |

The widths come from the `R3-favoritos` markup, read with the padding inside the column, as `/map`'s
list is built (`components/map/phone/ResultsSheet.tsx`: `lg:w-1/2`, `xl:w-207.5`, 830px). The 1440
board's `main` is 830px with `padding: 30px 32px`, so 766px of cards; less two 20px gaps, over three,
gives 242px. The 1024 board's is 546px, so 482px of cards; less one 20px gap, over two, gives 231px.
The boards' notes give 263px cards and a 414px map at 1024: those are the column read without the
padding inside, and the notes give way to the markup.

**Mounted bound (SAVED-25).**
- **1440×900.** The list column's view is 900 − 80 = 820px tall. A card is at least 242px wide:
  830px less 2 × 32px of padding and 2 × 20px of gaps, over three. Its 20:17 photo is therefore at
  least 205.7px tall, and with 12px and the text block a card is over 280px, in rows 28px apart. A
  row pitch over 300px means at most four rows meet an 820px view, which is 12 cards. 30 cards is
  ten rows: the four that can show and three of margin on each side. 200 mounted would mean no
  virtualisation.
- **390×844.** The view under the 64px header is 780px tall. A row is 86px with 18px to the next, a
  104px pitch, so at most ⌈780 / 104⌉ + 1 = 9 rows meet it. 25 rows is the nine plus eight of margin
  on each side.

**Drag to close (SAVED-39).** Added 2026-10-15. The offset is how far the handle went down, in px;
the velocity is the release's, in px/s, down positive.

| Offset | Velocity | Result |
| --- | --- | --- |
| 101 | 0 | closes |
| 100 | 0 | stays open, springs back |
| 40 | 801 | closes |
| 40 | 800 | stays open, springs back |
| 40 | 300 | stays open, springs back |
| -30 | -900 | stays open (upwards never closes) |

## Data model

No change: no model, column, index, migration or seed. The page reads `Favorite`, whose snapshot
already holds every field the sort and the map use: `price`, `mileage`, `lat`, `lng` and `createdAt`
(`prisma/schema.prisma`). Undo reuses the restore of DATA-11. The upsert's update branch clears
`deletedAt` and writes neither the snapshot nor `createdAt`, so a restored car keeps its saved
price and its place in «Recientes» (SAVED-35).

## Permissions

- Every read and write is the owner's own, through `getCurrentUser()` and `ownedBy()`
  (`lib/auth/permissions.ts`), as today:
  - the page query (`server/favorites/queries.ts` → `findFavorites`), SAVED-34;
  - `removeFavorite` (FAV-6) and `saveFavorite` (FAV-5) behind the removal and the undo, SAVED-35.
- Signed out, `/favorites` redirects to sign-in with its `callbackUrl` (FAV-15). The proxy's redirect
  is UX; the page query's `getCurrentUser()` is the check.
- `RULES.md` §10: the page query is permission-filtered, and SAVED-34's integration test proves that
  Ada never receives Grace's cars. SAVED-35's proves that an undo cannot restore another user's row.
- The sort is display only: it reorders what the owner already received and grants nothing.

## Edge cases

- **Unknown price or km:** last, newest first among them (SAVED-5).
- **A tie:** newest saved first. Cars saved in the same instant keep the page query's fixed order
  (SAVED-34), so the list never reshuffles between renders.
- **An unknown `sort`:** «Recientes» (SAVED-7).
- **A sorted link opened on a phone, or a window narrowed below 1024px:** newest first, with the URL
  left alone, so widening again brings the sort back (SAVED-8).
- **Exactly 1024px wide:** desktop; 1023px is the phone (SAVED-3).
- **Removing the last saved car:** the empty state, with «Deshacer» still in the toast (SAVED-31).
- **Two removals in a row:** each has its own toast and its own «Deshacer», and each undo restores
  only its own car.
- **Changing the sort while «Deshacer» is offered:** the undone car takes its place under the new
  sort (SAVED-15, worked example).
- **Removal or undo failing:** SAVED-16, SAVED-17.
- **«Deshacer» pressed before the removal answers** (added 2026-10-15, confirmed by the owner 2026-10-15): the car stays; if the
  removal then fails, no error toast, because the car is saved either way.
- **Leaving `/favorites`** (added 2026-10-15, confirmed by the owner 2026-10-15): it dismisses its removal toasts, so «Deshacer» is
  never offered on another page.
- **The removal toast's duration** (added 2026-10-15, confirmed by the owner 2026-10-15): the removal
  toast stays 8 seconds, so a keyboard user has time to reach «Deshacer».
- **Removing a car whose preview is open:** a single car's preview closes with its pin. A grouped
  preview stays open with the cars left (SAVED-14).
- **Two saved cars at one point:** one grouped pin, every card of the group outlined (SAVED-11).
- **An unknown price in a grouped pin:** ignored for «desde» and listed last; a group of unknown
  prices only reads «N coches · desde 0 €» (SAVED-12). The same holds on `/map` (MAPUI-26).
- **A saved car without coordinates:** in the list with no pin. Every source gives every listing a
  point (SRC-3), so this is a guard, as on `/map`.
- **No photo, or a photo that fails:** the car's tint with the car icon, on the card, the row's
  thumbnail and the sheet (SAVED-9, SAVED-19, SAVED-20).
- **Long names and cities:** they truncate on one line. The city never takes more than two fifths of
  the name's row, as on the map card.
- **The session ending while on the page:** a removal or undo is refused with `unauthenticated` and
  takes SAVED-16 or SAVED-17's path. The next navigation reaches sign-in (FAV-15).
- **A long list:** only what is visible is mounted (SAVED-25). Pin, Back, Tab and removal still
  behave (SAVED-26 to SAVED-29).
- **The page read failing:** the page error (SAVED-32).
- **A stale snapshot:** shown as saved, with no notice and no refresh (Decisions › No staleness
  notice).

## Out of scope

- **Refreshing a saved car's price and availability:**
  [#128](https://github.com/algusaem/buycarmap/issues/128). The snapshot stays as it was saved.
- **Filtering or paginating the saved cars.** The list is virtualised, not paged.
- **The car sheet on `/map`.** The BottomSheet and MapPreview READMEs say a map pin opens the car
  sheet. F5 builds the sheet for `/favorites` only, and `/map` keeps MAPUI-24: a pin moves the
  results sheet to its middle position. The alert's matches are F6.
- **`/alerts` and `/alerts/[id]`** (F6). They keep the shared `RouteError` and the map's card until
  then. The page-error state of `F0-estado-error-pagina` reaches only `/favorites` here. The other
  pages get it in F6 and F7.
- **A sort on the phone, or on `/map`** (the Chip README: the map has no sort control).
- **Signed-out saved cars**, stored locally (FAV, kept out).
- **Keyboard, screen-reader and real-iPhone checks beyond axe**
  ([#127](https://github.com/algusaem/buycarmap/issues/127)).

## Contracts

**URL.** The sort is one nuqs parameter, `sort`, with the values `price` and `km`. «Recientes» is the
parser's default: nuqs drops a default from the URL (`clearOnDefault`), as for every field in
`lib/search/url-state.ts` except `radius`, which opts out. A value outside the list parses to the
default. A chip writes with `history: "push"`, as the map's filters do (FRONT-13, MAPUI-49). The
write is shallow: the client sorts (Decisions › The client sorts), so it needs no server round trip.

**Server.** No new action and no new query.
- `listFavoritesForPage()` (`server/favorites/queries.ts`) keeps its signature. `findFavorites`
  (`server/favorites/service.ts`) orders by `createdAt` descending, then by `id` descending, so two
  rows saved in the same millisecond keep one order (SAVED-34). The `id` is a UUIDv7, which is
  time-ordered.
- The removal is `removeFavorite(listingId)`, and the undo is `saveFavorite(listing)` with the
  listing the page already holds (`server/favorites/actions.ts`). Both return the shared `Result`,
  and their error codes are unchanged: `unauthenticated` and `invalidListing`.

**Client.**
- The page's list state lives in a hook in `lib/hooks/`, as every request lifecycle does (ADR 0007
  row 19). It holds the server's list less the cars removed, derives the shown order from the sort,
  and returns failure copy for the caller to toast (FRONT-15: a hook never toasts).
- The sort is one pure function (SAVED-5), unit-tested with the worked example.
- Reused from F3:
  - `ListingsMap`, with its pins, grouping (`groupPins`) and `MapPreview`;
  - `CarPhoto` and `HeartButton` (`components/map/CarCard.tsx`);
  - `PhoneBottomSheet` (`components/map/phone/SheetChrome.tsx`);
  - `EmptyState` and `Headline`;
  - the Toaster, whose `actionButton` is already styled for «Deshacer». It changes for every page:
    its position (SAVED-24) and its close button's name (SAVED-36);
  - `useFavoriteToggle` and `useIsPhone`.
- New: the Guardados card variant, the compact row, the car sheet, the sort chips and the saved map's
  pill. `StatusPill` (`components/map/ResultsStates.tsx`) derives its text from the map's
  `ResultsState`, so the saved map's pill takes its text, and whether it is a status, from its
  caller instead.

**Dependency.** `@tanstack/react-virtual`, for the list (SAVED-25 to SAVED-29). The owner approved it
on 2026-10-15. Its ADR is 0021, the next free number in `docs/decisions/`, and it is written in the
implementation step with the version installed. That version is not chosen here.

**Tests.** The virtualisation criteria seed 200 saved cars and need a database, so they run in
`pnpm test:e2e:db` (`pnpm db:branch` first), not in CI, like MAPUI-47. jsdom does no layout, so a
component test cannot measure what a virtualiser mounts.

**Surface brief.** `/favorites`' Impeccable brief is
[`.impeccable/surfaces/favorites.md`](../../.impeccable/surfaces/favorites.md) (`STACK.md` §17).

**i18n keys**, both locales (`messages/es.json`, `messages/en.json`, `lib/i18n/types.ts`). The design
gives Spanish only. English is drafted here and reviewed in the pull request, as in MAPUI.

| Text | Key | Status | English (draft) |
| --- | --- | --- | --- |
| «Guardados» (heading, browser title) | `favorites.title` | changed, from «Coches guardados» | "Saved" (was "Saved cars") |
| «Los precios son del día en que los guardaste.» | `favorites.subtitle` | removed | — |
| «Todavía no has guardado ningún coche.» | `favorites.empty` | removed | — |
| «Recientes» | `favorites.sortRecent` | new | "Recent" |
| «Precio» | `favorites.sortPrice` | new | "Price" |
| «Km» | `favorites.sortKm` | new | "Mileage" |
| «Mapa de tus guardados» (map region) | `favorites.mapLabel` | new | "Map of your saved cars" |
| «Tus guardados en el mapa» (pill) | `favorites.mapTitle` | new | "Your saved cars on the map" |
| «Aquí saldrán tus guardados» (empty pill) | `favorites.mapEmpty` | new | "Your saved cars will show here" |
| «¿Aún nada?» | `favorites.emptyTitle` | new | "Nothing yet?" |
| «Guarda alguno» | `favorites.emptyPunchline` | new | "Save one" |
| «Pulsa el corazón en cualquier coche y aparecerá aquí, con su precio del día.» | `favorites.emptyLine` | new | "Tap the heart on any car and it will show up here, with that day's price." |
| «Pulsa el corazón en cualquier coche y aparecerá aquí.» | `favorites.emptyLinePhone` | new | "Tap the heart on any car and it will show up here." |
| «Buscar coches» | `favorites.emptyCta` | existing | "Search for cars" |
| «Quitado de guardados» | `favorites.removed` | new | "Removed from saved" |
| «Deshacer» | `favorites.undo` | new | "Undo" |
| «Cerrar aviso» (every toast's close button) | `common.closeToast` | new | "Close notice" |
| «Esta página no ha cargado. Vuelve a intentarlo y, si sigue, vuelve al mapa.» | `errors.pageLine` | new | "This page didn't load. Try again and, if it keeps happening, go back to the map." |
| «¿Se ha roto algo?» / «No es culpa tuya» | `errors.pageTitle`, `errors.pagePunchline` | existing | "Did something break?" / "It's not your fault" |
| «Reintentar» | `errors.retry` | existing | "Retry" |
| «Volver al mapa» | `nav.backToMap` | existing | "Back to map" |
| «Quitar de guardados» (heart, sheet button) | `map.removeFavorite` | existing | "Remove from saved" |
| «Ver anuncio» | `map.viewListing` | existing | "View listing" |
| «Vista previa del coche», «Cerrar vista previa» | `map.preview`, `map.closePreview` | existing | "Car preview", "Close preview" |
| «N coches · desde …» | `map.pinGroup` | existing | "{count} cars · from {price}" |
| «Cerrar» (car sheet) | `common.close` | existing | "Close" |
| «Cargando…» (loading, visually hidden) | `map.loading` | existing | "Loading…" |
| Failure toasts | `favoriteErrors.*`, `alertErrors.unexpected` | existing | — |

`errors.pageLine` sits under `errors.*` rather than `favorites.*` because the board is titled
"Cualquier página": F6 and F7 reuse it. `errors.pageLoadFailed` stays while `RouteError` serves
`/alerts`. `map.backToHome` stays too: `/alerts` still uses it.

**Criteria amended** (in the same change, each statement kept and marked with a dated note):
- **`favorites.md` (FAV):**
  - FAV-10 and FAV-11: on `/favorites` the toggle is the removal. The car leaves the list at once,
    and a failure puts it back in its place (SAVED-14, SAVED-16);
  - FAV-13: the stored data renders as the Guardados card, the compact row and the map (SAVED-9,
    SAVED-12, SAVED-19);
  - FAV-14: the empty state is «¿Aún nada? / Guarda alguno» (SAVED-31);
  - Out of scope: sorting moves into scope here, while filtering and paginating stay out;
  - the snapshot decision: the page no longer states the staleness, and refreshing is #128;
  - Open question 4: the map on the page is built here;
  - stale facts:
    - the `unexpected` error code, which does not exist;
    - `en.ts` / `es.ts`, which are `messages/en.json` / `messages/es.json`;
    - `cuid()`, which is `uuid(7)`;
    - "no test database", which the integration project now provides.
- **`redesign-map.md` (MAPUI):**
  - MAPUI-35: the Guardados variant shows «año · km» and «Ver anuncio» inside the link;
  - MAPUI-38: `/favorites` renders the Guardados variant on desktop and the compact row on the
    phone, while an alert's matches keep the map card until F6;
  - MAPUI-26: a listing with an unknown price (0) is ignored for «desde» and goes after every
    listing with a known price; a group of unknown prices only reads «N coches · desde 0 €» (SAVED-12,
    worked example "Grouped pin with an unknown price");
  - MAPUI-42: the «Alerta creada» toast, and every other toast on `/map`, sits 12px below the
    filter row, centred over the results list at desktop width, and its close button is «Cerrar
    aviso» (SAVED-24, SAVED-36);
  - MAPUI-52: the current tab's label is in the text colour, at weight 800, and its icon stays
    violet, «Cuenta»'s filled circle included (SAVED-33).
- **`core-frontend.md` (FRONT):**
  - FRONT-14: `/favorites`' states are SAVED-30 to SAVED-32, and its error is the page error with
    «Reintentar» and «Volver al mapa» rather than inline;
  - FRONT-19: `/favorites` at desktop and phone width (SAVED-33);
  - FRONT-23: every toast in the app sits where the Toast README draws it, placed per page
    (SAVED-24), and its close button is «Cerrar aviso» (SAVED-36). Its colours are unchanged. The
    move is a change to the toast's look, so FRONT-23's screenshots on mobile and desktop are owed.

  FRONT-20 is kept unamended: the F5 screenshots are owed under it and `RULES.md` §22.
- **`core-platform.md` (PLAT):** PLAT-14. `/favorites`' error file is now the page-error state of
  SAVED-32. Its retry is unchanged, and `/alerts` and `/alerts/[id]` keep `RouteError`.
- **`redesign-navigation.md` (HEAD): none.** No HEAD criterion covers the page's back arrow. It is
  page layout, which HEAD leaves to F3–F7. With the arrow gone, the way back is the header's «Mapa»
  (HEAD-3) and the tab bar's (MAPUI-52). HEAD-19 keeps binding: the phone page scrolls past the tab
  bar.

## Decisions and rationale

**The client sorts.** The server was the first choice, and two facts rule it out:
- **The phone always shows newest first** (owner decision). The server renders before it knows the
  viewport width. A server order taken from `sort` would show a phone that opened
  `/favorites?sort=price` a price order, with no chip to undo it.
- **Unknown values go last.** A price or km of 0 last is not expressible in a Prisma `orderBy` on an
  `Int` column without raw SQL, which needs approval (`RULES.md` §1, §11), or two queries joined in
  `service.ts`.

The client already holds every saved car: the page has no pagination. The server keeps one order,
newest first with `id` as the tie-break, so every client sort is a stable sort over a fixed list.
Ties come out newest first with no extra field, and a virtualised list sees the same order on every
render, which is the stability the server would have given. Undo needs no position bookkeeping.
The client keeps the server's list and hides the removed cars, so an undone car reappears wherever
the current sort puts it, even after a sort change. The cost is the comparator living in the
client, so it is one pure function tested against the worked example.

**Sort in the URL, the default left out** (`RULES.md` §19, «URL reflects state»). A shared or
reloaded link keeps its order, and Back walks the choices, as the map's filters do. Leaving
«Recientes» out keeps `/favorites` the canonical link. An unknown value falls back rather than
erroring, because it comes from a hand-edited or old link. The phone ignores the parameter instead
of removing it, so narrowing and widening a window does not lose the choice.

**No staleness notice** (owner decision, 2026-10-15). The subtitle is gone, as in the design. The
snapshot stays as it was saved and is not refreshed. The owner's view is that a snapshot price makes
no sense in the long run, which is why refreshing is its own issue,
[#128](https://github.com/algusaem/buycarmap/issues/128), and not a notice explaining the problem.

**Removal with undo, no confirmation** (owner decision). `RULES.md` §19 asks to confirm destructive
actions or provide an undo window. Removing a saved car is cheap to reverse, since the row is
soft-deleted (DATA-10) and saving again restores it whole (DATA-11). So the toast's «Deshacer» is the
undo window, and a dialog would only slow the common case. That window is the removal toast's 8
seconds (Edge cases, added 2026-10-15, confirmed by the owner 2026-10-15). Both the removal and the undo are
optimistic, like every toggle of the heart (FAV-10). A failed undo therefore shows the car back for
the length of the request, then takes it out again with the error toast. The owner's «the item stays
out» is read as the end state.

**One link per card, «Ver anuncio» inside it** (owner decision). The board draws «Ver anuncio» as a
second link beside the price. Two links to the same URL in one card mean two tab stops and two
announcements for one destination. MAPUI-35 already made the whole card one link. «Ver anuncio»
becomes visible text inside that link, and the heart stays outside it, as `CarCard` does.

**The phone: rows and a car sheet** (owner decision). A row shows three times the cars of a card. The
sheet holds what the desktop preview holds, plus the removal. It is built for `/favorites` only. The
READMEs also give it to a map pin, but `/map` keeps MAPUI-24's results sheet, and changing it is not
F5's.

**The map from 1024px** (owner decision). Two columns from 1024px to 1279px, with the chips moved to
their own row because the heading and three chips do not fit beside each other. The 830px list of
`/map` from 1280px. Below 1024px, no map and no sort, the same boundary as `useIsPhone`. The header
stays fixed and only the list scrolls, so the map with every pin stays in view while the buyer reads
down the list.

**Virtualised** (owner approval, 2026-10-15, for `@tanstack/react-virtual`;
[ADR 0021](../decisions/0021-react-virtual.md)).
`RULES.md` §19 requires it past 50 items, and a saved list is unbounded. Virtualising breaks what the
browser gives a plain list for free:
- a pin's card may not be mounted;
- Back has no element to restore to;
- Tab skips unmounted items;
- a removal shifts every index.

So each of these is a criterion (SAVED-26 to SAVED-29), with the mounted count bounded (SAVED-25).

**The page error is built here, for `/favorites` only.** The roadmap lists `F0-estado-error-pagina`
under F7, and the owner moved `/favorites`' use of it into F5, since the board is drawn on Guardados.
«Reintentar» is a button, although the board draws it as a link, because it retries in place and
goes nowhere (`RULES.md` §18). Its headline is the page's `h1`, because nothing else renders, as
MAPUI-34 decided for the map.

**Loading is announced once.** The design marks the loading list `aria-busy`. `aria-busy` alone is
not announced by most screen readers, and the saved map's pill has no role while loading. So the
busy region holds a visually hidden «Cargando…» in a polite status, the page's only live region at
that moment. This avoids MAP-20's problem of two status regions on the map.

**One Toaster, placed per page** (decided 2026-10-15). The Toaster stays one global instance and
moves for the whole app, «Alerta creada» included, since a design fix goes to every screen. Today it
sits at `top-center` with Sonner's default offset, centred on the viewport, and its close button is
«Cerrar» (`common.close`). The boards draw something else:
- `R3-favoritos` at 1440: the toast's box at `top: 93px; left: 225px`, 380px wide, under an 80px
  header with a 1px border. That is 12px below the header, centred at x = 415px, the centre of the
  830px list, not the viewport's 720px;
- `F3-crear-alerta-estados` at 1440: «Alerta creada» at `top: 162px; left: 225px`, centred over the
  830px results list too. Its top is 14px below the filter row, which ends at 148px (an 80px header
  and a 66px row, each with a 1px border). The README's 12px is the rule, and that board must be
  amended to it before the build (CLAUDE.md › Design first);
- `R3-favoritos` names the close button «Cerrar aviso»; `F3-crear-alerta-estados` still draws
  «Cerrar», and must be amended to «Cerrar aviso» in the same pass.

No board centres a desktop toast on the viewport, so a single viewport rule would contradict both.
The rule is per page: over the list column where a page has one beside a map (`/map`, `/favorites`),
on the viewport where it has none, as the README's «arriba al centro» says. On the phone it is one
rule everywhere: 16px from the sides and 12px below the header. The close button takes a new key
rather than changing `common.close`, which other «Cerrar» buttons use.

**The toast's phone band** (decided 2026-10-15). Under 1024px the toast follows the phone rule, but
Sonner's own mobile layout, which stretches the toast between two side offsets, starts only under
600px. «16px from each side» and «at most 380px» cannot both hold past 412px (380 + 2 × 16), so
from 600px to 1023px the toast is centred at its 380px, and under 600px it is 16px from each side.

**An unknown price in a grouped pin** (decided 2026-10-15). `groupPins` sorts a group by price, so a
car with a price of 0 came first and the pin read «desde 0 €». The group now ignores 0 for «desde»
and lists it last, the owner-approved «unknown last» rule of «Precio» (SAVED-5). A group of unknown
prices only keeps «desde 0 €», the same text a single unknown-price pin shows on `/map` today. The
rule holds on `/map` too, so it amends MAPUI-26.

**List widths from the markup** (decided 2026-10-15). The `R3-favoritos` notes give 263px cards at
both widths, which the markup's column with its padding inside does not fit. The widths follow the
markup, read as `/map`'s list is built: 830px with the padding inside from 1280px, three columns;
546px with the padding inside from 1024px to 1279px, two columns (SAVED-3, viewport table).

**The current tab's label in the text colour** (owner decision, 2026-10-15). Violet `#7C4DFF` on
`surface` `#18181B` measures 3.68:1 at 11px bold, under WCAG's 4.5:1 for text, and axe fails it at
390×844 (SAVED-33), so the label takes `text` and the icon keeps the violet (amends MAPUI-52).

**Values not drawn in the design, decided 2026-10-15:**
- after a removal, focus goes to the next item, the previous when it was last, or the empty state's
  heading. This follows MAPUI-13's chip removal;
- a grouped preview stays open with the cars left after one is removed, and a single car's closes,
  since its pin is gone;
- a grouped pin scrolls the first of its cards in list order into view. Worked example, added
  2026-10-15: the list is the Toyota Corolla 125H at the Audi's point in Madrid (19.750 €), then the
  Audi A3 2.0 TDI, then the SEAT León. Activating the Audi's pin scrolls to index 0, the Corolla's
  card; both cards are outlined, and the preview opens on the Audi, the cheaper. A car with no
  coordinates has no pin: activating it scrolls nowhere (-1) and opens no preview;
- «Acercar» and «Alejar» stay on the saved map. The MapZoom README puts them on every desktop map,
  though the Guardados boards do not draw them;
- the parameter values `sort=price` and `sort=km`;
- the chips as `aria-pressed` buttons with no group name, so they need no new string.

**No visible close on phone sheets** (owner decision, 2026-10-15: «lo de los items, son en todas las
que son así, es que eso es mobile, no tiene sentido alguno que tenga la X»). A bottom sheet on a phone
is closed by dragging it down or pressing outside it, so a drawn «×» is noise. Every sheet built on
`PhoneBottomSheet` with a handle drops it: the handle drags the sheet down to close it, a press
outside and Escape still close it, and a visually hidden «Cerrar» stays for screen-reader and
keyboard users, shown only with keyboard focus so the focus ring stays visible (`RULES.md` §19). The
drag starts from the handle strip only, so a sheet's own scroll is never taken over, and the threshold
is 100px or a release faster than 800px/s: far enough not to close by accident, near enough for one
thumb movement. With reduced motion the spring back is instant. The phone filters panel is a
full-screen dialog with no handle, so it keeps its «×» (MAPUI-22): without it, it would have no
visible way to discard. Dragging the results sheet between its positions stays out of scope
([#126](https://github.com/algusaem/buycarmap/issues/126)). (Amended 2026-10-17: in scope in redesign-map.md, MAPUI-58 to MAPUI-62, #133.)

**Raw SQL in the e2e fixture** (owner approval, 2026-10-15, `RULES.md` §11). `seedFavorites` in
`e2e/fixtures/db.ts` writes its rows with a raw `INSERT`, because `created_at` can only be set by a
direct insert: the app's own save path always stamps the current time.

**The list query checked with `EXPLAIN`** (owner approval, 2026-10-15, raw SQL in that test only).
`STACK.md` §16 asks for the query plan at a realistic volume, and Prisma has no `EXPLAIN`.
`server/favorites/queries.integration.test.ts` seeds 200 users × 50 saved cars, every tenth
soft-deleted, runs `ANALYZE`, and asserts that `findFavorites`' shape reads `favorites` through an
index, never a `Seq Scan`.

**The plan's outcome** (decided 2026-10-15). At that volume Postgres reads one user's rows with a
Bitmap Index Scan on `favorites_user_id_listing_id_key`, then a Bitmap Heap Scan and a Sort on
`created_at DESC, id DESC`. No `Seq Scan`, so no new index: the sort runs over one user's rows only.
