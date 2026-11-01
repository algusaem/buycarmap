# Redesign F6 — alerts

Key: ALERTUI
Status: Implemented
Last updated: 2026-10-31

---

## Problem

`/alerts` and `/alerts/[id]` are where a buyer checks what their saved searches have found. Both still
wear the pre-redesign look, and neither behaves the way the approved design draws it. The design is
`docs/design/canvas/R3-alertas.dc.html`, `F6-alerta.dc.html`, `F6-alerta-estados.dc.html`,
`F6-alertas-escritorio.dc.html`, `F6-alerta-escritorio.dc.html`, `F6-alerta-mas-estados.dc.html`,
`F0-estado-alertas-vacio.dc.html` and `F0-estado-error-pagina.dc.html`, with the AlertCard, AlertZone,
ListingCard, BottomSheet, MapPreview, PricePin, StatusPill, EmptyState, Toast, Chip, Button and
HeaderNav READMEs, accepted by the owner on 2026-10-15.

- **No map.** An alert watches a zone, and neither page shows it. The design never shows Alertas
  without its map on desktop: the open alert's zone, its pins and a pill naming it.
- **One row per alert, every alert alike.** `/alerts` lists each alert as a name, a summary and a
  count. The design opens one alert with its criteria and its newest matches, folds the others to one
  line, and links to the alert's page when it has found more than it shows.
- **A summary the buyer cannot read.** The row writes «Toyota · Corolla · ≤ 18.000 € · 50 km». It
  never names the fuel, never names the place, and writes the price and the mileage with «≤». The
  design writes «Toyota Corolla · Híbrido · Hasta 18.000 € · Madrid · 50 km». The place name is not
  stored anywhere, so no page can show it today.
- **The phone gets the desktop grid.** `/alerts/[id]` shows the map's 250px card at every width. The
  design gives the phone a page with the zone, compact rows and a car sheet.
- **A saved car shows as unsaved.** An alert's match that the buyer has already saved shows an empty
  heart, because the card starts unsaved whatever the buyer's favorites say.
- **Deleting is one tap and silent.** The bin icon deletes the alert at once, with no confirmation.
  The design asks first.
- **A page that mounts every match.** An alert's page renders every match at once, photo included
  (`RULES.md` §19: virtualise lists over 50 items).
- **The states are the old ones.** Loading is a generic grid. Empty is a bell icon and one line. The
  error is a centred icon with «No se pudo cargar esta página», with no way back to the map.

In scope:
- `/alerts` at desktop and phone width: its title, the AlertCard (open, folded and phone), the alert
  map with its zone, pill, pins and preview, and which alert is open, in the URL;
- `/alerts/[id]` at desktop and phone width: its header and «Volver», the criteria, the zone, the
  matches (the Guardados card on desktop, the compact row and the car sheet on the phone), the map;
- the saved state of every match, read from the buyer's favorites;
- deleting an alert, with confirmation;
- storing the place name an alert is created with;
- the match list of `/alerts/[id]`, virtualised at both widths;
- both routes' loading, empty and error states.

## Acceptance criteria

Here "desktop width" is 1024px and up and "phone width" is under 1024px, the boundary `useIsPhone`
uses (`lib/hooks/useIsPhone.ts`: `(width < 64rem)`). "The open alert" is the one alert `/alerts` shows
open at desktop width (ALERTUI-12). "A match" is an `AlertMatch` row, rendered from its stored
snapshot. "Newest first" is by `createdAt` descending, then `id` descending. "The zone" is the alert's
criteria point and radius; an alert "has a place" when its criteria hold a `latitude` and a
`longitude`.

`/alerts`

- [x] ALERTUI-1 · component — At desktop width `/alerts` shows:
  - the page heading «Alertas» (`h1`, drawn in capitals) and, on its row, «Nueva alerta», a link to
    `/map`;
  - the line «El que no corre vuela, guárdalo y nosotros te avisamos.»;
  - the user's alerts as AlertCards, newest first, the open one open (ALERTUI-7) and every other
    folded (ALERTUI-6);
  - the map, a region named «Mapa de la alerta», with the open alert's zone, pill and pins
    (ALERTUI-14 to ALERTUI-17).

  It shows no back link to `/map`. The browser title is «Alertas · Buy Car Map».
- [x] ALERTUI-2 · component — At phone width `/alerts` shows:
  - the phone header (MAPUI-54), with no «Volver»;
  - the heading «Alertas»;
  - the user's alerts as phone AlertCards, newest first (ALERTUI-28);
  - the tab bar with «Alertas» current (MAPUI-52).

  It shows no map, no «Nueva alerta», no line under the heading, no match and no «Eliminar».
- [x] ALERTUI-3 · e2e — The layout of `/alerts` by width follows the viewport table under Worked
  examples. Widths are border boxes, ±1px:
  - from 1280px wide (measured at 1440×900 and 1280×900), the list column is 830px wide, its 32px
    padding on each side included. The open card's matches sit in four columns 170.5px wide with
    14px between them. The map fills the rest of the width: 610px at 1440×900, 450px at 1280×900;
  - from 1024px to 1279px wide (measured at 1024×900 and 1279×900), the list column is 546px wide,
    its 32px padding on each side included. The open card's matches sit in two columns 213px wide
    with 14px between them. The map is beside the list and fills the rest: 478px at 1024×900, 733px
    at 1279×900;
  - at 1023×900 and 390×844, the phone composition of ALERTUI-2: no map region.
- [x] ALERTUI-4 · e2e — At 1440×900 and 1024×900, with more alerts than fit, scrolling the list column
  moves the list column only: the header's and the map's boxes do not move, the document does not
  scroll (its scrolling element's scroll height equals its client height), and the heading goes up
  with the cards. The same holds on `/alerts/[id]` with more matches than fit.

The AlertCard

- [x] ALERTUI-5 · unit — An alert's criteria are a pure function of its stored criteria and its stored
  place name. They are, in this order, each only when set:
  - the car: «Marca» or «Marca Modelo» (`carLabel`);
  - the stored `?q=` text, in «…» (DESC-30) (amended 2026-10-31, DESC — map-description-search.md);
  - each fuel group (MAPUI-15), as the filters row writes it;
  - the price: «Hasta 18.000 €», «Desde 3.000 €» or «3.000 – 20.000 €» (`priceLabel`);
  - the gearbox, «Manual» or «Automático»;
  - the mileage, «Hasta 120.000 km», as on the map (MAPUI-13); a minimum reads «Desde 50.000 km» and both
    «50.000 – 100.000 km» (amended 2026-10-31, MAPUI-75);
  - the year, «Desde 2017»;
  - the zone: «Madrid · 50 km» with a place name, «50 km» when the alert has a place but no place
    name, and nothing when it has no place.

  They never include «Publicado», even when the stored criteria hold it, and never
  «Cualquier marca» or «Cualquier precio». They give exactly the worked example "Criteria".
- [x] ALERTUI-6 · component — A folded AlertCard shows:
  - the alert's name, drawn in capitals;
  - «En pausa» beside the name when the alert is paused (`active` false);
  - the match count (ALERTUI-9), on the name's row;
  - the criteria of ALERTUI-5 on one line, separated by « · »;
  - «Creada el …» (ALERTUI-10).

  It shows no match, no «Ver las … coincidencias» and no «Eliminar».
- [x] ALERTUI-7 · component — The open AlertCard has a lime border and shows:
  - the name, «En pausa» when paused, and the match count, as the folded card does;
  - the criteria of ALERTUI-5 as chips, in that order;
  - the alert's four newest matches as alert match cards (ALERTUI-8), or every match when it has
    four or fewer;
  - «Ver las N coincidencias», a link to `/alerts/<id>`, under them, only when the alert has more
    than four matches;
  - «Creada el …» and, on the same row, «Eliminar», a button (ALERTUI-33).
- [x] ALERTUI-8 · component — An alert match card shows the photo, 110px tall, or the car's tint with
  the car icon when it has none or it fails to load; the source as text; the name; «año · km», each
  part only when known (MAPUI-35's rule, with no fuel); and the price. The card is one link to the
  listing, opened in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). It has no heart and
  no source badge.
- [x] ALERTUI-9 · unit — The match count reads «Sin coincidencias» for 0, «1 coincidencia» for 1 and
  «N coincidencias» above 1. The same text is the AlertCard's badge, the phone AlertCard's and the
  heading of the alert page's matches (worked example "Count").
- [x] ALERTUI-10 · unit — «Creada el …» writes the alert's `createdAt` as the day and the month in
  the page's locale and in next-intl's time zone, with the year only when it differs from the current
  year in that time zone. The date comes from one formatter in `lib/format.ts` (amends FRONT-11), and
  gives exactly the worked example "Created on".
- [x] ALERTUI-11 · component — At desktop width, pressing a folded AlertCard opens it and folds the
  one that was open. The map then shows the newly open alert's zone, pill and pins, and fits them as
  ALERTUI-16 says. A folded card is one button with `aria-expanded="false"`, named by the alert's
  name. The open card is not a button. — the card opens with no fade (MOTION-9) (amended 2026-10-18,
  MOTION — motion.md)

Which alert is open (desktop)

- [x] ALERTUI-12 · unit + e2e — The open alert lives in the URL as `alert`, the alert's id:
  - with no `alert`, the open alert is the newest;
  - opening the newest writes no `alert` parameter, and opening any other writes `alert=<id>`;
  - a missing, empty, malformed or unknown id, another user's alert or a deleted one reads as the
    newest, with no error, and the page leaves the URL as it is;
  - opening `/alerts?alert=<id>` of one of the user's alerts shows that alert open;
  - each card pressed adds a history entry, and Back restores the alert open before it.

  The worked example "Open alert" gives the cases.
- [x] ALERTUI-13 · component — At phone width the cards are as ALERTUI-2 says whatever the URL's
  `alert` says, and the page leaves the URL as it is.

The alert map (desktop, `/alerts` and `/alerts/[id]`)

- [x] ALERTUI-14 · component — When the alert has a place, the map draws its zone: a circle at the
  criteria point with the criteria radius and a centre dot, both `aria-hidden`, under the pins. When
  it has no place, the map draws no circle and no centre dot.
- [x] ALERTUI-15 · component — The map's pill, with no role, reads:
  - the alert's name, then « · » and the zone in lime, «Corolla híbrido · Madrid · 50 km», when the
    alert has a place name;
  - «Clio barato · 50 km», the radius alone in lime, when it has a place but no place name;
  - the name alone, «Serie 3 diésel», when it has no place.
- [x] ALERTUI-16 · component — The map has one pin per match with coordinates: every match of the
  alert, not only the four the open card shows. Matches at the same point share one pin, «N coches ·
  desde <precio más bajo>», whose preview stacks its cars in price order, with an unknown price
  ignored for «desde» and listed last (MAPUI-25, MAPUI-26, SAVED-12). The map fits the zone and every
  pin together once, when the alert opens; with no zone, every pin; with neither, it shows its
  default view, the one it starts with, also when the alert open before had a zone or pins
  (amended 2026-10-16, after the build's third review). «Acercar» and «Alejar» work as MAPUI-29 says.
- [x] ALERTUI-17 · component — The list and the map are in sync:
  - hovering or focusing a match card (ALERTUI-8 on `/alerts`, the Guardados card on
    `/alerts/[id]`) marks its pin active (MAPUI-28);
  - activating a pin opens its preview as MAPUI-27 describes, marks the pin active and outlines its
    card, or every card of its group for a grouped pin;
  - on `/alerts`, a pin whose match is not among the four the open card shows opens its preview and
    outlines no card — the photo's lime ring shows while a card's link has keyboard focus, whatever
    the pointer does and whether or not the car has a pin; the link draws no second outline
    (MAPUI-66, amended 2026-10-18, #134).

The saved state of a match

- [x] ALERTUI-18 · component — Every heart and saved-state button of a match reads the signed-in
  user's favorites, as `/map` does (`useFavorites`): the Guardados card's heart on `/alerts/[id]`, the
  preview's heart on both desktop routes and the car sheet's button on the phone. A match whose
  listing is saved shows «Quitar de guardados», drawn saved (MAPUI-36); any other shows «Guardar».
  Pressing it saves or removes the listing (FAV-10, FAV-11), and every control of that listing on the
  page follows (worked example "Saved state", bug fix).
- [x] ALERTUI-19 · component — A save or removal from an alert page that the server refuses, or that
  throws, puts the control back as it was and shows the error toast (FRONT-15): the refusal code's
  `favoriteErrors.*` copy, or «Algo ha salido mal. Inténtalo de nuevo.» when it throws.

`/alerts/[id]` at desktop width

- [x] ALERTUI-20 · component — At desktop width `/alerts/[id]` shows the pages header with «Alertas»
  current (HEAD-3) and, in the list column, in this order:
  - «Volver», a 40px round link to `/alerts` named «Volver», and beside it the alert's name as the
    page heading (`h1`);
  - the criteria of ALERTUI-5 as chips;
  - «Creada el …»;
  - the match count as a section heading (`h2`, drawn in capitals);
  - every match, newest first, as a Guardados card (SAVED-9) whose heart follows ALERTUI-18;
  - «Eliminar alerta», the danger button, at its own width (ALERTUI-33).

  Beside the list, the alert map of ALERTUI-14 to ALERTUI-17. The browser title is «<nombre de la
  alerta> · Buy Car Map».
- [x] ALERTUI-21 · e2e — At desktop width the matches of `/alerts/[id]` sit in three columns 242px wide
  with 20px between them from 1280px wide (measured at 1440×900), and in two columns 231px wide with
  20px between them from 1024px to 1279px wide (measured at 1024×900), ±1px.

`/alerts/[id]` at phone width

- [x] ALERTUI-22 · component — At phone width `/alerts/[id]` shows:
  - the phone header with «Volver», a 40px round link to `/alerts` named «Volver», before the
    wordmark, and the language control (amends HEAD-7);
  - the alert's name as the page heading (`h1`);
  - the criteria of ALERTUI-5 as chips;
  - «Creada el …»;
  - when the alert has a place, the zone: a region named «Zona de la alerta», 180px tall and the
    content's full width, with the circle, the centre dot and a pill with the zone alone in lime
    («Madrid · 50 km», or «50 km» with no place name), and no pin;
  - the match count as a section heading (`h2`);
  - the matches as compact rows, newest first (ALERTUI-25);
  - «Eliminar alerta», the danger button, at the full width (ALERTUI-34);
  - the tab bar with «Alertas» current (MAPUI-52).

  It shows no alert map and no Guardados card.
- [x] ALERTUI-23 · component — When the alert has no place, the phone page has no zone region: the
  match count's heading follows «Creada el …».
- [x] ALERTUI-24 · component — The phone zone map is static: it is built with dragging, scroll-wheel,
  double-click, touch, box and keyboard zoom off, it has no zoom control, and it holds no focusable
  element.
- [x] ALERTUI-25 · component — A phone match row is one button with `aria-haspopup="dialog"`. It
  holds a 110×86 thumbnail (the photo or the car's tint, with no badge and no heart), the name,
  «año · km», each part only when known and with no city, and the price.
- [x] ALERTUI-26 · component — Pressing a match row opens the car sheet, a dialog named by the car's
  name. It holds, as SAVED-20's sheet does:
  - the handle and «Cerrar», visually hidden (SAVED-41);
  - the photo, 200px tall, with the source badge, or the tint with the car icon;
  - the name and the city on one row;
  - «año · km · combustible», where the fuel follows MAPUI-35;
  - the price;
  - «Guardar» or «Quitar de guardados» (ALERTUI-18), a button that leaves the sheet open;
  - «Ver anuncio», a link to the listing in a new tab.

  The sheet closes with a drag down from its handle, «Cerrar», Escape or a press outside it, and
  focus returns to its row (SAVED-37 to SAVED-40).
- [x] ALERTUI-27 · e2e — At 390×844 every control of both routes has a hit area of at least 44 × 44px:
  each phone AlertCard, «Volver», each match row, the car sheet's «Cerrar» once it has keyboard
  focus, «Guardar» or «Quitar de guardados», «Ver anuncio», «Eliminar alerta», and the confirmation's
  «Eliminar» and «Cancelar».
- [x] ALERTUI-28 · component — A phone AlertCard is one link to `/alerts/<id>`. It holds the name,
  «En pausa» when the alert is paused, the match count and the criteria of ALERTUI-5 on one line,
  separated by « · ». It holds no date, no match and no «Eliminar».

The phone match list (database run, 200 matches)

"Mounted" means present in the DOM. Each criterion below seeds one alert with 200 matches for one user
and runs in `pnpm test:e2e:db`.

- [x] ALERTUI-29 · e2e — At 390×844 only the visible rows and a bounded margin are mounted: at the
  list's top, middle and end, at most 25 rows. The arithmetic is under Worked examples.
- [x] ALERTUI-30 · e2e — Back restores the list's scroll. At 390×844, scroll until a row well down the
  list is the first wholly in view, follow the tab bar's «Mapa» to `/map`, and go Back: that same row
  is the first wholly in view again.
- [x] ALERTUI-31 · e2e — At 390×844, Tab goes through the 200 rows in order and then reaches
  «Eliminar alerta», which can be scrolled fully clear of the tab bar and pressed (amends HEAD-19).

Deleting an alert

- [x] ALERTUI-32 · e2e — At 390×844 the car sheet and the confirmation sheet each close with a drag
  down from the handle of more than 100px, and spring back from a slow 40px drag, as SAVED-37 and
  SAVED-38 say (database run).
- [x] ALERTUI-33 · component — At desktop width, «Eliminar alerta» on `/alerts/[id]` and «Eliminar» on
  the open AlertCard on `/alerts` open the confirmation: a centred dialog (`role="alertdialog"`)
  named by its title, «¿Eliminar «<nombre de la alerta>»?» («¿Eliminar «Corolla híbrido»?»), over
  the dimmed page, with «Eliminar», the danger button, and «Cancelar», with no handle and no «×». It
  fades in and out with Motion. Focus starts on «Cancelar». «Cancelar», Escape and a press outside
  close it with nothing sent, and focus returns to the control that opened it. (Amended 2026-10-16,
  owner: the title names the alert; it was «¿Eliminar esta alerta?».) — it fades only when a pointer
  opens or closes it; at once from the keyboard (MOTION-12) (amended 2026-10-18, MOTION — motion.md)
- [x] ALERTUI-34 · component — At phone width, «Eliminar alerta» opens the confirmation sheet
  (`role="alertdialog"`, named by its title, «¿Eliminar «<nombre de la alerta>»?»): the handle, the
  title, «Eliminar» and «Cancelar», with no «×» and no «Cerrar». It closes with «Cancelar», a drag
  down from its handle, Escape or a press outside it, with nothing sent, and focus returns to
  «Eliminar alerta». (Amended 2026-10-16, owner: the title names the alert; it was «¿Eliminar esta
  alerta?».)
- [x] ALERTUI-35 · component — «Eliminar» calls `deleteAlert` with the alert's id, once. While it
  runs, it shows a spinner, keeps its label and is disabled. When it succeeds:
  - the user is on `/alerts`: from `/alerts/[id]` the alert page's history entry is replaced, and on
    `/alerts` the `alert` parameter is removed;
  - the deleted alert is not listed, and at desktop width the newest alert left is open;
  - no toast appears;
  - focus is on the heading «Alertas».

  The worked example "Delete" gives the sequence. — the deleted card leaves, and the switch from
  placeholders to matches happens, with no fade (MOTION-9) (amended 2026-10-18, MOTION — motion.md)
- [x] ALERTUI-36 · component — A delete the server refuses, or that throws, closes the confirmation,
  leaves the alert listed and the URL as it was, shows the error toast (FRONT-15) with the refusal
  code's `alertErrors.*` copy, or «Algo ha salido mal. Inténtalo de nuevo.» when it throws, and
  returns focus to the control that opened the confirmation.

The toast

- [x] ALERTUI-37 · e2e — On `/alerts` and on `/alerts/[id]` at desktop width a toast sits 12px below
  the header's bottom, its centre over the list column's centre: x = 415px at 1440×900 and x = 273px
  at 1024×900. At 390×844 it sits 12px below the header and 16px from each side (amends SAVED-24).
  The trigger is a delete whose request fails, which shows the error toast (database run). (Amended
  2026-10-16: a revoked or cleared session sends the page to `/login` before any toast can show on
  the alerts pages, so the trigger cannot be `unauthenticated`; the placement is unchanged.
  Approved by the owner 2026-10-16.)

States

- [x] ALERTUI-38 · component — `/alerts`' `loading.tsx` mirrors the populated page (FRONT-14):
  - at desktop width, the heading, «Nueva alerta» and the line; four placeholders shaped like the
    folded AlertCard (the name and the badge on one row, the criteria and the date), with no open
    card; and the map with no zone and no pin, only the pill «Cargando…» with `role="status"`;
  - at phone width, the heading and four placeholders shaped like the phone AlertCard (the name and
    the badge, the criteria).

  The placeholders are one region with `aria-busy="true"`, each placeholder `aria-hidden`. At phone
  width the region holds a visually hidden «Cargando…» in a polite status. The page has one live
  region while it loads: the pill on desktop, that status on the phone.
- [x] ALERTUI-39 · component — `/alerts/[id]`'s `loading.tsx` mirrors the populated page:
  - at phone width, «Volver» in the header; bars for the name, the criteria and the date; the 180px
    gap of the zone; a bar for the count; and three placeholder rows (the 110×86 thumbnail and three
    bars);
  - at desktop width, «Volver»; bars for the name, the criteria, the date and the count; placeholder
    Guardados cards (as SAVED-30); and the map with no zone and no pin, only the pill «Cargando…» with
    `role="status"`.

  The busy region and the live region follow ALERTUI-38.
- [x] ALERTUI-40 · component — With no alert, `/alerts` shows the heading «Alertas» and the empty
  state:
  - «¿Sin alertas?» over «Crea una» (`h2`);
  - at desktop width, the line «Busca lo que quieres en el mapa, pulsa «Crear alerta» y te escribimos
    cuando salga algo.», with «Nueva alerta» and the page's line still shown;
  - at phone width, the line «Busca en el mapa, pulsa «Crear alerta» y te avisamos.»;
  - «Buscar coches», a link to `/map`.

  At desktop width the map shows no zone, no pin and the pill «Aquí verás la zona de cada alerta»
  with `role="status"`. Deleting the last alert brings the same state.
- [x] ALERTUI-41 · component — An alert with no match:
  - on `/alerts/[id]`, at both widths, shows «Sin coincidencias» as the section heading, then «Te
    avisaremos en cuanto salga un coche que encaje.», then «Eliminar alerta». At desktop width its
    map shows the zone and the pill, and no pin;
  - open on `/alerts`, shows the badge «Sin coincidencias», the chips, the line «Te avisaremos en
    cuanto salga un coche que encaje.» in place of the matches, no «Ver las … coincidencias», and
    «Creada el …» with «Eliminar».
- [x] ALERTUI-42 · component — `/alerts`' and `/alerts/[id]`'s `error.tsx` are the page-error state
  of `F0-estado-error-pagina` (`components/ui/PageError.tsx`):
  - «¿Se ha roto algo?» over «No es culpa tuya», the page's `h1`;
  - the line «Esta página no ha cargado. Vuelve a intentarlo y, si sigue, vuelve al mapa.»;
  - «Reintentar», a button that refreshes the route's server data and resets the boundary (PLAT-14);
  - «Volver al mapa», a link to `/map`.

  At desktop width the map region beside it shows no zone, no pin and no pill. The page shows no
  «Alertas» heading and no card. The thrown error is not shown. `RouteError`, the generic route
  error of `components/ui/`, is removed.
- [x] ALERTUI-43 · e2e — `/alerts` passes axe with no serious or critical violation at 1440×900 and at
  390×844, with alerts and with none, and so does `/alerts/[id]` with matches and with none, with the
  confirmation open too (amends FRONT-19).

Server

- [x] ALERTUI-44 · node — The `/alerts` page query returns the signed-in user's alerts only, newest
  first, soft-deleted ones left out, each with its name, place name, criteria, `active`, `createdAt`
  and match count. It returns the matches of one alert only, the open one (ALERTUI-12), newest first,
  and only when that alert is the caller's. Ada sees only Ada's four alerts while Grace holds one, and
  `alert=<Grace's id>` opens Ada's newest and reads none of Grace's matches (worked example "Page
  queries"). Signed out, the page redirects to `/login?callbackUrl=%2Falerts` and reads nothing.
- [x] ALERTUI-45 · node — The `/alerts/[id]` page query returns the caller's alert with every match,
  newest first, with only the fields of Contracts › Server. Another user's alert, a soft-deleted one,
  an unknown id and a malformed one are each a 404, and nothing of another user's is returned.
  Signed out, it redirects to `/login?callbackUrl=%2Falerts%2F<id>` and reads nothing.
- [x] ALERTUI-46 · node — `createAlert` stores the place name on the user's own alert, never on the
  shared criteria. Ada saves criteria C with «Madrid» and Grace saves the same C with «Centro»: one
  `AlertCriteria` row, whose `criteriaHash` is the hash of C alone and whose `criteria` holds no place
  name; Ada's alert has `placeName` «Madrid» and Grace's «Centro» (worked example "Place name").
- [x] ALERTUI-47 · node — `createAlert`'s place name is optional. It is trimmed, and an empty one, a
  missing one or one sent with criteria that have no place is stored as null. Reactivating a paused
  alert or restoring a deleted one (MAPUI-43) writes the new place name with the new name. Saving
  criteria the user already has live writes nothing, the stored place name included. A place name is
  at most 200 characters: a longer one gives `invalidCriteria` and stores nothing (2026-10-16: a
  place name is at most 200 characters).
- [x] ALERTUI-48 · component — «Crear alerta» on `/map` sends the place chosen in «Dónde» as the place
  name: from `/map?lat=40.4168&lng=-3.7038&placeId=1&locationName=Madrid&radius=50&make=Toyota`
  it calls `createAlert` with the criteria, the name and «Madrid»; with no place it sends no place
  name (amends MAPUI-42). A place name longer than 200 characters (ALERTUI-47) is sent as its first
  200, so saving never fails on it (2026-10-16).
- [x] ALERTUI-49 · node — The migration adds `alerts.place_name`, nullable with no default, and
  changes nothing else. A row inserted without it, as the code before F6 inserts, reads `placeName`
  null.
- [x] ALERTUI-50 · node — The alert digest's link to the alert («Ver todos los coches») is
  `<app URL>/alerts/<alert id>`, the alert's page.

The desktop match grid (database run, 200 matches)

Added 2026-10-15 (owner decision, Decisions › Virtualised at both widths). "Mounted" is as above. Each
criterion below seeds one alert with 200 matches for one user and runs in `pnpm test:e2e:db`, as
SAVED-25 to SAVED-29 do for `/favorites`.

- [x] ALERTUI-51 · e2e — At 1440×900 only the visible Guardados cards of `/alerts/[id]` and a bounded
  margin are mounted: at the list's top, middle and end, at most 30 cards. The arithmetic is under
  Worked examples.
- [x] ALERTUI-52 · e2e — At 1440×900, with the list at its top, activating the pin of the 150th match
  in order mounts its card, scrolls it wholly into the list column's view and outlines it, and its
  preview opens.
- [x] ALERTUI-53 · e2e — Back restores the list's scroll at 1440×900. Scroll the list column until a
  card well down the list is the first wholly in view, follow the header's «Mapa» to `/map`, and go
  Back: that same card is the first wholly in view again.
- [x] ALERTUI-54 · e2e — At 1440×900, Tab from «Volver» goes through the first card's link and heart,
  then the second card's, and so on, ending with the 200th card's heart, and then reaches «Eliminar
  alerta». The focused card is each time wholly in the list column's view.
- [x] ALERTUI-55 · e2e — Saving and removing keep the right cards. The heart on `/alerts/[id]` toggles
  the saved state and removes no card (ALERTUI-18), so SAVED-29's removal and undo become a toggle.
  At 1440×900, scrolled to the 150th card:
  - pressing its heart, «Guardar», makes it «Quitar de guardados» and leaves the 149th card followed
    by the 150th and the 151st, with 200 cards in the list;
  - pressing it again makes it «Guardar», with the same order and 200 cards.

  At no point is a car shown twice, or a car's heart shown for another car.

Back to `/alerts` (database run)

Added 2026-10-16 (owner decision, Decisions › Decided 2026-10-16, owner).

- [x] ALERTUI-56 · e2e — Back to `/alerts` restores the list column's scroll position, as
  `/favorites` does (SAVED's Back restore, SAVED-27). At 1440×900, with more alerts than fit, scroll
  the list column down, follow the header's «Mapa» to `/map`, and go Back: the list column's scroll
  offset is the one it was left at, ±1px. The same holds when a folded card was pressed after the
  scroll: Back from `/map` returns to the entry that press added, at the same offset (amended
  2026-10-16, after the build's third review).

Focus on the card a press opens (desktop)

Added 2026-10-16 (owner decision, Decisions › Decided 2026-10-16, owner, after the third review).

- [x] ALERTUI-57 · component — At desktop width, pressing a folded AlertCard moves the focus to that
  card once it is open: the open card's `<article>` has `tabIndex="-1"` and takes the focus when the
  card pressed becomes the open one, with the server's next data. Only after a press: on a first
  load, on Back or after a delete, no card takes the focus.

## Worked examples

**Criteria (ALERTUI-5 to ALERTUI-7, ALERTUI-15, ALERTUI-28), from `R3-alertas` and
`F6-alertas-escritorio`.** The point is any `latitude` and `longitude`. The space before «km» is a
non-breaking space, U+00A0, as in MAPUI.

| Alert | Stored criteria | `placeName` | Folded line | Map pill |
| --- | --- | --- | --- | --- |
| Corolla híbrido | `brand` Toyota, `model` Corolla, `engine` hybride + hybride_plugin, `maxPrice` 18000, a point, `distanceInKm` 50 | «Madrid» | «Toyota Corolla · Híbrido · Hasta 18.000 € · Madrid · 50 km» | «Corolla híbrido · Madrid · 50 km» |
| Golf TDI | `brand` Volkswagen, `model` Golf, `engine` gasoil, `maxKm` 120000, a point, `distanceInKm` 25 | «Valencia» | «Volkswagen Golf · Diésel · Hasta 120.000 km · Valencia · 25 km» | «Golf TDI · Valencia · 25 km» |
| Clio barato (created before F6) | `brand` Renault, `model` Clio, `maxPrice` 9000, a point, `distanceInKm` 50 | null | «Renault Clio · Hasta 9.000 € · 50 km» | «Clio barato · 50 km» |
| Serie 3 diésel | `brand` BMW, `model` Serie 3, `engine` gasoil, `maxPrice` 20000, no point | null | «BMW Serie 3 · Diésel · Hasta 20.000 €» | «Serie 3 diésel» |

The open card shows the same parts as chips: «Toyota Corolla», «Híbrido», «Hasta 18.000 €», «Madrid ·
50 km». The phone page's zone pill reads «Madrid · 50 km», or «50 km» for the Clio.

The orders the boards do not draw, read off ALERTUI-5:
- `brand` Toyota, `engine` gasoline, `minPrice` 3000, `maxPrice` 20000, `gearbox` automatic,
  `maxKm` 100000, `minYear` 2017, a point, 50, «Madrid» → «Toyota · Gasolina · 3.000 – 20.000 € ·
  Automático · Hasta 100.000 km · Desde 2017 · Madrid · 50 km».
- `maxPrice` 15000, a point, 25, «Madrid» → «Hasta 15.000 € · Madrid · 25 km». No «Cualquier marca».
- `brand` Toyota and a `timeFilter` of `today` stored before MAPUI-42 → «Toyota». No «Últimas 24 h».
- `gearbox` manual + automatic (an old link) → no gearbox part (MAPUI-16).
- Criteria that fail `searchSchema` when read (`parseStoredCriteria` gives null) → no part: the
  folded line and the phone card show no criteria line, and the open card no chip.

**Count (ALERTUI-9).** 0 → «Sin coincidencias»; 1 → «1 coincidencia»; 4 → «4 coincidencias»; 12 →
«12 coincidencias». The alert page's heading draws them in capitals, «4 COINCIDENCIAS». «Ver las 12
coincidencias» shows for 12; for 4 it does not.

**Created on (ALERTUI-10).** Today is 2026-10-15. Europe/Madrid is UTC+2 until 2026-10-25 and UTC+1
in winter.

| `createdAt` (UTC) | Time zone | es | en (draft) |
| --- | --- | --- | --- |
| 2026-10-02 10:00 | Europe/Madrid | «Creada el 2 de octubre» | "Created on 2 October" |
| 2026-09-30 22:30 | Europe/Madrid | «Creada el 1 de octubre» (00:30 local) | "Created on 1 October" |
| 2026-09-30 22:30 | UTC | «Creada el 30 de septiembre» | "Created on 30 September" |
| 2025-12-20 12:00 | Europe/Madrid | «Creada el 20 de diciembre de 2025» | "Created on 20 December 2025" |
| 2025-12-31 23:30 | Europe/Madrid | «Creada el 1 de enero» (00:30 local, 2026) | "Created on 1 January" |
| 2025-12-31 23:30 | UTC | «Creada el 31 de diciembre de 2025» | "Created on 31 December 2025" |

**Open alert (ALERTUI-12, ALERTUI-13).** Ada's alerts, newest first: Corolla híbrido (created
2026-10-02), Golf TDI (2026-09-28), Clio barato (2026-09-21) and Serie 3 diésel (2026-09-14). Grace
has one alert. At 1440×900:

| URL | Open | URL after |
| --- | --- | --- |
| `/alerts` | Corolla híbrido | `/alerts` |
| `/alerts`, press Golf TDI | Golf TDI | `/alerts?alert=<Golf's id>` (a new entry) |
| then Back | Corolla híbrido | `/alerts` |
| `/alerts?alert=<Clio's id>`, press Corolla híbrido | Corolla híbrido | `/alerts` (a new entry) |
| `/alerts?alert=<Grace's id>` | Corolla híbrido; none of Grace's matches is read | unchanged |
| `/alerts?alert=not-a-uuid`, `/alerts?alert=` | Corolla híbrido | unchanged |
| `/alerts?alert=<a deleted alert's id>` | Corolla híbrido | unchanged |
| `/alerts?alert=<Golf's id>&alert=<Clio's id>` | Golf TDI | unchanged |

A repeated `alert` parameter reads as its first value; an empty one as none (added 2026-10-16, owner
decision).

At 390×844, `/alerts?alert=<Golf's id>` lists the four phone cards, none open, and leaves the URL as
it is.

**Delete (ALERTUI-33 to ALERTUI-36).** The same four alerts.

| Step | Result | Toast |
| --- | --- | --- |
| 1440×900, `/alerts/<Corolla's id>`, press «Eliminar alerta» | The confirmation «¿Eliminar «Corolla híbrido»?» opens, focus on «Cancelar» | — |
| press «Cancelar» | It closes, focus on «Eliminar alerta», `deleteAlert` not called | — |
| press «Eliminar alerta», then «Eliminar» | `deleteAlert(<Corolla's id>)` once; the page is `/alerts`, the alert page's history entry replaced; three cards, Golf TDI open; focus on «Alertas» | none |
| 1440×900, `/alerts?alert=<Clio's id>`, press «Eliminar» on the open card, then «Eliminar» | The page is `/alerts`; Clio barato gone; Corolla híbrido open | none |
| as above, `deleteAlert` throws | The confirmation closes; four cards, Clio barato open; the URL unchanged; focus on «Eliminar» | «Algo ha salido mal. Inténtalo de nuevo.» |
| as above, the session cleared first: `deleteAlert` answers `unauthenticated` | As the row above | «Inicia sesión para gestionar tus alertas.» |
| 390×844, `/alerts/<Serie 3's id>`, «Eliminar alerta» | The confirmation sheet «¿Eliminar «Serie 3 diésel»?» opens | — |
| then «Eliminar» | The page is `/alerts`, three phone cards | none |
| deleting Ada's last alert | `/alerts` shows «¿Sin alertas? / Crea una» | none |

**Saved state (ALERTUI-18; bug fix).**
- **Input:** Ada saved `cochesnet-99`, a Toyota Corolla 125H at 16.200 €, from `/map`. Her alert
  Corolla híbrido then found `cochesnet-99`. She opens `/alerts/<Corolla's id>`.
- **Today:** its card's heart is «Guardar», empty, because `CarListingCard` (`components/map/`) starts
  every match unsaved (`useState(false)`).
- **Correct result:** at 1440×900 its card's heart and its preview's are «Quitar de guardados»,
  filled violet. At 390×844 its car sheet's button reads «Quitar de guardados». Pressing any of them
  calls `removeFavorite("cochesnet-99")`, and every one then reads «Guardar».

The same holds for the match's preview on `/alerts` (`F6-alertas-escritorio`: the BMW Serie 3 320d
xDrive, already saved, in the grouped preview).

**Page queries (ALERTUI-44, ALERTUI-45).** Ada holds the four alerts above. Corolla híbrido has four
matches and Serie 3 diésel twelve. Grace holds Grace's search, with
two matches.
- Ada's `/alerts` gets her four alerts in the order above, with Corolla híbrido's four matches,
  newest first, and no other alert's matches.
- Ada's `/alerts?alert=<Serie 3's id>` gets the same four alerts and Serie 3's twelve matches. The
  open card shows the four newest and «Ver las 12 coincidencias»; the map has twelve pins, two of
  them one grouped pin when at the same point.
- Ada's `/alerts?alert=<Grace's id>` gets Corolla híbrido's matches. No query reads Grace's matches.
- Ada's `/alerts/<Grace's id>` is a 404. Grace's `/alerts/<Corolla's id>` is a 404.
- After Ada deletes Golf TDI, her `/alerts` lists three alerts and `/alerts/<Golf's id>` is a 404.

**Place name (ALERTUI-46, ALERTUI-47).** C = {brand:"Audi", model:"A3", maxPrice:20000,
latitude:40.4168, longitude:-3.7038, distanceInKm:50}, with no `AlertCriteria` row for its hash h.
- Ada calls `createAlert(C, "Ada's search", "Madrid")`: one `AlertCriteria` row with `criteriaHash` h
  and `criteria` C; Ada's alert has `placeName` «Madrid».
- Grace calls `createAlert(C, "Grace's search", "Centro")`: still one `AlertCriteria` row, h and C;
  Grace's alert has `placeName` «Centro». Ada's is still «Madrid».
- Ada calls `createAlert(C, "Otra", "Getafe")` again with her alert live: `ok({ created: false })`,
  her alert keeps «Ada's search» and «Madrid».
- Ada's alert paused from the email, then `createAlert(C, "Otra", "Getafe")`: `ok({ created: true })`,
  active, named «Otra», `placeName` «Getafe».
- `createAlert(D, "Diésel barato", "Madrid")` with D = {engine:["gasoil"], maxPrice:9000}, no point:
  `placeName` null.
- `createAlert(C, "Ada's search", "   ")`: `placeName` null.
- `createAlert(C, "Ada's search", "M" × 200)`: stored, `placeName` the 200 «M».
- `createAlert(C, "Ada's search", "M" × 201)`: `err(invalidCriteria)`, and Ada has no alert.
- `createAlert(C, "Ada's search", "   " + "M" × 195 + "   ")`, 201 characters sent: stored, `placeName`
  the 195 «M». It is trimmed before its length is checked (2026-10-16, bug fix: it was refused).

**Viewport table (ALERTUI-3, ALERTUI-21, ALERTUI-37).**

| Viewport | Header | `/alerts` list | Open card's matches | `/alerts/[id]` matches | Map | Toast |
| --- | --- | --- | --- | --- | --- | --- |
| 390×844 | Phone, 64px; «Volver» on `/alerts/[id]` | «Alertas», phone cards; the page scrolls; tab bar | none | rows; the 350×180 zone above them | none | 16px from each side, 12px below the header |
| 1023×900 | Phone | As 390×844 | none | As 390×844 | none | As 390×844 |
| 1024×900 | Desktop, 80px, fixed | 546px column with its 32px padding; only it scrolls | two columns of 213px, 14px apart | two columns of 231px, 20px apart | 478px, beside the list | 12px below the header, centre at x = 273px |
| 1279×900 | Desktop, fixed | As 1024×900 | As 1024×900 | As 1024×900 | 733px | As 1024×900 |
| 1280×900 | Desktop, fixed | 830px column with its 32px padding | four columns of 170.5px, 14px apart | three columns of 242px, 20px apart | 450px | 12px below the header, centre at x = 415px |
| 1440×900 | Desktop, fixed | As 1280×900 | As 1280×900 | As 1280×900 | 610px | As 1280×900 |

The widths come from the boards' markup, read with the padding inside the column as SAVED reads
`R3-favoritos`. The 1440 column is 830px with `padding: 30px 32px`, so a card is 766px wide; less its
20px padding on each side and its 1px border on each side, 724px holds the matches; less three 14px
gaps, over four, gives 170.5px. The 1024 column is 546px, so a card is 482px; less 42px, 440px; less
one 14px gap, over two, gives 213px. The phone zone is the 390px screen less 20px on each side, 350px.
`/alerts/[id]`'s cards follow SAVED: 766px less two 20px gaps over three is 242px; 482px less one 20px
gap over two is 231px.

**Mounted bound (ALERTUI-29).** The view under the 64px header is 780px tall. A row is 86px with 14px
to the next (`F6-alerta-mas-estados`), a 100px pitch, so at most ⌈780 / 100⌉ + 1 = 9 rows meet it. 25
rows is the nine plus eight of margin on each side. 200 mounted would mean no virtualisation.

**Mounted bound, desktop (ALERTUI-51).** Added 2026-10-15. At 1440×900 the list column's view is
900 − 80 = 820px tall. A Guardados card on `/alerts/[id]` is 242px wide: the 830px column less
2 × 32px of padding is 766px, less two 20px gaps, over three (viewport table). Its 20:17 photo is
therefore 242 × 17 / 20 = 205.7px tall, and with the text block under it a card is over 280px, so a
row of cards has a pitch over 280px. At most ⌈820 / 280⌉ + 1 = 4 rows meet an 820px view, which is
4 × 3 = 12 cards. 30 cards is ten rows: the four that can show and three of margin on each side, the
bound SAVED-25 sets for the same card at the same width. 200 mounted would mean no virtualisation.

## Data model

One new column, on `Alert`:

| Field | Type | Notes |
| --- | --- | --- |
| `placeName` | `String? @map("place_name")` | The place the user chose in «Dónde» when creating the alert («Madrid»). Null for alerts created before F6, for alerts with no place, and when none was sent. Never on `AlertCriteria` and never in `criteriaHash` (Decisions › The place name is the user's) |

**Migration.** One new migration adding `place_name` as a nullable `text` column with no default and
no index (ALERTUI-49). It is expand-only (`RULES.md` §11): the code before F6 neither reads nor
writes the column, and the rows it inserts leave it null, so production can apply it before the new
code is live. No data migration: no stored row records the name an alert was created with, so the
alerts created before F6 show the radius alone (ALERTUI-5).

No other model changes. The pages read `Alert`, `AlertCriteria.criteria` and `AlertMatch`, whose
snapshot already holds every field the cards, the rows, the sheet, the preview and the pins use
(`prisma/schema.prisma`). The seed is unchanged: its alerts keep a null place name, which is the
pre-F6 case.

**Personal data** (`RULES.md` §12). `placeName` reveals where a user looks for a car, so:
- **Inventory:** a new `Alert` › `placeName` row in `docs/privacy/data-inventory.md`, with the
  purpose «naming the alert's zone on `/alerts` and `/alerts/[id]`» and the alert's own retention.
- **Retention:** the alert's own. Deleting the alert sets `deletedAt`, and `server/retention/service.ts`
  erases the row 30 days later; deleting the account erases it at once (cascade on `Alert.user`).
  Unsubscribing keeps it. No code change is needed for either: the column goes with its row.
- **Export:** each exported alert gains `placeName`, null when it has none (amends EXPORT-6).
- **Deletion:** `docs/privacy/deletion.md` already lists `Alert` among what account deletion removes;
  the column is part of that row.
- **Logs:** no Pino call logs an alert's fields today (`server/alerts/` has no logger call, and the
  run summary carries no label). Even so, `placeName` and `*.placeName` are added to the `redact`
  paths of `lib/logger.ts`, so a later call that logs an alert cannot write it (2026-10-16).
- **Processors:** the digest email does not carry the place name, so Resend receives nothing new and
  `docs/privacy/processors.md` is unchanged.

## Permissions

- Every read and write is the owner's own, through `getCurrentUser()` and `ownedBy()`
  (`lib/auth/permissions.ts`), as today:
  - the `/alerts` page query (`server/alerts/queries.ts` → `listAlertsForPage`), ALERTUI-44;
  - the `/alerts/[id]` page query (`getAlertWithMatches`), ALERTUI-45;
  - `deleteAlert` (ALERT-5), behind the confirmation;
  - `createAlert` (ALERT-4), which now stores the place name on the caller's own row, ALERTUI-46;
  - `saveFavorite` and `removeFavorite` (FAV-5, FAV-6), behind the hearts.
- Another user's alert is a 404 on `/alerts/[id]`, not a 403: confirming it exists would leak that
  someone else watches that search. On `/alerts`, another user's id in `alert` reads as no choice.
- Signed out, both pages redirect to sign-in with their `callbackUrl` (ALERT-30). The proxy's
  redirect is UX; the page queries' `getCurrentUser()` is the check.
- `RULES.md` §10: both page queries are permission-filtered, and ALERTUI-44's and ALERTUI-45's
  integration tests prove that Ada never receives Grace's alerts or matches (worked example "Page
  queries"). ALERTUI-46's proves that the place name is stored per user and outside the shared
  criteria. ALERT-5's proves that Grace cannot delete Ada's alert.
- Which alert is open is display only: it selects among what the owner already receives and grants
  nothing.

## Edge cases

- **No alert:** the empty state (ALERTUI-40).
- **An alert with no match:** ALERTUI-41, at both widths and on the open card.
- **Four matches or fewer:** no «Ver las … coincidencias» (ALERTUI-7).
- **A match pinned outside the four shown:** its preview opens and no card is outlined (ALERTUI-17).
- **An alert with no place:** no circle, the pill with the name alone, the map fitting the pins; on
  the phone, no zone region (ALERTUI-14 to ALERTUI-16, ALERTUI-23).
- **An alert created before F6:** the zone reads the radius alone, «50 km» (ALERTUI-5).
- **A live alert created before F6, saved again from the map:** nothing is written (MAPUI-43), so it
  keeps a null place name and its «50 km» (ALERTUI-47).
- **A reactivated or restored alert:** it keeps its original `createdAt`, so its «Creada el …» and its
  place in the list do not change (the upsert's update branch does not write `createdAt`).
- **A paused alert:** «En pausa» on the folded, open and phone cards; its zone and its matches still
  show (ALERTUI-6, ALERTUI-7, ALERTUI-28). Resuming it is out of scope.
- **Stored criteria that no longer parse:** no criteria line or chip (worked example "Criteria").
- **Stored criteria holding «Publicado»** (saved before MAPUI-42): it does not show (ALERTUI-5).
- **Stored criteria holding the `?q=` text:** it shows, whenever it was saved (DESC-30)
  (amended 2026-10-31, DESC — map-description-search.md).
- **An unknown, malformed, foreign or deleted `alert`:** the newest is open (ALERTUI-12).
- **The `alert` parameter on a phone, or a window narrowed below 1024px:** ignored, with the URL left
  alone (ALERTUI-13).
- **Another user's, a deleted, an unknown or a malformed id on `/alerts/[id]`:** 404 (ALERTUI-45).
- **Exactly 1024px wide:** desktop; 1023px is the phone (ALERTUI-3).
- **A match without coordinates:** in the list with no pin. Every source gives every listing a point
  (SRC-3), so this is a guard, as on `/map`.
- **Two matches at one point:** one grouped pin, every card of the group shown outlined
  (ALERTUI-16, ALERTUI-17).
- **No photo, or a photo that fails:** the car's tint with the car icon, on every card, row and
  sheet (ALERTUI-8, ALERTUI-25, ALERTUI-26).
- **Long text in a chip or a pill:** a criteria chip (the open card, `/alerts/[id]`), the phone
  zone's pill and the desktop map's pill that do not fit are cut to one line with «…», and never
  overflow sideways; the whole text stays in the page for assistive tech (2026-10-16, owner;
  `F6-alerta-mas-estados`: «San Sebastián de los Reyes, Comunidad de Madrid · 50 km»).
- **Long names:** an alert's name truncates on one line on its cards; as the page heading it wraps,
  balanced (`text-wrap: balance`). A car's name and city truncate as on the map card.
- **A long match list on the phone:** only what is visible is mounted (ALERTUI-29). Back, Tab and the
  last control still behave (ALERTUI-30, ALERTUI-31).
- **A long match list on desktop:** only what is visible is mounted (ALERTUI-51). Pin, Back, Tab and
  the heart still behave (ALERTUI-52 to ALERTUI-55).
- **Saving or removing a match fails:** ALERTUI-19.
- **Deleting fails, or the session ended:** ALERTUI-36. The next navigation reaches sign-in
  (ALERT-30).
- **Deleting the alert whose page is open:** the user lands on `/alerts`, and Back does not return to
  the deleted alert's 404 (ALERTUI-35).
- **Deleting the last alert:** the empty state (ALERTUI-40).
- **The page read failing:** the page error (ALERTUI-42).
- **A stale snapshot:** shown as found, with no refresh (Out of scope).

## Out of scope

- **Showing which matches are new:** [#122](https://github.com/algusaem/buycarmap/issues/122).
- **Changing what the alert emails send:** [#123](https://github.com/algusaem/buycarmap/issues/123).
  F6 only states the digest's existing link (ALERTUI-50).
- **Refreshing a match's price and availability.** The matches are snapshots: neither page calls an
  upstream (ALERT-39).
- **Resuming a paused alert from the page.** Saving the same search again from the map reactivates
  it (MAPUI-43).
- **Editing an alert,** its name, its criteria or its place.
- **Undoing a delete.** The design confirms first instead (Decisions › Confirm, no undo).
- **A sort, a filter or pagination of the alerts or the matches.** The alerts are at most 20
  (ALERT-8); the matches are newest first.
- **A place name for the alerts created before F6.** No stored row records one.
- **The phone `/map`'s pin opening the car sheet** (F5's Out of scope, kept).
- **Keyboard, screen-reader and real-iPhone checks beyond axe**
  ([#127](https://github.com/algusaem/buycarmap/issues/127)).

## Contracts

**URL.** The open alert is one nuqs parameter, `alert`, holding the alert's id. Its default is no
choice, which nuqs drops from the URL (`clearOnDefault`), as SAVED's `sort` does: opening the newest
writes `null`. A card writes with `history: "push"`, as SAVED's chips do (SAVED-7). Unlike `sort`, the
write is not shallow (`shallow: false`): the server reads the parameter to load the open alert's
matches (Decisions › The server reads the open alert). It runs in a transition, so the page keeps
showing the alert that was open until the new one has loaded, rather than falling back to
`loading.tsx`. The page resolves the open alert on the server: the requested id when it is among the
caller's listed alerts, the newest otherwise.

**Server.**
- `listAlertsForPage` (`server/alerts/queries.ts`) takes the requested `alert` value and returns the
  caller's alerts and the open alert's matches. `findAlertSummaries` (`server/alerts/service.ts`)
  reads with a `select`: `id`, `label`, `placeName`, `active`, `createdAt`, `criteria.criteria` and
  `_count` of `matches`, ordered by `createdAt` descending, then `id` descending (a UUIDv7, which is
  time-ordered), so two alerts created in the same millisecond keep one order. `AlertSummary`
  (`interfaces/alert.ts`) gains `placeName: string | null` and `createdAt: Date`.
- The open alert's matches are one `alertMatch.findMany`, scoped to an alert the caller owns and
  that is not deleted, with a `select` of the snapshot (`listingId`, `source`, `title`, `subtitle`,
  `image`, `brand`, `model`, `location`, `fuel`, `url`, `price`, `mileage`, `year`, `lat`, `lng`) and
  `createdAt`, ordered newest first. The open card shows the first four; the map gets all. (Amended
  2026-10-16: the order still uses `createdAt`, which is no longer selected, since no page shows
  it.)
- So `/alerts` makes two reads whatever the number of alerts: the summaries, then one alert's
  matches. No read runs per alert, and no other alert's matches are read.
- `getAlertWithMatches(id)` keeps its signature. `findAlertWithMatches` reads with a `select`: the
  alert's `id`, `label`, `placeName`, `active`, `createdAt` and `criteria.criteria`, and its matches
  with the snapshot `select` above, newest first. It no longer returns the full row: no
  `unsubscribeTokenHash`, `unsubscribeSubject`, `notifiedAt` or audit column reaches the page.
- `createAlert(criteria, label, placeName?)` (`server/alerts/actions.ts`): the third argument is
  parsed by a new `alertPlaceNameSchema` in `server/alerts/schema.ts`, an optional string trimmed to
  null when empty. `createAlertForUser` writes it in the `create` branch and in the `update` branch
  of its upsert, and never into `criteria` or `hashCriteria`. The result and its error codes are
  unchanged (MAPUI-43).
- `deleteAlert(alertId)` is unchanged: `Result<void, AlertError>`, with `unauthenticated`.
- No new index. Both match reads filter on `alert_id`, the leading column of the existing
  `@@index([alertId, notifiedAt])`, and sort one alert's rows.
- The digest already links to `${appUrl}/alerts/${alert.id}` (`server/alerts/service.ts`), the
  alert's page; ALERTUI-50 holds it there.

**Client.**
- Request lifecycles stay in hooks in `lib/hooks/` (ADR 0007 row 19): the delete, the open alert's
  switch, the phone row list and the saved state.
- The saved state comes from `useFavorites` and the toggle from `useFavoriteToggle`, as on `/map`.
  `CarListingCard` (`components/map/`), whose own `useState(false)` is the bug, is removed: its only
  caller is `AlertMatchesList` (`components/alerts/`), which F6 replaces. `CarCard`'s `foundAt` line
  goes with it.
- The match list of `/alerts/[id]`, the phone rows and the desktop grid alike, reuses
  `useSavedList`'s virtualisation (`@tanstack/react-virtual`,
  [ADR 0021](../decisions/0021-react-virtual.md)), its scroll restoration and its focus handling.
- Reused from F3 and F5:
  - `ListingsMap`, with its pins, grouping (`groupPins`), `MapPreview` and zoom, plus a zone circle
    that the saved map does not draw;
  - the Guardados card (`components/favorites/SavedCard.tsx`), the compact row (`SavedRow.tsx`, with
    no city) and the car sheet (`SavedCarSheet.tsx`, whose button toggles instead of removing);
  - `PhoneBottomSheet` (`components/map/phone/SheetChrome.tsx`) for the car sheet and the
    confirmation sheet;
  - `EmptyState`, `Headline` and `PageError`;
  - the map's pill, whose text and role its caller gives (SAVED's Contracts);
  - `useIsPhone`, and the Toaster's per-page placement (SAVED-24).
- The criteria are one pure function beside `alertSummary` in `lib/search/alert-summary.ts`, built
  from `carLabel`, `priceLabel`, `criteriaChips` and `placeLabel` in `lib/search/filter-chips.ts`,
  plus the radius alone (`search.radiusOption`). `alertSummary` keeps MAPUI-40's order (Decisions ›
  Two orders, one module).
- «Creada el …» uses a new `formatDate` in `lib/format.ts`, with the time zone from next-intl's
  config (FRONT-11).
- Removed: `RouteError` (ALERTUI-42), `AlertsList` and `AlertMatchesList`, replaced by the new
  pieces.

**Dependency.** None. The zone circle is a GeoJSON polygon drawn by the map's own MapLibre
(`components/map/ZoneLayers.tsx`; amended by MAPLIBRE, map-maplibre.md).

**Tests.** Every e2e criterion that needs a signed-in user's alerts — ALERTUI-3, ALERTUI-4,
ALERTUI-12, ALERTUI-21, ALERTUI-27, ALERTUI-29 to ALERTUI-32, ALERTUI-35, ALERTUI-37, ALERTUI-43 and
ALERTUI-51 to ALERTUI-56 — seeds its alerts and their matches and runs in `pnpm test:e2e:db`
(`pnpm db:branch` first), not in CI, like SAVED-25. They use an e2e fixture that writes
`AlertCriteria`, `Alert` and `AlertMatch` rows with their `created_at` (Decisions › Raw SQL in the
e2e fixture).

**Surface brief.** `/alerts`' Impeccable brief is [`.impeccable/surfaces/alerts.md`](../../.impeccable/surfaces/alerts.md) (`STACK.md` §17).

**i18n keys**, both locales (`messages/es.json`, `messages/en.json`, `lib/i18n/types.ts`). The design
gives Spanish only. English is drafted here and reviewed in the pull request, as in MAPUI and SAVED.

| Text | Key | Status | English (draft) |
| --- | --- | --- | --- |
| «Alertas» (heading, browser title, tab) | `alerts.title` | existing | "Alerts" |
| «El que no corre vuela, guárdalo y nosotros te avisamos.» | `alerts.subtitle` | changed, from «Comprobamos cada pocos minutos…» | "You snooze, you lose: save it and we'll let you know." |
| «Nueva alerta» | `alerts.newAlert` | new | "New alert" |
| «Sin coincidencias» / «1 coincidencia» / «N coincidencias» | `alerts.matchCount` | changed, from «coches encontrados»: `{count, plural, =0 {Sin coincidencias} one {# coincidencia} other {# coincidencias}}` | "{count, plural, =0 {No matches} one {# match} other {# matches}}" |
| «Ver las N coincidencias» | `alerts.viewAllMatches` | new | "View all {count} matches" |
| «En pausa» | `alerts.inactive` | existing | "Paused" |
| «Creada el {date}» | `alerts.createdOn` | new | "Created on {date}" |
| «Eliminar» (open card, confirmation) | `alerts.deleteShort` | new | "Delete" |
| «Eliminar alerta» | `alerts.delete` | existing | "Delete alert" |
| «¿Eliminar «{name}»?» (2026-10-16, owner: the title names the alert) | `alerts.deleteConfirmNamed` | new | "Delete “{name}”?" |
| «¿Eliminar esta alerta?» | `alerts.deleteConfirm` | removed, replaced by `alerts.deleteConfirmNamed` | — |
| «Cancelar» (confirmation) | `alerts.cancel` | new | "Cancel" |
| «Mapa de la alerta» (map region) | `alerts.mapLabel` | new | "Alert map" |
| «Aquí verás la zona de cada alerta» (empty pill) | `alerts.mapEmpty` | new | "Each alert's area will show here" |
| «Zona de la alerta» (phone zone region) | `alerts.zoneLabel` | new | "Alert area" |
| «¿Sin alertas?» | `alerts.emptyTitle` | new | "No alerts?" |
| «Crea una» | `alerts.emptyPunchline` | new | "Create one" |
| «Busca lo que quieres en el mapa, pulsa «Crear alerta» y te escribimos cuando salga algo.» | `alerts.emptyLine` | new | "Search the map for what you want, click “Create alert” and we'll write when something turns up." (the desktop line: "click", 2026-10-16) |
| «Busca en el mapa, pulsa «Crear alerta» y te avisamos.» | `alerts.emptyLinePhone` | new | "Search the map, tap “Create alert” and we'll let you know." |
| «Buscar coches» | `alerts.emptyCta` | existing | "Search for cars" |
| «Todavía no tienes ninguna alerta.» | `alerts.empty` | removed | — |
| «Te avisaremos en cuanto salga un coche que encaje.» | `alerts.noMatchesYet` | changed, from «Vigilando: todavía no hay nada nuevo.» | "We'll let you know as soon as a matching car turns up." |
| «Volver a las alertas» | `alerts.backToAlerts` | removed | — |
| «Encontrado {time}» | `alerts.foundAt` | removed, with `CarCard`'s `foundAt` | — |
| «Volver» (the round link) | `nav.back` | existing | "Back" |
| «{place} · {km} km», «{km} km» | `search.placeRadius`, `search.radiusOption` | existing | "{place} · {km} km", "{km} km" |
| The criteria parts | `search.brandModel`, `search.priceUpTo`, `search.priceFrom`, `filters.fuelGroups.*`, `filters.transmissions.*`, `filters.maxKmChip`, `filters.minYearChip` | existing | — |
| «Desde {km}» (the minimum-mileage criterion) | `filters.minKmChip` | new, with MAPUI-75 — redesign-map.md | "From {km}" |
| «Cargando…» (pill, visually hidden status) | `map.loading` | existing | "Loading…" |
| «Guardar», «Quitar de guardados», «Ver anuncio» | `map.addFavorite`, `map.removeFavorite`, `map.viewListing` | existing | "Save", "Remove from saved", "View listing" |
| «Cerrar vista previa», «N coches · desde …», «Acercar», «Alejar» | `map.closePreview`, `map.pinGroup`, `map.zoomIn`, `map.zoomOut` | existing | — `map.preview` («Vista previa del coche») is removed: the preview is named by its car (amended 2026-10-21, MAPUI-69 — redesign-map.md) |
| «Cerrar» (car sheet), «Cerrar aviso» (toast) | `common.close`, `common.closeToast` | existing | "Close", "Close notice" |
| The page error | `errors.pageTitle`, `errors.pagePunchline`, `errors.pageLine`, `errors.retry`, `nav.backToMap` | existing | — |
| «No se pudo cargar esta página. Inténtalo de nuevo.» | `errors.pageLoadFailed` | removed, with `RouteError` | — |
| «Volver al inicio» | `map.backToHome` | removed: `/alerts` was its last user | — |
| Failure toasts | `alertErrors.*`, `favoriteErrors.*` | existing | — |

**Criteria amended** (in the same change, each statement kept and marked with a dated note):
- **`alerts.md` (ALERT):**
  - ALERT-28: the list is the AlertCard, with the criteria of ALERTUI-5 and the count of ALERTUI-9;
  - ALERT-29: the empty state is «¿Sin alertas? / Crea una» with «Buscar coches» (ALERTUI-40);
  - ALERT-39: the open card shows the four newest matches, `/alerts/[id]` all of them, with the
    saved state read from the favorites (ALERTUI-7, ALERTUI-18, ALERTUI-20, ALERTUI-22);
  - ALERT-40: «Sin coincidencias» with «Te avisaremos en cuanto salga un coche que encaje.»
    (ALERTUI-41);
  - stale facts:
    - `cuid()`, which is `uuid(7)`;
    - the `Alert` table, which lacks `unsubscribeSubject` and gains `placeName`;
    - `en.ts` / `es.ts`, which are `messages/en.json` / `messages/es.json`;
    - the GitHub cron, which is the QStash schedule;
    - the `window.location.origin` paragraph, which the shared server-side fan-out replaced.
- **`redesign-map.md` (MAPUI):**
  - MAPUI-35: an alert's match renders the alert match card on `/alerts` and the compact row with
    «año · km» on the phone (ALERTUI-8, ALERTUI-25);
  - MAPUI-38: an alert's matches render the Guardados card on desktop `/alerts/[id]`, the alert match
    card in the open AlertCard and the compact row on the phone (ALERTUI-7, ALERTUI-20, ALERTUI-22);
  - MAPUI-40: the dialog's summary keeps its order; the AlertCard's criteria are a second function of
    the same module (ALERTUI-5);
  - MAPUI-42: `createAlert` also receives the place name (ALERTUI-48);
  - MAPUI-54: the alert page's «Volver» is built (ALERTUI-20, ALERTUI-22);
  - Out of scope: showing the place name on `/alerts` moves into scope here.
- **`redesign-saved.md` (SAVED):**
  - SAVED-24: `/alerts` and `/alerts/[id]` centre the toast over their list column (ALERTUI-37);
  - SAVED-37, SAVED-38 and SAVED-41, with the definition of "phone bottom sheet": the alert's car
    sheet and the confirmation sheet are phone bottom sheets (ALERTUI-26, ALERTUI-32, ALERTUI-34).
- **`core-frontend.md` (FRONT):**
  - FRONT-11: `formatDate` comes back, an absolute date with the year only when it differs
    (ALERTUI-10);
  - FRONT-14: `/alerts`' and `/alerts/[id]`'s states are ALERTUI-38 to ALERTUI-42, and their error is
    the page error rather than inline;
  - FRONT-19: `/alerts` and `/alerts/[id]` at desktop and phone width (ALERTUI-43);
  - FRONT-20: the F6 screenshots are owed.
- **`core-platform.md` (PLAT):**
  - PLAT-14: `/alerts`' and `/alerts/[id]`'s error files are the page error of ALERTUI-42, and
    `RouteError` is removed;
  - PLAT-15: the note naming the `redact` paths `lib/logger.ts` holds today, `placeName` and
    `*.placeName` included (2026-10-16).
- **`redesign-navigation.md` (HEAD):**
  - HEAD-7: `/alerts/[id]` at phone width shows «Volver» before the wordmark (ALERTUI-22);
  - HEAD-19: `/alerts/[id]` scrolls too, its last element «Eliminar alerta» (ALERTUI-31).
- **`account-data-export.md` (EXPORT):** EXPORT-6. Each alert also carries `placeName`.

## Decisions and rationale

**The place name is the user's** (owner decision, 2026-10-15: «1A»). The boards write the zone as
«Madrid · 50 km», and the stored criteria hold coordinates, not a name. Reverse-geocoding the point
on each render would call Nominatim from every visit and could name a different place than the one
chosen. So the name the user chose in «Dónde» is stored with the alert, in a nullable `Alert.placeName`.

It never goes on `AlertCriteria` or into its hash, because criteria are deduplicated across users
(ALERT-3). Two users choosing the same point under different names («Madrid», «Centro») must still
share one criteria set and one poll, and neither may see the other's name. On `Alert`, the name is
per user by construction. The alerts created before F6 have no name, and none can be recovered, so
their zone reads the radius alone: honest, and the design draws it (`F6-alertas-escritorio`). The
column is personal data, covered under Data model.

**The alert page exists on desktop** (owner decision, 2026-10-15: «2A»). The open AlertCard shows four
matches, so an alert with twelve needs a page that shows all twelve. On desktop it is the list and
the map, as Guardados is: every match in the Guardados card, three columns, with its heart, and the
map with the zone and every pin. «Ver las N coincidencias» reaches it only when there are more than
four, because with four or fewer the card already shows them all. The digest email already links
there.

**The open alert in the URL** (decided 2026-10-15, `RULES.md` §19: «URL reflects state … expanded
panels»). A shared or reloaded link keeps the alert it was showing, and Back walks the choices, as
SAVED's sort does. The newest is the default and leaves the URL out, so `/alerts` stays the canonical
link. An unknown or foreign id falls back rather than erroring, because it comes from a hand-edited
or old link, and erroring on a foreign id would confirm that it exists. The parameter is `alert`, in
English as every other parameter in the app (`sort`, `make`, `radius`). The phone ignores it, as
SAVED's phone ignores `sort`.

**The server reads the open alert** (decided 2026-10-15). The map draws a pin for every match of the
open alert, not only the four the card shows (`F6-alertas-escritorio`: twelve matches, eleven pins,
one of them grouped). A client-only switch, as SAVED's sort is, would need every match of every alert
in the page up front: twenty alerts at most (ALERT-8), but each with an unbounded number of matches.
Reading the open alert on the server costs one round trip per switch and keeps the page's data to
one alert's matches. The transition keeps the previous alert on screen while the next loads. On the
phone the server still reads the newest alert's matches, which the phone does not show; that is one
bounded read, cheaper than branching the page on a width the server cannot know.

**Two orders, one module** (decided 2026-10-15, MAPUI-40). The AlertCard writes «Toyota Corolla ·
Híbrido · Hasta 18.000 € · Madrid · 50 km»: the fuel before the price, and no «Cualquier marca» or
«Cualquier precio». The create dialog's summary, accepted in F3, writes the car, then the price or
«Cualquier precio», then the rest. The dialog's placeholders tell a buyer what the alert does not
narrow before they save it; the card describes what it does narrow. Changing the dialog to the card's
order would be a design change F6's boards do not draw. So the two stay distinct functions in
`lib/search/alert-summary.ts`, both built from `filter-chips.ts`' label builders, so no label is
written twice. The card's order is the filters row's (MAPUI-13: fuels, price, gearbox, mileage,
year) with the car first and the zone last, which places the gearbox and the year the boards do not
draw.

**Confirm, no undo** (owner decision, 2026-10-15). `RULES.md` §19 asks to confirm a destructive action
or offer an undo. Deleting an alert stops its emails and its polling, and the design draws a
confirmation, so it confirms, and a confirmed delete needs no undo. A soft-deleted alert can still be
restored by saving the same search again (MAPUI-43). On desktop the confirmation is a centred dialog;
on the phone, the bottom sheet, with no «×» and closing by drag, under the rules of every phone sheet
(SAVED-37 to SAVED-41). After a delete there is no toast: the alert gone from the list is the
confirmation. A failure keeps the alert and says so (FRONT-15).

**An alert with no place has no zone** (owner decision, 2026-10-15). Brand, fuel or price alone are a
valid alert (ALERT-38). There is no circle to draw: the pill names the alert, the map fits the pins,
and the phone page leaves the zone section out rather than drawing an empty map.

**A paused alert is labelled, not hidden** (owner decision, 2026-10-15). «En pausa» (`alerts.inactive`)
beside the name, on the folded, open and phone cards, as the source badge is drawn. How to resume is
out of scope; saving the search again from the map reactivates it (MAPUI-43).

**The mileage reads «Hasta N km»** (owner decision, 2026-10-15), as the map's chip, rather than the old
«≤ N km».

**«Nueva alerta» goes to the map** (owner decision, 2026-10-15). An alert is a saved search, so it is
made where the search is, with «Crear alerta» (MAPUI-39).

**At 1024px** (owner decision, 2026-10-15). The 546px list of SAVED, the open card's matches in two
columns, and the map beside it.

**The phone zone map is static** (owner decision, 2026-10-15). It sits in a scrolling page, where a
draggable map would take the scroll, and it only says where the alert watches. The matches are the
rows under it.

**The saved state comes from the favorites** (owner decision, 2026-10-15; bug fix). `CarListingCard`
started every match unsaved, so a saved car read «Guardar» and pressing it saved it again. The alert
pages read the favorites exactly as `/map` reconciles its results (`useFavorites`), and the card that
held its own state is removed.

**Virtualised at both widths** (owner decision, 2026-10-15, `RULES.md` §19, ADR 0021; the desktop grid
added the same day, owner: «1 okey»). An alert's matches are unbounded, so the phone rows and the
desktop grid of `/alerts/[id]` reuse `useSavedList`'s virtualisation, as SAVED's rows and grid do,
and their criteria hold the same guarantees as SAVED's (ALERTUI-29 to ALERTUI-31 on the phone,
ALERTUI-51 to ALERTUI-55 on desktop). The heart there toggles rather than removes, so SAVED-29's
removal and undo become ALERTUI-55's toggle. The alerts list itself is capped at 20 by ALERT-8, so it
is not virtualised.

**Loading and error** (owner decision, 2026-10-15). Loading follows the boards; on desktop the map's
pill reads «Cargando…» with `role="status"` until the page knows which alert is open, and it is the
page's only live region, as SAVED decided for its busy region. The error is `PageError`
(`F0-estado-error-pagina`) on both routes, as on `/favorites`, and `RouteError`, whose only users were
these two routes, goes.

**The toast over the list** (owner decision, 2026-10-15). Both alert routes have a list column beside
a map, so SAVED-24's rule places their toasts over it.

**The matches are snapshots** (owner decision, 2026-10-15). Neither page calls an upstream: that is what
lets them work with every source down (ALERT-39). New-match markers (#122) and email changes (#123)
are their own issues.

**Raw SQL in the e2e fixture** (approved by the owner, 2026-10-15: «2 okey»). The virtualisation criteria need an
alert with 200 matches whose `created_at` order is known. The app's own paths cannot write that:
matches are written only by a poll, and every insert stamps the current time. So a `seedAlerts` /
`seedAlertMatches` fixture in `e2e/fixtures/db.ts` writes `AlertCriteria`, `Alert` and `AlertMatch`
rows with direct `INSERT`s and explicit `created_at`, the pattern the owner approved for
`seedFavorites` on 2026-10-15 (`RULES.md` §11). That approval covered favorites only (`RULES.md` §1:
an approval covers the case it was given for), so this one was given its own, on 2026-10-15. The
`EXPLAIN` test of ALERTUI-44 and ALERTUI-45 (`server/alerts/queries.integration.test.ts`), which
reads the plans of the two page reads at a realistic volume as SAVED-34 does, runs raw SQL too; it
was approved on its own by the owner on 2026-10-16.

**Decided 2026-10-16, after the build's first review** (approved by the owner 2026-10-16):
- a place name is at most 200 characters (ALERTUI-47): enough for any place «Dónde» offers, and a
  bound on what a direct call can store;
- `placeName` and `*.placeName` join Pino's `redact` paths (Data model › Personal data), though no
  call logs an alert today;
- the alert page's desktop title uses its own type style, `alert-title` (40px, line height 1.04,
  tracking -0.01em), not `page-title`: an alert's name can take two lines, and `page-title`'s
  0.9 line height is for one (`DESIGN.md`'s Tall-Caps Rule). `F6-alerta-escritorio` draws it;
- on the phone, «En pausa» opens the AlertCard's criteria line, before the summary, in the same
  badge, so a paused alert with no match keeps its name readable at 390px (`R3-alertas`, the
  AlertCard README). On desktop it stays beside the name.

**Decided 2026-10-16, owner** («todo sí»):
- the confirmation names the alert: «¿Eliminar «{name}»?» (en: "Delete “{name}”?"), on desktop and
  on the phone, in place of «¿Eliminar esta alerta?» (ALERTUI-33, ALERTUI-34);
- long text in the criteria chips (the open card, `/alerts/[id]`) and in the zone pill (the phone's
  static zone map, the desktop map's pill) is cut to one line with «…» when it does not fit, and
  never overflows sideways (Edge cases);
- Back to `/alerts` restores the list column's scroll position, as `/favorites` does (ALERTUI-56);
- the raw-SQL `EXPLAIN` test of the two page reads is approved (Raw SQL in the e2e fixture);
- the shared `hasPlace` (`lib/search/schema.ts`), which `server/search/service.ts` now uses for
  Wallapop's located search instead of its own copy, is approved;
- confirmed: the tokens `alert-name` (17px) and `alert-title` (40px, line height 1.04, tracking
  -0.01em), `placeName` at most 200 characters, the phone «En pausa» on the criteria line, and
  ALERTUI-37's trigger amendment.

**Values not drawn in the design, decided 2026-10-16 (approved by the owner 2026-10-16):**
- the arrival-focus window after a delete on an alert's page is 10 s (`ARRIVAL_FOCUS_MS`,
  `lib/hooks/useAlertDelete.ts`): past it, a later visit to `/alerts` takes no focus;
- `/alerts/[id]`'s loading state at desktop width shows six placeholder Guardados cards (no board
  draws it);
- while a delete runs, Escape, a press outside, a drag and «Cancelar» do nothing: «Cancelar» is
  disabled with «Eliminar», and the focus stays in the confirmation.

**Decided 2026-10-16, owner** («si a todo», after the build's third review):
- pressing a folded AlertCard at desktop width moves the focus to that card once it is open, its
  `<article>` focusable by script (`tabIndex="-1"`), so a keyboard user lands on what the press
  opened; never on a first load, on Back or after a delete, where the focus stays where the page
  puts it (ALERTUI-57);
- the three values not drawn in the design decided 2026-10-16 above (the 10 s arrival-focus window,
  six placeholder cards on the desktop `/alerts/[id]` loading state, and a running delete ignoring
  Escape, a press outside, a drag and «Cancelar») are approved;
- a repeated `alert` parameter reads as its first value, an empty one as none (worked example
  "Open alert", ALERTUI-12).

**Values not drawn in the design, decided 2026-10-15 (owner: «apruebo todo»):**
- a folded AlertCard as one button with `aria-expanded`, and the open card as no control, since the
  README says the card opens by pressing it and one alert is always open;
- the parameter name `alert`;
- the map fitting the zone and every pin together, so no pin is ever off screen;
- an open alert with no match: the badge «Sin coincidencias» and the line of the alert page's small
  empty state in place of the grid (ALERTUI-41);
- on `/alerts`, a pin whose match is not among the four shown outlines no card;
- focus on «Cancelar» when the confirmation opens, the safe choice of an `alertdialog`;
- «Eliminar» with a spinner while the delete runs (`RULES.md` §19), the confirmation closing on a
  failure, and focus returning to its opener;
- after a delete, focus on the heading «Alertas», and the alert page's history entry replaced so Back
  does not reach a 404;
- the car sheet staying open after «Guardar» or «Quitar de guardados», since the sheet is not a
  removal there;
- the browser title of `/alerts/[id]`, «<nombre> · Buy Car Map» (`RULES.md` §19: «`<title>` matches
  current context»);
- `/alerts/[id]` at 1024px in two columns of 231px, as Guardados, since the boards draw that page at
  1440px only;
- `/alerts/[id]`'s loading state at desktop width, which no board draws (ALERTUI-39);
- «Creada el …» with the year only when it is not the current one, in the viewer's time zone;
- a place name sent with criteria that have no place stored as null, since a name with no zone names
  nothing;
- «Acercar» and «Alejar» on the alert map, as the MapZoom README puts them on every desktop map;
- the English copy.
