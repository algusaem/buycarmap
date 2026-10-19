# Redesign F3 — map and search

Key: MAPUI
Status: Implemented
Last updated: 2026-10-19

---

## Problem

The approved BuyCarMap 2.0 design (`docs/design/`, F3 additions approved 2026-10-12) rebuilds the map
screen, and today's screen contradicts it almost everywhere a buyer touches it.

- **The search.** Today it is a free-text box plus a panel of fifteen controls behind one toggle. The
  design asks three questions in a search pill in the header: where, which car and how much. The
  remaining filters live in one panel, and a row of chips shows what is applied. — the quick
  filters and the «Filtros» badge replace the row of chips (MAPUI-63) (amended 2026-10-17, #134)
- **Choosing a car.** Today a buyer picks a brand from a dropdown, then a model from a second
  dropdown that only appears afterwards. The design asks them to type.
- **The results.** The map draws a lime dot per car with a Leaflet popup, and two cars of the same
  city sit on top of each other with no way to reach the lower one. The design draws a price on every
  pin, groups cars that share a point, and opens a preview card linked to the list.
- **The phone.** Today the phone opens the map as a separate full-screen overlay. The design keeps the
  map on screen with the results in a sheet over it.
- **Alerts.** No screen lets a user turn the search they are looking at into an alert: the action
  exists on the server and nothing calls it.
- **Signing in from a card.** Today a signed-out buyer who taps the heart on a card is sent to sign in
  and comes back to `/map` with every filter gone.

In scope:

- **Desktop search:** the search pill and its three popovers, the filters row, and the filters panel
  on desktop.
- **Phone search:** the floating search, the search sheet, and the full-screen filters. — the
  floating search is now the top band (MAPUI-67) (amended 2026-10-17, #134)
- **The map:** price pins and grouping, the preview card, zoom, and the phone results sheet.
- **States:** loading, empty and error, and the route's own loading and error files.
- **The shared car card:** the card used on the map, on saved cars and on alert matches.
- **Crear alerta:** saving the current search as an alert.
- **The phone tab bar:** on the map and on the signed-in pages, replacing the F2 bottom nav, with the phone headers losing the avatar.
- **Removing the Radix select.**

## Acceptance criteria

Search pill and its popovers (desktop)

- [x] MAPUI-1 · component — At desktop width the map header's centre shows the search pill: segments
  «Dónde», «Coche» and «Precio», each with its value as in the worked examples, then the «Buscar»
  button. «Crear alerta» follows the pill. — the pill is 48px tall and the header becomes a band of
  two rows (MAPUI-64) (amended 2026-10-17, design A7 accepted 2026-10-17, #134)
- [x] MAPUI-2 · component — Pressing a segment opens its popover and sets that segment's
  `aria-expanded` to true. At most one popover is open. Pressing outside it or Escape closes it;
  Escape returns focus to the segment. — opened with Enter or Space, the popover appears at once;
  Escape closes it at once; a pointer opens and closes it over 180ms (MOTION-10) (amended
  2026-10-18, MOTION — motion.md)
- [x] MAPUI-3 · component — In «Dónde», typing two or more characters lists the places Nominatim
  returns, each with its region on a second line when it has one, and announces «N resultados» in a
  polite status. Choosing one applies that place with the radius in force (50 km by default) (amends
  MAP-20).
- [x] MAPUI-4 · component — «Dónde» offers the radii 10, 25, 50, 100 and 200 km as a single-choice
  group. Choosing one applies it. The group is disabled while no place is chosen (keeps MAP-13).
- [x] MAPUI-5 · component — «Toda España» clears the place. The search becomes the national one, and
  the results heading counts the national results (MAPUI-33).
- [x] MAPUI-6 · component — In «Coche», typing lists under «Marcas» every brand whose name, or a word
  of it, starts with the text, ignoring case and accents. When one to three brands match, their
  models are listed under «Modelos» as «Marca Modelo», without duplicates. When more than three
  match, only brands are listed.
- [x] MAPUI-7 · component — Choosing a brand applies it and clears the model (keeps MAP-12). It also
  shows the brand as a removable chip, and turns the field into «Modelo de <marca>…», which lists only
  that brand's models. The popover stays open.
- [x] MAPUI-8 · component — Choosing a model, from either list, applies the brand and the model and
  closes the popover. The segment then reads «Marca Modelo», and on reopening, that model carries the
  chosen mark.
- [x] MAPUI-9 · component — Removing the brand chip, or pressing «Cualquier marca», clears the brand
  and the model.
- [x] MAPUI-10 · component — When loading a brand's models fails, «Coche» still lists the matching
  brands and offers no «Modelos» group, and no error is shown.
- [x] MAPUI-11 · component — «Precio» offers:
  - a two-knob range from 0 to 30.000 € in steps of 500 €, where the right knob at the end means no
    maximum;
  - the «Mínimo» and «Máximo» boxes, which accept any amount;
  - every amount box (the price boxes here, «Kilómetros, hasta» in the panel) shows its value with the
    thousands point, «20.000» and «100.000», and reads what is typed with or without it: «100.000» and
    «100000» are both 100.000 (owner decision, 2026-10-13: «que lo muestre con puntos y lo entienda con
    o sin»);
  - the shortcuts «Hasta 5.000 €», «Hasta 10.000 €», «Hasta 20.000 €» and «Hasta 30.000 €», which set
    the maximum and clear the minimum;
  - «Cualquier precio», which clears both.

  A typed minimum above the maximum is swapped with it when the box loses focus.
- [x] MAPUI-12 · component — On desktop nothing asks for confirmation. Every change in a popover or in
  the filters panel updates the URL and re-searches after the pause MAP-11 sets, and «Buscar»
  re-searches at once and closes any open popover (keeps MAP-11).

Filters row and panel

- [x] MAPUI-13 · component — Under the search the filters row shows:
  - «Filtros», with a badge counting the active chips;
  - one chip per active panel criterion, with the texts of the worked examples.

  Removing a chip removes that criterion and re-searches. With no criterion active, the row shows
  «Filtros» with no badge. At every width the row stays on one line: when the chips do not fit, they
  scroll sideways behind «Filtros», which stays fixed at the start (design accepted 2026-10-14).
  Removing a chip with the keyboard moves focus to the next chip's remove button, the previous one
  when it was the last, and «Filtros» when none is left. — replaced by the quick filters (MAPUI-63):
  the row shows «Filtros» with its badge, a divider and the quick filters, and no removable chips;
  the badge still counts the active criteria as the worked example «Chip texts» does (amended
  2026-10-17, design A7 accepted 2026-10-17, #134)
- [x] MAPUI-14 · component — The filters panel has exactly the sections Precio, Combustible, Cambio,
  Kilómetros y año (the maximum mileage and the minimum year, with the visible labels «Kilómetros, hasta»
  and «Año, desde»), Publicado, and Marca y modelo (the «Coche»
  type-ahead), in that order. It has no horsepower, free text, minimum mileage, maximum year or sort
  control. «Kilómetros, hasta» accepts any whole amount from 0 (0 means cars with no mileage) and «Año,
  desde» any whole year: the panel refuses neither (owner decision, 2026-10-13: «0km es posible… hay
  coches del 1900 en wallapop, deja de limitar»). (amended 2026-10-13)
- [x] MAPUI-15 · unit — The fuel choices map onto the shared filter values:
  - «Gasolina» → `gasoline`;
  - «Diésel» → `gasoil`;
  - «Híbrido» → `hybride` and `hybride_plugin` together;
  - «Eléctrico» → `electric-hybrid`;
  - «GLP» → `lpg`.

  «Híbrido» reads as chosen when either hybrid value is present.
- [x] MAPUI-16 · component — «Cambio» is a single choice of «Todos», «Manual» and «Automático».
  There are only two kinds of gearbox, so the three choices cover every combination. «Todos» means no
  gearbox criterion, and it is shown unless exactly one of `manual` and `automatic` is set. Choosing
  replaces the whole gearbox criterion. A URL carrying both `manual` and `automatic` (old links) means
  no gearbox criterion: the search sends none. (amended 2026-10-13)
- [x] MAPUI-17 · component — «Publicado» is a single choice:
  - «Cualquier momento» → no `timeFilter`;
  - «Últimas 24 h» → `today`;
  - «Última semana» → `lastWeek`;
  - «Último mes» → `lastMonth`.
- [x] MAPUI-18 · unit — A URL carrying a criterion the UI no longer offers still parses and still
  reaches the search, with no control or chip for it. Those criteria are `minKm`, `maxYear`,
  `minHorsePower`, `maxHorsePower`, `gearbox=semiautomatic`, `engine=cng` and the `?q=` text. «Borrar»
  and «Quitar filtros» clear them (amends FRONT-13).
- [x] MAPUI-19 · component — On desktop the filters panel is a dropdown under «Filtros» with no close
  button:
  - every choice applies at once;
  - «Ver coches» only closes it, as do pressing outside and Escape;
  - «Borrar» clears every panel criterion at once.

Phone

- [x] MAPUI-20 · component — At phone width the map shows, floating over it, two rows:
  - the search summary: «Madrid · 50 km» over «Cualquier marca · hasta 20.000 €», or «Toda España»
    with no place;
  - beside it, the violet filters button, then the filters row.

  — not floating any more: a solid `surface` band across the top holds the summary with a 44px round
  «Filtros» button beside it (sliders icon, the violet badge at its corner), and under them the quick
  filters (MAPUI-63), scrolling sideways; the map starts under the band (MAPUI-67) (amended
  2026-10-17, design A7 accepted 2026-10-17, #134)

  It shows no zoom control and no app header (keeps HEAD-7), and the tab bar of MAPUI-52 runs along
  the bottom.
- [x] MAPUI-21 · component — Tapping the summary opens the «BUSCAR» sheet with «Dónde», «Coche» and
  «Precio»:
  - nothing chosen there reaches the URL, the summary or the search until «Ver coches», which applies
    it all and closes the sheet;
  - closing the sheet discards it. It closes by dragging its handle down, a press outside it, Escape
    or its visually hidden «Cerrar», with no visible «×» (amended 2026-10-15, owner: no visible close on phone sheets; drag down to close; SAVED-37 to SAVED-41,
    redesign-saved.md);
  - «Borrar» empties the sheet's fields, applied only on «Ver coches».
- [x] MAPUI-22 · component — The violet button opens the full-screen filters panel, with the same
  sections as MAPUI-14 and the apply, discard and «Borrar» behaviour of MAPUI-21. Removing a chip
  from the filters row applies at once. — the violet button becomes the round «Filtros» button of
  the band, outlined in `line` with its violet badge, and a quick filter applies at once (MAPUI-63)
  (amended 2026-10-17, #134)
- [x] MAPUI-23 · component — On a phone the results live in a sheet over the map with three
  positions:
  - peeked, showing the title only;
  - middle, showing the first card;
  - full, showing the list. At full the end of the list keeps a bottom padding of 24px plus the
    safe-area inset (`space-sheet-full-bottom`), so the last card clears the home indicator (design
    accepted 2026-10-14).

  The sheet sits on top of the tab bar. Its title is the results heading of MAPUI-33, and under it
  sits «Crear alerta» (MAPUI-39). The handle is a button named «Lista de resultados»; each press
  moves the sheet one position up: peeked → middle → full, and from full back to peeked, with
  `aria-expanded` true only when full (amended 2026-10-13; amended 2026-10-17, MAPUI-58, owner
  decision and design accepted 2026-10-17, #133).
- [x] MAPUI-24 · component — At phone width, tapping a pin moves the results sheet to its middle
  position showing that car's card first, or the group's first car for a grouped pin.

Map

- [x] MAPUI-25 · component — Every listing with coordinates is a pin button showing its price. Listings
  at the same point (coordinates equal to five decimals) share one pin, «N coches · desde <lowest
  price>». The pins account for exactly the listings in the list (amends MAP-15).
- [x] MAPUI-26 · unit — The grouping of listings into pins is a pure function that produces the worked
  example's groups, labels and order. — a listing with an unknown price (0) is ignored for «desde»
  and goes after every listing with a known price; a group whose prices are all unknown reads «N
  coches · desde 0 €», as a single unknown-price pin reads «0 €» (worked example "Grouping with an
  unknown price") (amended 2026-10-15, SAVED-12 — redesign-saved.md)
- [x] MAPUI-27 · component — At desktop width, activating a pin with a click, Enter or Space does three
  things:
  - it opens the preview card with the photo, name, city, «año · km · combustible», price,
    «Guardar» and «Ver anuncio» (new tab);
  - it marks the pin active;
  - it outlines that car's card in the list and scrolls it into view.

  The preview fades in and fades out, however it closes (design accepted 2026-10-14) — it fades only
  when a pointer opens or closes it; opened with Enter or Space on a pin, or closed with Escape, it
  appears or disappears at once (amended 2026-10-18, MOTION — motion.md). Opening another
  pin while a preview is open closes the first and opens the second, which stays open. When the
  previewed car leaves the results, its preview closes and its pin is no longer active; if the car
  comes back in a later search, its pin is not active and its card not outlined until it is
  activated again.

  A grouped pin's preview lists its cars in order. The preview receives focus when it opens (owner
  approval, 2026-10-13). It closes with its button, Escape
  pressed on the pin or inside the preview, or a press anywhere outside it, on the map or the page
  (owner decision, 2026-10-13: «Vale»), and focus returns to the pin. (amended 2026-10-13)
- [x] MAPUI-28 · component — Hovering or focusing a card in the list marks its pin active.
- [x] MAPUI-29 · component — At desktop width, «Acercar» and «Alejar» change the map zoom by one level,
  and the map shows no other zoom control.

States

- [x] MAPUI-30 · component — While the first page is loading, the list shows placeholder cards shaped
  like the car card. At desktop width the map also shows «Buscando coches…» in a status pill with
  `role="status"` (amends FRONT-14). At phone width the loading state is the map screen itself: the
  floating search and the filters row over the map, and the results sheet in its middle position with
  the heading «BUSCANDO COCHES…» and one placeholder card (`F0-estado-cargando`; amended 2026-10-14).
  — the floating search and the filters row are now the top band with the summary, «Filtros» and the
  quick filters (MAPUI-67) (amended 2026-10-17, #134)
- [x] MAPUI-31 · component — A search with no results shows:
  - «¿Nada por aquí?» over «Amplía el radio»;
  - the line «Con estos filtros no hay coches en 50 km. Prueba más lejos o quita algún filtro.»;
  - «Ampliar a <next radius> km», which applies the next radius;
  - «Quitar filtros», which clears every filter, those of MAPUI-18 and the `?q=` text included, and
    keeps the place and the radius.

  At 200 km or with no place there is no widen button: the headline reads «¿Nada por aquí?» over
  «Quita algún filtro», «Quitar filtros» is the primary action, and neither the line nor the map's
  status pill names a radius. The status pill reads «Ningún coche en 50 km» (amends MAP-15 and
  FRONT-14; keeps MAP-19). (amended 2026-10-13)

  With no filter active, only the place and its radius, there is no «Quitar filtros» (owner
  decision, 2026-10-13: «Vale»):
  - the headline reads «¿Nada por aquí?» over «Amplía el radio»;
  - the line reads «No hay coches en <radius> km.»;
  - the primary action is «Ampliar a <next radius> km»;
  - at 200 km the line reads «No hay coches en 200 km.» and the primary action is «Toda España»,
    which clears the place (MAPUI-5);
  - the status pill reads «Ningún coche en <radius> km». (amended 2026-10-13)
- [x] MAPUI-32 · component — A failed search shows:
  - «¿Se ha caído algo?» over «Prueba otra vez»;
  - the line «No hemos podido traer los anuncios. Suele ser cosa de un momento.»;
  - «Reintentar», which repeats the search;
  - on the map, «Sin conexión con los anuncios».

  It keeps MAP-3 and MAP-7.
- [x] MAPUI-33 · unit + component — The results heading is the desktop list's title and the phone
  sheet's title. It reads:
  - «BUSCANDO COCHES…» while the first page loads;
  - «NINGÚN COCHE» when the search found none;
  - «COCHES» when the search failed;
  - «1 COCHE» or «N COCHES» once the sources are exhausted;
  - «MÁS DE N COCHES» while more pages remain, where N is the number of cars in the list, and «MÁS DE
    1 COCHE» when that number is one (owner approval, 2026-10-13). (amended 2026-10-13)

  It has no «cerca de…» line in any state, since the search already names the place.
- [x] MAPUI-34 · component — `/map` has its own `loading.tsx`, which renders the loading state, and its
  own `error.tsx`. The error file renders the page-error state with the line «Error al cargar el mapa. Vuelve a
  intentarlo más tarde.» and «Reintentar», which retries the route. (amended 2026-10-13)

Car card

- [x] MAPUI-35 · component — A car card shows:
  - the source badge and the heart over the photo, or over the car's tint with the car icon when it
    has no photo;
  - the name, with the city beside it;
  - «año · km · combustible», where the fuel is its group's label (MAPUI-15) and shows only when it
    is recognised; a car with no fuel, or one that is not recognised, shows «año · km»;
  - the price.

  The card is one link to the listing in a new tab, and the heart is a separate button outside that
  link. (amended 2026-10-13)

  On `/favorites` the card is the Guardados variant: a 20:17 photo, «año · km» with no fuel, and «Ver
  anuncio» as visible text inside the link, beside the price (amended 2026-10-15, SAVED-9 and
  SAVED-10 — redesign-saved.md).

  An alert's match in the open AlertCard on `/alerts` is the alert match card: a 110px photo, the
  source as text with no badge, the name, «año · km» and the price, one link with no heart. On the
  phone alert page it is the compact row with «año · km» and no city (amended 2026-10-15, ALERTUI-8
  and ALERTUI-25 — redesign-alerts.md).
- [x] MAPUI-36 · component — The heart's accessible name is «Guardar», or «Quitar de guardados» once
  saved (keeps FAV-9 to FAV-11).
- [x] MAPUI-37 · component — A signed-out buyer who presses the heart is sent to `/login` with a
  `callbackUrl` of the full current path and query, so the search survives the sign-in (bug fix;
  amends FAV-12).
- [x] MAPUI-38 · component — `/favorites` and an alert's matches render this same card (keeps FAV-13
  and ALERT-39). — `/favorites` renders the Guardados variant of MAPUI-35 at desktop width and the
  compact row at phone width. An alert's matches keep this card until F6 (amended 2026-10-15,
  SAVED-9 and SAVED-19 — redesign-saved.md). — An alert's matches render the Guardados card on
  `/alerts/[id]` at desktop width, the alert match card in the open AlertCard on `/alerts`, and the
  compact row at phone width, each with its saved state read from the user's favorites (amended
  2026-10-15, ALERTUI-7, ALERTUI-18, ALERTUI-20 and ALERTUI-22 — redesign-alerts.md).

Crear alerta

- [x] MAPUI-39 · component — «Crear alerta» in the desktop header, and the «Crear alerta» button under
  the phone results sheet's title, open the create-alert dialog, and opening it closes an open preview
  card (MAPUI-27). The dialog has the name prefilled, the search summary, «Crear alerta» and
  «Cancelar». (amended 2026-10-13) On the phone the sheet shows no close «×» and also closes when its
  handle is dragged down (amended 2026-10-15, owner: no visible close on phone sheets; drag down to close; SAVED-37 to SAVED-40, redesign-saved.md).
- [x] MAPUI-40 · unit — The prefilled name and the summary are built from the search as in the worked
  examples. The summary never includes «Publicado». — The dialog's summary keeps this order. The
  AlertCard's criteria on `/alerts` are a second function of the same module
  (`lib/search/alert-summary.ts`), built from the same label builders, with the fuel before the
  price and no «Cualquier marca» or «Cualquier precio» (amended 2026-10-15, ALERTUI-5 —
  redesign-alerts.md).
- [x] MAPUI-41 · component — For a search with no brand, no maximum price and no place, the summary
  reads «Cualquier marca · Cualquier precio». The dialog then shows «Añade una marca, un precio
  máximo o una zona para crear la alerta.» with `role="alert"`, «Crear alerta» is `aria-disabled`, and
  pressing it sends nothing.
- [x] MAPUI-42 · component — «Crear alerta» calls `createAlert` with the current criteria, without
  `timeFilter` and without the `?q=` text, and the trimmed name. On success the dialog closes and the toast «Alerta creada»
  offers «Ver alertas», which links to `/alerts`. The server strips both too: criteria sent to
  `createAlert` with a `timeFilter` or `keywords` are hashed and stored without them, the same as
  the criteria without them. (amended 2026-10-13) — at desktop width the toast's top is 12px below
  the filter row and its centre is over the results list's, and its close button is «Cerrar aviso»,
  as every toast in the app (amended 2026-10-15, SAVED-24 and SAVED-36 — redesign-saved.md) — the
  toast's top is 12px under the header band instead, at 163px (SAVED-24 as amended, MAPUI-64)
  (amended 2026-10-17, #134) —
  `createAlert` also receives the place chosen in «Dónde» as its place name, «Madrid» from
  `locationName=Madrid`, and none with no place; the place name is stored on the alert, never in
  its criteria or their hash (amended 2026-10-15, ALERTUI-46 to ALERTUI-48 — redesign-alerts.md)
- [x] MAPUI-43 · node + component — Saving criteria the user already has as an alert succeeds:
  - a live alert: nothing is created, even at the 20-alert limit, and the answer is `created: false`.
    The dialog closes with the toast «Ya tienes esta alerta» and «Ver alertas»;
  - an alert paused from the email (`active: false`): it is reactivated with the new name;
  - a soft-deleted alert: it is restored with the new name.

  The last two answer `created: true`, and the dialog closes with the toast «Alerta creada» and «Ver
  alertas» (amends ALERT-7). (amended 2026-10-13)
- [x] MAPUI-44 · component — An empty name, once trimmed, shows «Ponle un nombre a la alerta.» under
  the field and sends nothing.
- [x] MAPUI-45 · component — A refused create keeps the dialog open and shows that code's message
  inline. The codes are `tooManyAlerts`, `criteriaTooBroad`, `invalidCriteria` and `unauthenticated`,
  and their messages are the `alertErrors.*` copy. A create that fails on the network keeps the
  dialog open too and shows «No hemos podido crear la alerta. Vuelve a intentarlo.» inline (owner
  decision, 2026-10-13: «Vale»). (amended 2026-10-13)
- [x] MAPUI-46 · component — Signed out, «Crear alerta» goes to `/login` with a `callbackUrl` of the
  full current map path and query, and nothing is created after signing in (keeps ALERT-4).
- [x] MAPUI-47 · e2e — Signed in, creating an alert from `/map?make=Toyota&maxPrice=20000` adds it to
  `/alerts` (database run; covers ALERT-1 end to end).

Radix select

- [x] MAPUI-48 · node — No module imports the Radix select primitive file or `@radix-ui/react-select`,
  the file does not exist, and `package.json` does not list the package. (amended 2026-10-13)

Flows

- [x] MAPUI-49 · e2e — At desktop width, choosing a place, a brand and a maximum price writes each to
  the URL and shows results. Going Back restores the previous criteria (amends FRONT-13).
- [x] MAPUI-50 · e2e — At phone width, choosing in the «BUSCAR» sheet and pressing «Ver coches» writes
  the criteria to the URL. Choosing and then closing the sheet leaves the URL as it was.
- [x] MAPUI-51 · e2e — At phone width every map control has a hit area of at least 44 × 44px: the
  summary, the filters button, the chips' remove buttons, the sheet handle, the pins and the tabs
  (extends HEAD-15). — the quick filters replace the chips' remove buttons (MAPUI-63) (amended
  2026-10-17, #134)

Phone tab bar

- [x] MAPUI-52 · component — At phone width, the map, `/favorites`, `/alerts`, `/alerts/[id]` and
  `/account` show a full-width tab bar at the bottom, padded by the safe area:
  - signed in, four tabs: «Mapa», «Guardados», «Alertas» and «Cuenta»;
  - each tab is an icon over its label, and «Cuenta» shows the avatar's initial;
  - the current tab is marked with `aria-current="page"`, in violet and with a bolder label
    (amended 2026-10-15: label in the text colour for contrast, icon violet — SAVED-33 /
    redesign-saved.md);
  - on `/alerts/[id]` the current tab is «Alertas»;
  - signed out, on the map, two tabs: «Mapa» and «Entrar» (`/login`).

  Signed in, the landing `/` shows it too, with the four tabs and none current (amended 2026-10-14,
  ENTRY-8 — redesign-entry.md).

  The bar replaces the floating bottom nav, and it is absent at desktop width and on every other page
  (amends HEAD-8 and HEAD-17).
- [x] MAPUI-53 · component — On `/map` the tab bar hides only while the results sheet is full, and
  comes back when the sheet leaves full; scrolling the map or the sheet's list never hides it (owner
  approval, 2026-10-13). On the other pages of MAPUI-52 it hides while the page is being scrolled
  down and comes back on scrolling up (bug fix). (amended 2026-10-13) It also comes back when the
  page's scroll reaches its end, even while scrolling down, so the last control, which the page's
  bottom padding keeps clear of the bar, is clear of a bar that is showing (bug fix, found
  2026-10-18, #142; owner decision 2026-10-19). (amended 2026-10-19)
- [x] MAPUI-54 · component — At phone width, the headers of `/favorites`, `/alerts`, `/alerts/[id]`
  and `/account` show the wordmark and the language control and no avatar, because «Cuenta» is in
  the tab bar (amends HEAD-7). The alert page's own «Volver» is built with that page in F6. — Built:
  at phone width `/alerts/[id]`'s header shows «Volver», a 40px round link to `/alerts`, before the
  wordmark; at desktop width «Volver» sits in the list column beside the alert's name (amended
  2026-10-15, ALERTUI-20 and ALERTUI-22 — redesign-alerts.md).

Fuel filter, type-ahead messages and price format

- [x] MAPUI-55 · unit — With a fuel criterion, `applyResultFilters` (`lib/listings/merge.ts`) keeps
  only the listings whose fuel is recognised and belongs to a chosen fuel group (MAPUI-15). A listing
  with no fuel, or a fuel that is not recognised, is dropped. With no fuel criterion every listing
  stays. Like the radius and model post-filters, it can empty a page, and MAP-19's fetching keeps
  going.
- [x] MAPUI-56 · component — In «Coche», text that no brand matches shows «No existe ninguna marca con
  ese nombre» in place of the list. In «Dónde», two or more characters for which Nominatim returns no
  place show «No existe ningún lugar con ese nombre». When the place search itself fails (Nominatim
  answers with an error, or the request does not get through), «Dónde» says that the place search is
  down: «El buscador de lugares no responde. Prueba otra vez.», never that the place does not exist
  (owner decision, 2026-10-13: «que quede claro que el buscador ha caído»; design accepted 2026-10-14). Each message is in the polite status, and it shows
  wherever its field does: the desktop popover, the phone «BUSCAR» sheet and, for «Coche», the
  filters panel's «Marca y modelo».
- [x] MAPUI-57 · unit — Every price has one format, with a thousands point, four-digit amounts
  included: «9.500 €», «14.500 €». The cards, the preview, the pins, the chips and the pill all
  format through `formatPrice`, and `lib/format.ts` has no second price formatter (amends FRONT-11).

Phone results sheet: drag and map tap (added 2026-10-17, #133; design accepted 2026-10-17,
`docs/design/system/components/BottomSheet/README.md`)

- [x] MAPUI-58 · component — Pressing the results sheet's handle (Enter, Space or a click) moves the
  sheet one position up: peeked → middle, middle → full, full → peeked (amends MAPUI-23). — Enter or
  Space moves the sheet at once; a pointer press still springs it (MOTION-14) (amended 2026-10-18,
  MOTION — motion.md)
- [x] MAPUI-59 · component + e2e — At phone width, the results sheet can be dragged up and down from
  its handle strip and from its header (the results heading). On release it settles on the position
  (peeked, middle or full) whose top edge is nearest to where the sheet's top edge was released. A
  drag that starts in the list does not move the sheet; at full the list keeps its own scroll. The
  release point is where the finger left the screen: the sheet's top edge when the drag started plus
  the finger's travel from press to release, kept between full and peeked, never the edge last drawn,
  so a frame the browser had not drawn yet at release does not change where the sheet settles (bug
  fix, found 2026-10-19 on PR #147's CI). (amended 2026-10-19)
- [x] MAPUI-60 · unit + e2e — A drag released faster than 800px/s moves the sheet exactly one
  position in the drag's direction from where the drag started, whatever the nearest position is;
  at peeked a fast downward release and at full a fast upward release leave it where it is. Under
  reduced motion the sheet settles without animation.
- [x] MAPUI-61 · component — Dragging is never the only way: every position stays reachable with the
  handle alone (MAPUI-58) and the keyboard. The tab bar still hides only while the sheet is full
  (MAPUI-53), whether the sheet got there by dragging or by the handle.
- [x] MAPUI-62 · component — At phone width with the sheet at middle, tapping the map or starting to
  pan it moves the sheet to peeked. At peeked a map tap or pan changes nothing. Tapping a pin keeps
  MAPUI-24 (sheet to middle with that car first) and never lowers the sheet; taps on the floating
  search, the filters row and the map's own controls do not count as map taps. — the floating
  search is now the top band, so taps on the band (the search summary, «Filtros» and the quick
  filters) do not count as map taps: the band sits above the map, not over it (amended 2026-10-18,
  MAPUI-67, #134)

Header band, quick filters and desktop layout (design A7 accepted 2026-10-17, #134)

- [x] MAPUI-63 · component — Under the search, at every width, the map shows the quick filters, in this
  order: «Gasolina», «Diésel», «Manual», «Automático» and «Hasta 100.000 km». Each is a toggle button
  (`aria-pressed`) that reads the current search and applies at once, re-searching:
  - «Gasolina» and «Diésel» add or remove their fuel (MAPUI-15) and leave the other fuels as they are;
  - «Manual» and «Automático» are pressed when the gearbox is exactly that one (MAPUI-16); pressing
    one sets the gearbox to it, so at most one of them is pressed; pressing the pressed one clears the
    gearbox criterion;
  - «Hasta 100.000 km» is pressed when the maximum mileage is exactly 100.000 km; pressing it sets
    it, and pressing it again clears the maximum mileage.

  A pressed quick filter has the violet fill; an unpressed one the line border. Pressed also reads in
  the weight, 800 against 600, as LOOK-12, and «Manual» and «Automático» read pressed by the panel's
  own rule (MAPUI-16, MAPUI-18) (amended 2026-10-17, #134). On desktop they follow
  «Filtros» and a divider; on a phone «Filtros» is the round button beside the summary (MAPUI-67).
  The filters panel and the quick filters always show the same criteria.
- [x] MAPUI-64 · e2e — At 1440 × 900 on `/map`, the header is one `surface` band with no bottom border
  (HEAD-21), 48px from each side, 151px tall:
  - row one: the wordmark, the 48px-tall search pill with «Crear alerta» centred, the navigation;
    the pill's top is 24px under the window's top;
  - row two, 28px under the pill: «Filtros», a divider and the quick filters, 34px tall, centred on the
    window, 17px above the band's bottom — «Filtros» in the band is named «Filtros» and described as
    «N filtros activos» while criteria are active, as on the phone (MAPUI-67); its badge is not part of
    the name (amended 2026-10-17, #134).
- [x] MAPUI-65 · e2e — At desktop width, under the band, the list and the map share the width between
  48px side margins in two equal halves 48px apart. The results heading is 24px under the band. The
  map is a card with the `card` radius (22px) and no border, its top level with the heading's top and
  its bottom 24px above the window's bottom. The cards sit in a grid with 24px between columns and
  40px between rows: two columns below 1920px wide, three from 1920px (Airbnb's measured layout;
  owner, 2026-10-17: «puedes comprobar que lo tenemos igual?»).
- [x] MAPUI-66 · e2e — At desktop width the active card's 2px lime outline (MAPUI-27, MAPUI-28) is
  drawn whole on every card of the list, the first row and both outer columns included, and the
  list's scrollbar sits at the list's outer edge, not against the cards (bug fix, found 2026-10-17).
  — a card focused with the keyboard shows exactly one outline: the photo's lime ring shows while
  the card's link has keyboard focus, whatever the pointer does and whether or not the car has a
  pin, on every car card (the map's list, Guardados SAVED-11, an alert's matches ALERTUI-17), and no
  second outline around the card (bug fix, found 2026-10-18) (amended 2026-10-18, #134)
- [x] MAPUI-67 · component — At phone width the map's top is a `surface` band with no border: the
  search summary (MAPUI-20) with the 44px round «Filtros» button beside it, which carries the violet
  badge while any criterion is active and is named «Filtros» and, while criteria are active, is
  described as «N filtros activos» («1 filtro activo») (amended 2026-10-17, #134), then the quick
  filters scrolling sideways. The map, its pins and the results sheet are under the band, never behind it.

## Worked examples

**A fast flick on an idle page (MAPUI-60, bug fix #135).**

- **Input:** phone 390 × 844, `/map`, the results sheet at middle and nothing else animating; a 60px drag up on the handle, drawn within a single animation frame, then released.
- **Before the fix:** the release speed was read from the animation library, which stamps the press with the last frame it drew; with the page idle that frame is old, the speed reads 0px/s, and the sheet settles back to middle.
- **Correct result:** the release speed is measured from the pointer events themselves — the distance from the newest sample at least 100ms older than the release (or the press, when none is that old) to the release, over the time between them — so it reads above 800px/s and the sheet moves one position, to full. When that reference would be the press and the next sample is more than 200ms after it, the next sample is the reference instead (see the next example).

**A flick after a hold (MAPUI-60, owner 2026-10-18).**

- **Input:** phone 390 × 844, `/map`, the results sheet at middle; the handle is pressed at 0ms and held still, then moved 30px up at 500ms and 60px up at 516ms, and released at 520ms at 60px.
- **Correct result:** the press is more than 200ms before the first move, so the reference is the move at 500ms: 30px over 20ms, 1500px/s, above 800px/s, and the sheet moves one position, to full. Measured from the press it would read 60px over 520ms, about 115px/s, and the sheet would settle back to middle, which is wrong.

**Pill segment values (MAPUI-1).** Every row below is drawn in the design except the empty «Dónde»
row, whose text comes from SearchPill's guide.

| Search | Dónde | Coche | Precio |
| --- | --- | --- | --- |
| nothing chosen | «Ciudad o código postal…» (muted) | «Cualquier marca» | «Cualquiera» |
| Madrid, 50 km | «Madrid · 50 km» | | |
| brand Toyota | | «Toyota» | |
| Toyota Corolla | | «Toyota Corolla» | |
| max 20.000 | | | «Hasta 20.000 €» |
| min 3.000 | | | «Desde 3.000 €» |
| min 3.000, max 20.000 | | | «3.000 – 20.000 €» |

**Popover exclusivity (MAPUI-2), bug found in F4 (2026-10-14).** With «Dónde» open, pressing
«Coche» closed both; correct: «Coche» opens and «Dónde» closes.

**Quick filters (MAPUI-63).**

| Search before | Pressed | Search after | Pressed after |
| --- | --- | --- | --- |
| no criterion | «Diésel» | `engine=gasoil` | «Diésel» |
| `engine=gasoil` | «Gasolina» | `engine=gasoil,gasoline` | «Gasolina», «Diésel» |
| `engine=gasoil,electric-hybrid` | «Diésel» | `engine=electric-hybrid` | none |
| no criterion | «Manual» | `gearbox=manual` | «Manual» |
| `gearbox=manual` | «Automático» | `gearbox=automatic` | «Automático» |
| `gearbox=automatic` | «Automático» | no gearbox | none |
| `gearbox=manual,automatic` (old link) | nothing | unchanged; reads and sends no gearbox (MAPUI-16) | none |
| `gearbox=manual,semiautomatic` (old link) | «Manual» | no gearbox | none |
| `maxKm=150000` | nothing | `maxKm=150000` | none |
| no criterion | «Hasta 100.000 km» | `maxKm=100000` | «Hasta 100.000 km» |
| `maxKm=150000` | «Hasta 100.000 km» | `maxKm=100000` | «Hasta 100.000 km» |
| `maxKm=100000` | «Hasta 100.000 km» | no maximum mileage | none |

With nothing pressed, `gearbox=manual,semiautomatic` (old link) reads «Manual» pressed: exactly one
of `manual` and `automatic` is set (MAPUI-16), and `semiautomatic` has no control (MAPUI-18).

**Desktop layout (MAPUI-64, MAPUI-65).** Measured on the accepted design.

| Window | Band | Pill | Row two | Heading top | List | Map card | Columns |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440 × 900 | 0–151 | 24–72 | 100–134 | 175 | 48–696 | 744–1392 × 175–876 | 2 |
| 2560 × 1440 | 0–151 | 24–72 | 100–134 | 175 | 48–1256 | 1304–2512 × 175–1416 | 3 |

**The desktop list's clipped outline (MAPUI-66, bug fix #134).** Measured on production at 1440 × 900.

- **Input:** `/map`, results loaded, the pointer over the first card of the list.
- **Before the fix:** the card's left and top edges are the scroll container's (both 32px from the
  left, both 224px from the top), so the scroll container clips the outline's top and left sides, and
  the right side on the last column. The scrollbar sits against the last column, with the column's
  32px right padding outside it.
- **Correct result:** the outline shows on all four sides of every card, and the scrollbar is at the
  list's outer edge with the side padding between it and the cards.

**Two outlines on a focused card (MAPUI-66, bug fix #134).**

- **Input:** 1440 × 900, `/map`, results loaded, Tab until the first card's link has focus.
- **Before the fix:** the photo shows its 2px lime ring and the link also draws the global focus
  outline (2px lime at 3px offset) around the whole card — two lime outlines.
- **Correct result:** the photo's lime ring shows while the card's link has keyboard focus,
  whatever the pointer does and whether or not the car has a pin, on every car card (the map's
  list, Guardados SAVED-11, an alert's matches ALERTUI-17); the link draws no second outline.
  Moving the pointer over another card keeps the ring on the focused one.

**Chip texts (MAPUI-13).** The chips are gone (MAPUI-63); the texts still name the criteria the
«Filtros» badge counts.
- `engine=gasoil`: one chip, «Diésel». `engine=gasoline,gasoil`: two chips, «Gasolina» and «Diésel».
- `engine=hybride,hybride_plugin`: one chip, «Híbrido».
- `gearbox=automatic`: «Automático».
- `maxPrice=20000`: «Hasta 20.000 €».
- `maxKm=100000`: «Hasta 100.000 km». `minYear=2017`: «Desde 2017».
- `timeFilter=today`: «Últimas 24 h».
- `make=Toyota&model=Corolla`: «Toyota Corolla».

So `engine=gasoil&maxPrice=20000&gearbox=automatic&timeFilter=today` gives the badge 4 and the chips
«Diésel», «Hasta 20.000 €», «Automático» and «Últimas 24 h».

**Gearbox (MAPUI-16).** `gearbox=manual,automatic` reads «Todos», gives no chip and sends no gearbox
criterion. `gearbox=manual` reads «Manual» and sends `manual`.

**«Quitar filtros» (MAPUI-31).**
`/map?lat=40.4168&lng=-3.7038&placeId=1&locationName=Madrid&radius=25&engine=gasoil&maxPrice=20000&q=golf`
gives `/map?lat=40.4168&lng=-3.7038&placeId=1&locationName=Madrid&radius=25`: the place and the radius stay,
every filter and the text go.

**Fuel (MAPUI-35, MAPUI-55).** Four listings, all 2019 with 71.000 km, with the fuels `gasoil`,
`gasoline`, none and `vapor` (a token no group recognises):
- with no fuel criterion, all four are listed. Their meta lines read «2019 · 71.000 km · Diésel»,
  «2019 · 71.000 km · Gasolina», «2019 · 71.000 km» and «2019 · 71.000 km»;
- with `engine=gasoil`, only the first is listed;
- with `engine=hybride,hybride_plugin`, none is listed.

**Fuel vocabulary (MAPUI-35, MAPUI-55).** The fuel strings a live probe of the three sources returned
on 2026-10-13 (`docs/specs/data-sources.md` › Contracts), and the group each belongs to:

| Source | Fuel string | Group (card label) |
| --- | --- | --- |
| Wallapop | «Gasoline» | Gasolina |
| Wallapop | «Diesel» | Diésel |
| Wallapop | «Hybrid», «Hybrid Plug-in» | Híbrido |
| Wallapop | «Electric» | Eléctrico |
| Wallapop | «LPG» | GLP |
| Wallapop | «CNG» | none |
| coches.net | «Gasolina» | Gasolina |
| coches.net | «Diésel» | Diésel |
| coches.net | «Híbrido», «Híbrido enchufable» | Híbrido |
| coches.net | «Eléctrico» | Eléctrico |
| coches.net | «Gas licuado (GLP)» | GLP |
| coches.net | «Gas natural (CNG)» | none |
| Milanuncios | «gasolina» | Gasolina |
| Milanuncios | «diesel» | Diésel |
| Milanuncios | «híbrido» | Híbrido |
| Milanuncios | «eléctrico» | Eléctrico |

A CNG listing shows «año · km» on its card, and a fuel criterion drops it.

**A fuel value no group offers (MAPUI-55; owner decision, 2026-10-13: «okey»).** A criterion holding
any value no fuel choice offers applies no fuel post-filter at all. `engine=gasoil,cng` keeps both a
«Gas natural (CNG)» listing and a «Diésel» one; `engine=gasoil` alone keeps only the «Diésel» one.

**Price format (MAPUI-57).** `formatPrice(9500, "es")` → «9.500 €»; `formatPrice(14500, "es")` →
«14.500 €». A pin of 9.500 € reads «9.500 €», and a group «2 coches · desde 9.500 €».

**Coche type-ahead (MAPUI-6 to MAPUI-8).**
- Typing «Toy» lists «Toyota» under «Marcas». Under «Modelos» it lists Toyota's models, so with the
  models Corolla, Yaris and C-HR it shows «Toyota Corolla», «Toyota Yaris» and «Toyota C-HR».
- When Wallapop and coches.net both return «Corolla», it is listed once.
- Choosing «Toyota» gives the chip «Toyota», the field «Modelo de Toyota…» and the list «Corolla»,
  «Yaris», «C-HR».
- Choosing «Corolla» gives the pill «Toyota Corolla» and the URL `make=Toyota&model=Corolla`. The model
  is stored by name.

**Grouping (MAPUI-25, MAPUI-26).** Four listings:
- A, 14.500 €, at (40.41680, -3.70380);
- B, 9.500 €, at (40.41680, -3.70380);
- C, 12.000 €, at (40.416804, -3.703801);
- D, 18.900 €, at (41.38790, 2.16990).

They give two pins:
- «3 coches · desde 9.500 €» for A, B and C, since C equals the others to five decimals. Its preview
  lists B, C, A, by price ascending.
- «18.900 €» for D.

**Grouping with an unknown price (MAPUI-26; amended 2026-10-15, SAVED-12 — redesign-saved.md).**
Listings E (0, unknown), F (12.000 €), G (9.500 €) and H (0, unknown), placed at (40.41680, -3.70380)
in three cases:
- E, F and G there: one pin, «3 coches · desde 9.500 €», not «desde 0 €». Its preview lists G, F, E.
- E and H there: one pin, «2 coches · desde 0 €».
- E alone there: one pin, «0 €», as today.

**Results heading (MAPUI-33).**

| State | Heading |
| --- | --- |
| first page loading | «BUSCANDO COCHES…» |
| failed | «COCHES» |
| sources exhausted, no cars | «NINGÚN COCHE» |
| exhausted with 1 car | «1 COCHE» |
| exhausted with 24 cars | «24 COCHES» |
| 40 cars listed, more pages left | «MÁS DE 40 COCHES» |
| 1 car listed, more pages left | «MÁS DE 1 COCHE» |
| 40 listed, load-more running | «MÁS DE 40 COCHES» (unchanged until the page lands) |

**Empty state widening (MAPUI-31).** 10 → «Ampliar a 25 km», 25 → «Ampliar a 50 km», 50 → «Ampliar a
100 km», 100 → «Ampliar a 200 km», 200 → no button. At 200 km or with no place: the headline «¿Nada por aquí?» over «Quita algún filtro», «Quitar filtros» as the primary action, «Ningún coche con estos filtros»
on the map, and the line «Con estos filtros no hay coches. Prueba a quitar algún filtro.»

**Empty state with no filter (MAPUI-31).**

| Search | Line | Primary action | Status pill |
| --- | --- | --- | --- |
| Madrid, 50 km, nothing else | «No hay coches en 50 km.» | «Ampliar a 100 km» | «Ningún coche en 50 km» |
| Madrid, 200 km, nothing else | «No hay coches en 200 km.» | «Toda España» | «Ningún coche en 200 km» |

Neither shows «Quitar filtros». In the strings above the space before «km» (and before «h» in
«Últimas 24 h») is a non-breaking space, U+00A0.

**Alert name and summary (MAPUI-40).**

| Search | Prefilled name | Summary |
| --- | --- | --- |
| Toyota Corolla, max 20.000, Madrid 50 km | «Toyota Corolla · Madrid» | «Toyota Corolla · Hasta 20.000 € · Madrid · 50 km» |
| Toyota, Diésel, Automático, no place | «Toyota» | «Toyota · Cualquier precio · Diésel · Automático» |
| max 20.000, Madrid 25 km, Últimas 24 h | «Madrid» | «Cualquier marca · Hasta 20.000 € · Madrid · 25 km» |
| max 15.000 only | «Hasta 15.000 €» | «Cualquier marca · Hasta 15.000 €» |
| nothing | «» | «Cualquier marca · Cualquier precio» (too broad, MAPUI-41) |

In the summary, the car comes first («Cualquier marca» when there is none) and the price second
(«Cualquier precio» when there is none). Then come the fuels, the gearbox, «Hasta … km», «Desde …»
and the place with its radius, each only when set.

**Sign-in return (MAPUI-37, MAPUI-46; bug fix).**
- **Input:** signed out on `/map?make=Toyota&maxPrice=20000`, pressing the heart.
- **Today:** it goes to `/login?callbackUrl=%2Fmap` and the filters are lost.
- **Correct result:** `/login?callbackUrl=%2Fmap%3Fmake%3DToyota%26maxPrice%3D20000`.

«Crear alerta» signed out gives the same URL.

**Saving an alert again (MAPUI-43).** The user saves «Toyota · hasta 20.000 €» with the name «Toyota
barato», and already has an alert with the same criteria hash:
- live, named «Toyota»: nothing changes, `createAlert` returns `ok({ created: false })` and the toast
  is «Ya tienes esta alerta»;
- live, with the user at 20 alerts: the same, `ok({ created: false })`, not `tooManyAlerts`;
- paused from the email (`active: false`): it becomes active, named «Toyota barato», and the answer is
  `ok({ created: true })` with the toast «Alerta creada»;
- soft-deleted: it is restored, active and named «Toyota barato», with `ok({ created: true })` and the
  toast «Alerta creada».

**The tab bar on the map (MAPUI-53; bug fix).**
- **Input:** at phone width on `/map`, the results sheet in its middle position, scrolling the sheet's
  list down, then dragging the map.
- **Before the fix:** the tab bar hides as on a scrolled page.
- **Correct result:** the tab bar stays. It hides only when the sheet reaches full, and comes back when
  it leaves full.

**The tab bar at the end of a page's scroll (MAPUI-53; bug fix, #142).**
- **Input:** signed in at 390 × 844 on `/alerts/[id]` with 200 matches (ALERTUI-31). Tab reaches
  «Eliminar alerta» and the page scrolls to its end; the bar has hidden on the way down. The bar's top
  edge, once showing, is at 779px; the page's bottom padding (88px) puts the button's bottom edge at
  756px at the end of the scroll.
- **Before the fix:** the bar stays hidden at the end. The only way to bring it back is to scroll up,
  which moves the content down by the same amount: a 60px wheel up puts the button's bottom edge at
  816px, and once the bar finishes sliding in, its top at 779px covers the button.
- **Correct result:** reaching the end of the scroll shows the bar while the content stays where it
  is. Once the bar has settled, the button's bottom edge (756px) is above the bar's top edge (779px).
  Scrolling up from the end still keeps the bar shown, as before.

**Phone results sheet (MAPUI-58 to MAPUI-62, #133).** The positions' top edges are whatever the
layout measures (the design gives no fixed heights); call them P (peeked), M (middle) and F (full),
with P below M below F. The test measures them and derives the expectation from them.

**Release point (MAPUI-59; bug fix, 2026-10-19).** On a loaded phone the browser can skip frames, so
the sheet drawn on screen lags behind the finger. Seen on PR #147's CI (GitHub runner, software
WebGL): (1) from middle, the handle dragged down by 0.3·(P−M) and released slowly was read as
settled 108px below M, still at the release point; (2) from full, the handle dragged past the M/P
midpoint and released slowly settled at middle instead of peeked. Correct result: the sheet settles
from the finger's release point — its top at press plus the finger's travel — so (1) settles at
middle and (2) at peeked, however many frames were skipped. A test reads the sheet as settled only
after several drawn frames without movement, never after a stretch of wall-clock time.

| Start | Gesture | Result |
| --- | --- | --- |
| peeked | press the handle | middle |
| middle | press the handle | full |
| full | press the handle | peeked |
| middle | drag the header up, release slowly with the top edge nearer F than M | full |
| middle | drag the handle down, release slowly with the top edge nearer M than P | middle |
| full | drag the handle down, release slowly with the top edge nearer P than M | peeked |
| middle | drag the header up a little and release faster than 800px/s | full |
| middle | drag the handle down a little and release faster than 800px/s | peeked |
| full | drag the handle down a little and release faster than 800px/s | middle |
| middle | drag the header up a little and release at exactly 800px/s | settles on the nearest position |
| peeked | drag the handle down and release fast | peeked |
| middle | drag on the card | middle, nothing moves (MAPUI-23 shows one card) |
| full | drag inside the list | full, the list scrolls |
| middle | tap the map | peeked |
| middle | pan the map | peeked |
| peeked | tap the map | peeked |
| peeked | tap a pin | middle, that car's card first (MAPUI-24) |
| middle | tap the floating search — the floating search is now the top band, so tap the band's search summary (amended 2026-10-18, MAPUI-67, #134) | middle, the search opens |

## Data model

None. Alerts keep their `AlertCriteria.criteria` JSON and `Alert.label`. The create path only learns
to tell a new alert from an existing one, and to reactivate a paused one (Contracts). This reads `Alert`, `AlertCriteria` and
`Favorite`, unchanged.

## Permissions

- The map itself is public. Saving a car and creating an alert stay behind `getCurrentUser()` in
  their server actions; the UI's sign-in redirects are UX, not authorization.
- `createAlert` keeps its own checks:
  - the session (ALERT-4);
  - specificity (ALERT-38), even though the dialog already disables the button;
  - the per-user limit (ALERT-8).
- Its new "already existed" answer only reports on the caller's own alerts (MAPUI-43).

## Edge cases

- **Popovers.**
  - Only one is open at a time (MAPUI-2).
  - Reopening «Coche» with a model chosen shows the brand step and that model marked (MAPUI-8).
- **Brand catalogue.**
  - More than three brands matching gives brands only, so a one-letter query does not fan out
    into many model requests (MAPUI-6).
  - A failed model request degrades to brands only (MAPUI-10).
- **Price.**
  - A typed minimum above the maximum is swapped (MAPUI-11).
  - An amount above 30.000 € puts the right knob at the end, with the exact amount kept in its box
    (MAPUI-11).
- **Criteria the UI no longer offers.**
  - Old links with removed criteria keep working, with no control or chip for them (MAPUI-18). A
    buyer with an empty result clears them with «Quitar filtros».
  - The old multi-choice gearbox, e.g. `gearbox=manual,automatic`, reads as «Todos» and sends no
    gearbox criterion (MAPUI-16).
  - `engine=hybride_plugin` alone reads «Híbrido» chosen. Unchoosing it removes both hybrid values
    (MAPUI-15).
- **No place.**
  - National search, the counted heading, radius disabled (MAPUI-4, MAPUI-5, MAPUI-33).
  - The empty state has no widen button (MAPUI-31). Wallapop still gets the centre of Spain (SRC-8,
    kept).
  - No place, no filter and no car: the failed-search state of MAPUI-32 shows, «Reintentar»
    included, with no copy of its own, since a national search with nothing narrowing it comes back
    empty only when the sources failed (decision, 2026-10-13).
- **Results.**
  - A filtered page can come back empty while more pages remain. The search keeps fetching (MAP-19,
    kept), and the empty state shows only once the sources are exhausted.
  - A listing without coordinates is in the list but has no pin. Today every source gives every
    listing a point (SRC-3, kept), so this is a guard, not a case the design draws.
- **Fuel.**
  - A listing with no fuel, or one no group recognises, shows no fuel on its card and is dropped by a
    fuel criterion (MAPUI-35, MAPUI-55).
  - A criterion holding a value no fuel choice offers (MAPUI-18), alone (`engine=cng`) or beside
    others (`engine=gasoil,cng`), applies no fuel post-filter, so MAPUI-55 drops nothing for it
    (owner decision, 2026-10-13).
  - A CNG listing («CNG», «Gas natural (CNG)») is in no group: no fuel on its card, dropped by a fuel
    criterion (worked example "Fuel vocabulary").
  - An alert with a fuel criterion drops a listing whose fuel is unknown, as the map does (owner
    decision, 2026-10-13: «es lógico que funcione así»; ALERT-43).
- **Type-ahead with no match** (MAPUI-56).
- **Phone.**
  - A discarded sheet leaves the search, the URL and the summary untouched (MAPUI-21, MAPUI-50).
- **Crear alerta.**
  - A too-broad search: the button is disabled, and the server refuses anyway (MAPUI-41, ALERT-38).
  - An empty name (MAPUI-44).
  - Twenty alerts already (MAPUI-45), unless the criteria match a live alert (MAPUI-43).
  - Already saved, paused from the email, or deleted (MAPUI-43).
  - A soft-deleted alert no longer counts toward the 20, so restoring it at the limit is refused with
    `tooManyAlerts` (MAPUI-45; owner approval, 2026-10-13). A paused alert still counts, so
    reactivating it is not checked against the limit (MAPUI-43).
  - Paused at the limit: a paused alert and 19 others. Saving the paused alert's criteria again
    answers `created: true`, reactivates that same alert with the new name, and the user still has 20
    alerts (MAPUI-43).
  - A direct call to `createAlert` carrying `timeFilter` or `keywords` stores and hashes the criteria
    without them (MAPUI-42).
  - A create that fails on the network keeps the dialog open with its message (MAPUI-45).
  - Signed out (MAPUI-46).
  - A session that ends while the dialog is open gets `unauthenticated` inline (MAPUI-45).

## Out of scope

- The landing's search (F4, [ENTRY](redesign-entry.md)): it no longer produces `?q=`; the map still
  parses it from old links (MAPUI-18).
- The saved-cars and alerts pages' own layouts (F5, F6). This phase changes only the card they render
  (MAPUI-38), their phone header and their tab bar (MAPUI-52 to MAPUI-54). The phone car sheet on
  saved cars and the phone alert page are designed (`F5-guardados-coche`, `F6-alerta`,
  `F6-alerta-estados`) but are built in F5 and F6.
- Using the browser's location to centre the first search (issue #117).
- Recency on coches.net and Milanuncios. «Publicado» reaches Wallapop only, as `timeFilter` does today
  (`docs/specs/data-sources.md`).
- A photo carousel on the card (its own issue).
- Deduplicating the same car across sources (`docs/specs/data-sources.md`).
- Showing the place name on `/alerts`. The stored criteria hold coordinates, not a name. (Amended
  2026-10-15, ALERTUI — redesign-alerts.md: in scope in F6, which stores the name on the alert,
  ALERTUI-46.)
- Dragging the phone results sheet between its positions. The handle toggles them (MAPUI-23); the
  drag is tracked in [#126](https://github.com/algusaem/buycarmap/issues/126). (Amended 2026-10-17:
  in scope, MAPUI-58 to MAPUI-62, #133.)

## Contracts

**`createAlert`** (`server/alerts/actions.ts`) keeps its signature `createAlert(criteria, label)`
(amended 2026-10-15, ALERTUI — redesign-alerts.md: `createAlert(criteria, label, placeName?)`) and
returns the shared `Result<{ created: boolean }, AlertError>` (PLAT-11, `lib/result.ts`):

- `ok({ created: false })` when the caller already had a live alert with the same criteria hash, even
  at the per-user limit;
- `ok({ created: true })` for a new alert, for one paused from the email (`active: false`) and
  reactivated, and for one restored from a soft-deleted row. The last two take the new name.

The error codes are unchanged: `unauthenticated`, `invalidCriteria`, `criteriaTooBroad`,
`tooManyAlerts`. The criteria never carry `timeFilter` or the `?q=` text (MAPUI-42).

**Specificity.** `isSpecificEnough` stays in `server/alerts/schema.ts` as the refinement of
`alertCriteriaSchema`, which the create-alert dialog and `createAlert` both parse with, so they share
one rule (amends `docs/specs/core-layout.md`, which moved it to `service.ts`).

**The preview card** is the marker's Leaflet popup, not a Radix popover, so it is positioned with the
map and moves with it. Its content animates with Motion and receives focus on open (MAPUI-27).

**Type scale.** The design system's type scale (`docs/design/system/tokens.json` › `type`) is exposed
as theme tokens, one per entry there and with its values unchanged (owner approval, 2026-10-13). The
extra tokens the build added are recorded in `tokens.json` too, so the list of theme type tokens and
`tokens.json` › `type` match (owner approval, 2026-10-13: «Vale»).

**Surface brief.** `/map`'s Impeccable brief is [`.impeccable/surfaces/map.md`](../../.impeccable/surfaces/map.md)
(`STACK.md` §17).

**Brand list.** The type-ahead's brands are the existing 35-brand list
(`components/map/search-filter-options.ts`). Models come from `listCarModels(make)`, one call per
matching brand, at most three per query. They are cached per brand in the page's hook for the
session, and deduplicated by name ignoring case. The model is stored and sent by name, which
coches.net resolves through its existing name lookup (SRC-7, kept).

**Location.** `searchLocations` (`lib/geo/nominatim.ts`) stays browser-side (FRONT-7). The second
line is the display name after its first comma, without a trailing «España». It throws when
Nominatim answers with an error or the request does not get through, so the search can tell a
failure from no place: `useLocationSearch` exposes `failed`, and «Dónde» shows the place-search-down
message (MAPUI-56).

**Dependencies.**
- Added, approved by the owner on 2026-10-12 and recorded in
  [ADR 0020](../decisions/0020-radix-popover-dialog-slider.md):
  - `@radix-ui/react-popover`, for the desktop popovers, the filters dropdown and «Crear alerta»;
  - `@radix-ui/react-dialog`, for the phone sheets, with focus trapped and returned;
  - `@radix-ui/react-slider`, for the price range.
- Removed: `@radix-ui/react-select`.

**i18n keys**, both locales, `lib/i18n/types.ts`:
- New `search.*`: the segment labels, the placeholders, «Toda España», «Cualquier marca», «Cualquier
  precio», «Radio», «Marcas», «Modelos», «Modelo de {brand}…», «{count} resultados», the price
  shortcuts and the summary formats.
- New `mapStates.*`: the empty copy (with and without filters, «Toda España» included), the error
  and loading copy and the status pills.
- New `createAlert.*`: the title, «Nombre», the buttons, the too-broad notice, the empty-name error,
  the network-failure message and the two toasts, «Alerta creada» and «Ya tienes esta alerta».
- The grouped preview reuses the pin's group label (`map.pinGroup`); it has no key of its own.
- Units take a non-breaking space (U+00A0) before them in the new strings: «50 km», «24 h».
- The map's error-page line, the «Kilómetros, hasta» and «Año, desde» labels, the two no-match
  messages and the place-search-down message (`search.placeSearchDown`, MAPUI-56) and the handle's
  «Lista de resultados» are new keys too.
- `filters.*` keeps the five fuels, «Todos / Manual / Automático» and the four «Publicado» choices,
  and drops the removed ones once unused.
- `map.addFavorite` / `map.removeFavorite` become «Guardar» / «Quitar de guardados» ("Save" / "Remove
  from saved").
- English copy is drafted with the implementation and reviewed in the pull request. The design gives
  Spanish only.

**Criteria in other specs this phase changes.** Each is amended in the same change, with its statement
kept and marked:

- **`map-and-search.md` (MAP).**
  - Amended:
    - MAP-15, by MAPUI-25 and MAPUI-31;
    - MAP-20, by MAPUI-3: the combobox moves into «Dónde» and the phone sheet;
    - MAP-25, whose "opening the mobile map fits it" becomes the results sheet over a map that is
      always on screen.
  - The contract text naming the proxy routes and the decision "Filters debounce, the search button
    does not" are rewritten to the pill.
  - Kept: every other MAP criterion.
- **`core-frontend.md` (FRONT).**
  - FRONT-13 (MAPUI-18, MAPUI-49): the worked-example URL still parses.
  - FRONT-14 (MAPUI-30 to MAPUI-32).
  - FRONT-15, whose create-alert outcomes are toasts (MAPUI-42, MAPUI-43); failures stay inline.
  - FRONT-11 (MAPUI-57): `lib/format.ts`'s formatters are `formatPrice` (with a thousands point,
    built on `formatAmount`, which the amount boxes also use), `formatMileage` and
    `formatRelativeTime`; `formatNumber` is removed, and there is no second price formatter.
- **`favorites.md` (FAV).**
  - Amended:
    - FAV-12, by MAPUI-37;
    - FAV-17, whose note "the phone map gets one in F3" is fulfilled by the tab bar (MAPUI-52).
  - Kept: FAV-9 to FAV-11 and FAV-13 on the new card.
- **`alerts.md` (ALERT).** ALERT-1 gains its end-to-end test (MAPUI-47). ALERT-7 is amended by
  MAPUI-43, and ALERT-26 gains the note that saving the same search again reactivates the alert.
- **`redesign-foundation.md` (LOOK).** LOOK-11 and LOOK-13 move from the deleted select trigger to the
  checkbox select's trigger on `/palette`.
- **`core-layout.md`.** The decision that moved `isSpecificEnough` to `service.ts` is amended: it stays
  in `schema.ts` (Specificity, above).
- **`redesign-navigation.md` (HEAD).**
  - HEAD-1 and HEAD-2 gain the pill and «Crear alerta» in the map header's centre, and HEAD-16 now
    binds with them in place.
  - HEAD-7 loses the avatar on the phone pages' headers (MAPUI-54).
  - HEAD-8 becomes the tab bar: the map gains it, and so does «Cuenta», signed out on the map too
    (MAPUI-52).
  - HEAD-17's 24px float becomes a full-width bar padded by the safe area (MAPUI-52).
  - HEAD-18 and HEAD-19 keep binding: content scrolls clear of the bar.
- **`navbar.md`.** The note that the search lives in `ListingsHeader` until F3 is closed.
- **Docs.**
  - `docs/ARCHITECTURE.md` › Frontend (map components, UI primitives, the jsdom Radix stubs) and the
    README ownership map follow the new files.
  - `docs/design/roadmap.md` marks F3.

## Decisions and rationale

**Desktop applies at once, the phone applies on «Ver coches» (owner decisions, 2026-10-12).**

On desktop the popovers are small and the map and list stay visible beside them, so each choice shows
its effect immediately. That is what makes a popover worth having instead of a form. The pause MAP-11
already sets keeps a burst of clicks to one search. The quick filters skip the MAP-11 pause: one press
is one search (MAPUI-63, 2026-10-17).

On a phone the sheets cover the results, so applying every tap would run searches nobody can see.
«Ver coches» is the moment the buyer looks again. Closing therefore discards: a sheet that half-applied
on close would leave the summary and the results disagreeing with what the buyer last saw.

**Brands first, models of at most three brands (owner decision).** No list of every model of every
brand exists: models come live from Wallapop and coches.net, one brand at a time. The type-ahead
matches the fixed brand list locally and fetches models only once the text narrows to three brands or
fewer. «Toy» shows Toyota's models as drawn, with at most three model requests per query, under the
120-per-minute limit. The cost is that «Corolla» typed alone finds nothing, so a buyer starts from the
brand. A hand-kept catalogue would remove that cost but drift from what the sources accept.

**Models by name.** The two sources' model lists overlap and use different ids: Wallapop's id is the
name, coches.net's is a number. Storing the name lets one value drive both sources. coches.net
resolves the name, the merge's model post-filter compares names, and a number would match nothing in
that post-filter.

**Removed controls, kept parameters.** Horsepower, minimum mileage, maximum year, semi-automatic and
CNG leave the UI, and so does free text, which the landing stopped producing in F4 (ENTRY-6). The URL keeps understanding all of them.
Old shared links and the current landing keep working instead of silently widening, and nothing a
saved alert or a bookmark relies on breaks. Not showing them as chips is the cost: they would need
copy and a design for criteria the product no longer offers.

**Hybrids grouped, gearbox single.** A buyer asks for "a hybrid", not for the plug-in distinction that
two of the three sources fold anyway. The gearbox becomes one choice because coches.net and
Milanuncios read only the first value, so «Manual + Automático» behaved differently per source. There
are only two kinds, so both together mean any gearbox, and an old link carrying both sends no
criterion (owner decision, 2026-10-13).

**Alerts do not save «Publicado».** An alert already looks only for cars new since it last ran. A
saved «Último mes» would make every poll ask Wallapop for a month of listings. Nor does it save the
`?q=` text (owner decision, 2026-10-13): the map no longer shows it (MAPUI-18), so the alert would
carry a criterion the buyer cannot see.

**Telling "already existed" apart (owner decision: "say so").** The upsert hides it today. The service
derives `created` inside the same transaction as the write, from the row it finds there, and never
from a separate query before it. At Postgres' default isolation that narrows the window without
closing it: what parallel saves cannot break is the unique keys, one criteria row per hash and one
alert per user and criteria set, so nothing is stored twice. Two parallel saves of the same criteria
by one user may both answer `created: true`.

**No unsaved-changes warning on «Crear alerta» (owner decision, 2026-10-13: «Me parece bien»).**
`RULES.md` §19 asks for a warning before navigating away from unsaved changes. The dialog is the
exception: its only field is a short name, prefilled from the search (MAPUI-40), so leaving it loses
at most a few typed characters, and a confirmation on every dismissal would cost more than it saves.

**Saving again brings a paused or deleted alert back (owner decision, 2026-10-13).** Saving the same
search again is the buyer asking for that alert, so a paused one is reactivated and a deleted one
restored, each with the new name, and both read «Alerta creada». A live one is already there: it reads
«Ya tienes esta alerta», and the limit does not refuse it, since nothing new is stored.

**Fuel filtered after the merge (owner decision, 2026-10-13).** A buyer who asks for diesel should see
only diesel, and a listing whose fuel is missing or not recognised cannot be confirmed as diesel, so
the merge drops it, as it does for the radius and the model. With no fuel criterion nothing is
dropped, and an unknown fuel is left off the card rather than shown raw. Alerts poll through the same
post-filter, so an alert with a fuel criterion drops an unknown fuel as well (owner decision,
2026-10-13: «es lógico que funcione así»). A criterion carrying a value no group offers, such as an
old link's `engine=gasoil,cng`, cannot be checked here, so it applies no fuel post-filter and the
sources' own filter stands (owner decision, 2026-10-13: «okey»).

**One price format (owner decision, 2026-10-13).** Spanish number formatting (`Intl.NumberFormat`
with `es`) leaves four-digit amounts without a separator. Every price takes the thousands point,
«9.500 €» as well as «14.500 €», in every place it shows.

**Grouping without a library (owner decision).** Grouping exact points is a few lines of pure code
and covers the real problem: city-level coordinates from coches.net and Milanuncios stacking cars on
one spot. It is not distance clustering at low zoom, which the design does not draw. Five decimals is
about a metre: approximations collapse, distinct cars do not.

**The heart leaves the link.** Today the heart is a button inside the card's link, which is invalid
nesting and announces two controls as one. The design makes the whole card the link with the heart
beside it.

**The callbackUrl keeps the query (bug fix).** Sending back only `/map` threw away the search the buyer
was saving from.

**Values not drawn in the design, proposed in this draft for the owner to confirm:**
- the price range's 0–30.000 € scale with its 500 € step;
- the radius group disabled without a place;
- «Toda España» as the phone summary with no place;
- the no-place empty-state copy;
- «Ya tienes esta alerta» (confirmed 2026-10-13);
- «Ponle un nombre a la alerta.»;
- a model choice closing the popover while a brand choice keeps it open.

Every new string is added to the design before the code, per the design-first rule.

**A tab bar on every signed-in phone screen, the map included (owner decision, 2026-10-13).** The
first F3 design left the phone map with no way to the other sections. The owner chose, from three
drawn options, an Airbnb-style bar:

- **The shape.** Full width with icon and label rather than a floating icon pill. Labels need no
  guessing, and the bar reads as the app's own navigation.
- **Hiding.** It hides when the results sheet is full or a page scrolls down, so it never costs list
  space.
- **One bar everywhere.** It replaces the F2 floating bottom nav on the other pages too, so a phone
  never shows two navigations. «Cuenta» moves into it, which is why the phone headers drop the
  avatar.

The current tab is bolder, with a violet icon, so the state is not carried by colour alone
(amended 2026-10-15: its label takes the text colour, redesign-saved.md › Decisions).

**The results heading counts (owner decision).** «Cerca de Madrid» repeated what the search already
says. A count tells the buyer what they have. The sources page their results and give no total, so
the heading says «Más de N» until they run out.

**Postal codes.** «Ciudad o código postal…» promises postal codes. During implementation, one manual
Nominatim query confirms that `countrycodes=es` answers «28013» with Madrid. If it does not, the
placeholder changes in the design first.
