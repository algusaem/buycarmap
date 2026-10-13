# Redesign F3 — map and search

Key: MAPUI
Status: Approved
Last updated: 2026-10-13

---

## Problem

The approved BuyCarMap 2.0 design (`docs/design/`, F3 additions approved 2026-10-12) rebuilds the map
screen, and today's screen contradicts it almost everywhere a buyer touches it.

- **The search.** Today it is a free-text box plus a panel of fifteen controls behind one toggle. The
  design asks three questions in a search pill in the header: where, which car and how much. The
  remaining filters live in one panel, and a row of chips shows what is applied.
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
- **Phone search:** the floating search, the search sheet, and the full-screen filters.
- **The map:** price pins and grouping, the preview card, zoom, and the phone results sheet.
- **States:** loading, empty and error, and the route's own loading and error files.
- **The shared car card:** the card used on the map, on saved cars and on alert matches.
- **Crear alerta:** saving the current search as an alert.
- **The phone tab bar:** on the map and on the signed-in pages, replacing the F2 bottom nav, with the phone headers losing the avatar.
- **Removing the Radix select.**

## Acceptance criteria

Search pill and its popovers (desktop)

- [ ] MAPUI-1 · component — At desktop width the map header's centre shows the search pill: segments
  «Dónde», «Coche» and «Precio», each with its value as in the worked examples, then the «Buscar»
  button. «Crear alerta» follows the pill.
- [ ] MAPUI-2 · component — Pressing a segment opens its popover and sets that segment's
  `aria-expanded` to true. At most one popover is open. Pressing outside it or Escape closes it;
  Escape returns focus to the segment.
- [ ] MAPUI-3 · component — In «Dónde», typing two or more characters lists the places Nominatim
  returns, each with its region on a second line when it has one, and announces «N resultados» in a
  polite status. Choosing one applies that place with the radius in force (50 km by default) (amends
  MAP-20).
- [ ] MAPUI-4 · component — «Dónde» offers the radii 10, 25, 50, 100 and 200 km as a single-choice
  group. Choosing one applies it. The group is disabled while no place is chosen (keeps MAP-13).
- [ ] MAPUI-5 · component — «Toda España» clears the place. The search becomes the national one, and
  the results heading counts the national results (MAPUI-33).
- [ ] MAPUI-6 · component — In «Coche», typing lists under «Marcas» every brand whose name, or a word
  of it, starts with the text, ignoring case and accents. When one to three brands match, their
  models are listed under «Modelos» as «Marca Modelo», without duplicates. When more than three
  match, only brands are listed.
- [ ] MAPUI-7 · component — Choosing a brand applies it and clears the model (keeps MAP-12). It also
  shows the brand as a removable chip, and turns the field into «Modelo de <marca>…», which lists only
  that brand's models. The popover stays open.
- [ ] MAPUI-8 · component — Choosing a model, from either list, applies the brand and the model and
  closes the popover. The segment then reads «Marca Modelo», and on reopening, that model carries the
  chosen mark.
- [ ] MAPUI-9 · component — Removing the brand chip, or pressing «Cualquier marca», clears the brand
  and the model.
- [ ] MAPUI-10 · component — When loading a brand's models fails, «Coche» still lists the matching
  brands and offers no «Modelos» group, and no error is shown.
- [ ] MAPUI-11 · component — «Precio» offers:
  - a two-knob range from 0 to 30.000 € in steps of 500 €, where the right knob at the end means no
    maximum;
  - the «Mínimo» and «Máximo» boxes, which accept any amount;
  - the shortcuts «Hasta 5.000 €», «Hasta 10.000 €», «Hasta 20.000 €» and «Hasta 30.000 €», which set
    the maximum and clear the minimum;
  - «Cualquier precio», which clears both.

  A typed minimum above the maximum is swapped with it when the box loses focus.
- [ ] MAPUI-12 · component — On desktop nothing asks for confirmation. Every change in a popover or in
  the filters panel updates the URL and re-searches after the pause MAP-11 sets, and «Buscar»
  re-searches at once and closes any open popover (keeps MAP-11).

Filters row and panel

- [ ] MAPUI-13 · component — Under the search the filters row shows:
  - «Filtros», with a badge counting the active chips;
  - one chip per active panel criterion, with the texts of the worked examples.

  Removing a chip removes that criterion and re-searches. With no criterion active, the row shows
  «Filtros» with no badge.
- [ ] MAPUI-14 · component — The filters panel has exactly the sections Precio, Combustible, Cambio,
  Kilómetros y año («Hasta … km» and «Desde …» year), Publicado, and Marca y modelo (the «Coche»
  type-ahead), in that order. It has no horsepower, free text, minimum mileage, maximum year or sort
  control.
- [ ] MAPUI-15 · unit — The fuel choices map onto the shared filter values:
  - «Gasolina» → `gasoline`;
  - «Diésel» → `gasoil`;
  - «Híbrido» → `hybride` and `hybride_plugin` together;
  - «Eléctrico» → `electric-hybrid`;
  - «GLP» → `lpg`.

  «Híbrido» reads as chosen when either hybrid value is present.
- [ ] MAPUI-16 · component — «Cambio» is a single choice of «Todos», «Manual» and «Automático».
  «Todos» means no gearbox criterion, and it is shown unless exactly one of `manual` and `automatic` is
  set. Choosing replaces the whole gearbox criterion.
- [ ] MAPUI-17 · component — «Publicado» is a single choice:
  - «Cualquier momento» → no `timeFilter`;
  - «Últimas 24 h» → `today`;
  - «Última semana» → `lastWeek`;
  - «Último mes» → `lastMonth`.
- [ ] MAPUI-18 · unit — A URL carrying a criterion the UI no longer offers still parses and still
  reaches the search, with no control or chip for it. Those criteria are `minKm`, `maxYear`,
  `minHorsePower`, `maxHorsePower`, `gearbox=semiautomatic`, `engine=cng` and the `?q=` text. «Borrar»
  and «Quitar filtros» clear them (amends FRONT-13).
- [ ] MAPUI-19 · component — On desktop the filters panel is a dropdown under «Filtros» with no close
  button:
  - every choice applies at once;
  - «Ver coches» only closes it, as do pressing outside and Escape;
  - «Borrar» clears every panel criterion at once.

Phone

- [ ] MAPUI-20 · component — At phone width the map shows, floating over it, two rows:
  - the search summary: «Madrid · 50 km» over «Cualquier marca · hasta 20.000 €», or «Toda España»
    with no place;
  - beside it, the violet filters button, then the filters row.

  It shows no zoom control and no app header (keeps HEAD-7), and the tab bar of MAPUI-52 runs along
  the bottom.
- [ ] MAPUI-21 · component — Tapping the summary opens the «BUSCAR» sheet with «Dónde», «Coche» and
  «Precio»:
  - nothing chosen there reaches the URL, the summary or the search until «Ver coches», which applies
    it all and closes the sheet;
  - closing the sheet discards it;
  - «Borrar» empties the sheet's fields, applied only on «Ver coches».
- [ ] MAPUI-22 · component — The violet button opens the full-screen filters panel, with the same
  sections as MAPUI-14 and the apply, discard and «Borrar» behaviour of MAPUI-21. Removing a chip
  from the filters row applies at once.
- [ ] MAPUI-23 · component — On a phone the results live in a sheet over the map with three
  positions:
  - peeked, showing the title only;
  - middle, showing the first card;
  - full, showing the list.

  The sheet sits on top of the tab bar. Its title is the results heading of MAPUI-33, and under it
  sits «Crear alerta» (MAPUI-39). The handle is a button that toggles between full and peeked, with
  `aria-expanded` true only when full.
- [ ] MAPUI-24 · component — At phone width, tapping a pin moves the results sheet to its middle
  position showing that car's card first, or the group's first car for a grouped pin.

Map

- [ ] MAPUI-25 · component — Every listing with coordinates is a pin button showing its price. Listings
  at the same point (coordinates equal to five decimals) share one pin, «N coches · desde <lowest
  price>». The pins account for exactly the listings in the list (amends MAP-15).
- [ ] MAPUI-26 · unit — The grouping of listings into pins is a pure function that produces the worked
  example's groups, labels and order.
- [ ] MAPUI-27 · component — At desktop width, activating a pin with a click, Enter or Space does three
  things:
  - it opens the preview card with the photo, name, city, «año · km · combustible», price,
    «Guardar» and «Ver anuncio» (new tab);
  - it marks the pin active;
  - it outlines that car's card in the list and scrolls it into view.

  A grouped pin's preview lists its cars in order. The preview closes with its button, Escape or a
  press outside, and focus returns to the pin.
- [ ] MAPUI-28 · component — Hovering or focusing a card in the list marks its pin active.
- [ ] MAPUI-29 · component — At desktop width, «Acercar» and «Alejar» change the map zoom by one level,
  and the map shows no other zoom control.

States

- [ ] MAPUI-30 · component — While the first page is loading, the list shows placeholder cards shaped
  like the car card. At desktop width the map also shows «Buscando coches…» in a status pill with
  `role="status"` (amends FRONT-14).
- [ ] MAPUI-31 · component — A search with no results shows:
  - «¿Nada por aquí?» over «Amplía el radio»;
  - the line «Con estos filtros no hay coches en 50 km. Prueba más lejos o quita algún filtro.»;
  - «Ampliar a <next radius> km», which applies the next radius;
  - «Quitar filtros».

  At 200 km or with no place there is no widen button, and the line and the map's status pill name no
  radius. The status pill reads «Ningún coche en 50 km» (amends MAP-15 and FRONT-14; keeps MAP-19).
- [ ] MAPUI-32 · component — A failed search shows:
  - «¿Se ha caído algo?» over «Prueba otra vez»;
  - the line «No hemos podido traer los anuncios. Suele ser cosa de un momento.»;
  - «Reintentar», which repeats the search;
  - on the map, «Sin conexión con los anuncios».

  It keeps MAP-3 and MAP-7.
- [ ] MAPUI-33 · unit + component — The results heading is the desktop list's title and the phone
  sheet's title. It reads:
  - «BUSCANDO COCHES…» while the first page loads;
  - «NINGÚN COCHE» when the search found none;
  - «COCHES» when the search failed;
  - «1 COCHE» or «N COCHES» once the sources are exhausted;
  - «MÁS DE N COCHES» while more pages remain, where N is the number of cars in the list.

  It has no «cerca de…» line in any state, since the search already names the place.
- [ ] MAPUI-34 · component — `/map` has its own `loading.tsx`, which renders the loading state, and its
  own `error.tsx`. The error file renders the page-error state with an action that retries the route.

Car card

- [ ] MAPUI-35 · component — A car card shows:
  - the source badge and the heart over the photo, or over the car's tint with the car icon when it
    has no photo;
  - the name, with the city beside it;
  - «año · km · combustible»;
  - the price.

  The card is one link to the listing in a new tab, and the heart is a separate button outside that
  link.
- [ ] MAPUI-36 · component — The heart's accessible name is «Guardar», or «Quitar de guardados» once
  saved (keeps FAV-9 to FAV-11).
- [ ] MAPUI-37 · component — A signed-out buyer who presses the heart is sent to `/login` with a
  `callbackUrl` of the full current path and query, so the search survives the sign-in (bug fix;
  amends FAV-12).
- [ ] MAPUI-38 · component — `/favorites` and an alert's matches render this same card (keeps FAV-13
  and ALERT-39).

Crear alerta

- [ ] MAPUI-39 · component — «Crear alerta» in the desktop header, and the «Crear alerta» button under
  the phone results sheet's title, open the create-alert dialog. The dialog has the name prefilled,
  the search summary, «Crear alerta» and «Cancelar».
- [ ] MAPUI-40 · unit — The prefilled name and the summary are built from the search as in the worked
  examples. The summary never includes «Publicado».
- [ ] MAPUI-41 · component — For a search with no brand, no maximum price and no place, the summary
  reads «Cualquier marca · Cualquier precio». The dialog then shows «Añade una marca, un precio
  máximo o una zona para crear la alerta.» with `role="alert"`, «Crear alerta» is `aria-disabled`, and
  pressing it sends nothing.
- [ ] MAPUI-42 · component — «Crear alerta» calls `createAlert` with the current criteria, without
  `timeFilter`, and the trimmed name. On success the dialog closes and the toast «Alerta creada»
  offers «Ver alertas», which links to `/alerts`.
- [ ] MAPUI-43 · node + component — Saving criteria the user already has as a live alert succeeds and
  reports that it already existed. The dialog closes with the toast «Ya tenías esta alerta» and «Ver
  alertas» (amends ALERT-7).
- [ ] MAPUI-44 · component — An empty name, once trimmed, shows «Ponle un nombre a la alerta.» under
  the field and sends nothing.
- [ ] MAPUI-45 · component — A refused create keeps the dialog open and shows that code's message
  inline. The codes are `tooManyAlerts`, `criteriaTooBroad`, `invalidCriteria` and `unauthenticated`,
  and their messages are the `alertErrors.*` copy.
- [ ] MAPUI-46 · component — Signed out, «Crear alerta» goes to `/login` with a `callbackUrl` of the
  full current map path and query, and nothing is created after signing in (keeps ALERT-4).
- [ ] MAPUI-47 · e2e — Signed in, creating an alert from `/map?make=Toyota&maxPrice=20000` adds it to
  `/alerts` (database run; covers ALERT-1 end to end).

Radix select

- [ ] MAPUI-48 · node — No module imports `components/ui/select.tsx` or `@radix-ui/react-select`, the
  file does not exist, and `package.json` does not list the package.

Flows

- [ ] MAPUI-49 · e2e — At desktop width, choosing a place, a brand and a maximum price writes each to
  the URL and shows results. Going Back restores the previous criteria (amends FRONT-13).
- [ ] MAPUI-50 · e2e — At phone width, choosing in the «BUSCAR» sheet and pressing «Ver coches» writes
  the criteria to the URL. Choosing and then closing the sheet leaves the URL as it was.
- [ ] MAPUI-51 · e2e — At phone width every map control has a hit area of at least 44 × 44px: the
  summary, the filters button, the chips' remove buttons, the sheet handle, the pins and the tabs
  (extends HEAD-15).

Phone tab bar

- [ ] MAPUI-52 · component — At phone width, the map, `/favorites`, `/alerts`, `/alerts/[id]` and
  `/account` show a full-width tab bar at the bottom, padded by the safe area:
  - signed in, four tabs: «Mapa», «Guardados», «Alertas» and «Cuenta»;
  - each tab is an icon over its label, and «Cuenta» shows the avatar's initial;
  - the current tab is marked with `aria-current="page"`, in violet and with a bolder label;
  - on `/alerts/[id]` the current tab is «Alertas»;
  - signed out, on the map, two tabs: «Mapa» and «Entrar» (`/login`).

  The bar replaces the floating bottom nav, and it is absent at desktop width and on every other page
  (amends HEAD-8 and HEAD-17).
- [ ] MAPUI-53 · component — The tab bar hides while the map's results sheet is full, and while a
  page is being scrolled down. It comes back when the sheet leaves full, and on scrolling up.
- [ ] MAPUI-54 · component — At phone width, the headers of `/favorites`, `/alerts`, `/alerts/[id]`
  and `/account` show the wordmark and the language control and no avatar, because «Cuenta» is in
  the tab bar (amends HEAD-7). The alert page's own «Volver» is built with that page in F6.

## Worked examples

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

**Chip texts (MAPUI-13).**
- `engine=gasoil`: one chip, «Diésel». `engine=gasoline,gasoil`: two chips, «Gasolina» and «Diésel».
- `engine=hybride,hybride_plugin`: one chip, «Híbrido».
- `gearbox=automatic`: «Automático».
- `maxPrice=20000`: «Hasta 20.000 €».
- `maxKm=100000`: «Hasta 100.000 km». `minYear=2017`: «Desde 2017».
- `timeFilter=today`: «Últimas 24 h».
- `make=Toyota&model=Corolla`: «Toyota Corolla».

So `engine=gasoil&maxPrice=20000&gearbox=automatic&timeFilter=today` gives the badge 4 and the chips
«Diésel», «Hasta 20.000 €», «Automático» and «Últimas 24 h».

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

**Results heading (MAPUI-33).**

| State | Heading |
| --- | --- |
| first page loading | «BUSCANDO COCHES…» |
| failed | «COCHES» |
| sources exhausted, no cars | «NINGÚN COCHE» |
| exhausted with 1 car | «1 COCHE» |
| exhausted with 24 cars | «24 COCHES» |
| 40 cars listed, more pages left | «MÁS DE 40 COCHES» |
| 40 listed, load-more running | «MÁS DE 40 COCHES» (unchanged until the page lands) |

**Empty state widening (MAPUI-31).** 10 → «Ampliar a 25 km», 25 → «Ampliar a 50 km», 50 → «Ampliar a
100 km», 100 → «Ampliar a 200 km», 200 → no button. With no place: «Ningún coche con estos filtros»
on the map, and the line «Con estos filtros no hay coches. Prueba a quitar algún filtro.»

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

## Data model

None. Alerts keep their `AlertCriteria.criteria` JSON and `Alert.label`. The create path only learns
to tell a new alert from an existing one (Contracts). This reads `Alert`, `AlertCriteria` and
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
  - The old multi-choice gearbox, e.g. `gearbox=manual,automatic`, reads as «Todos» (MAPUI-16).
  - `engine=hybride_plugin` alone reads «Híbrido» chosen. Unchoosing it removes both hybrid values
    (MAPUI-15).
- **No place.**
  - National search, the counted heading, radius disabled (MAPUI-4, MAPUI-5, MAPUI-33).
  - The empty state has no widen button (MAPUI-31). Wallapop still gets the centre of Spain (SRC-8,
    kept).
- **Results.**
  - A filtered page can come back empty while more pages remain. The search keeps fetching (MAP-19,
    kept), and the empty state shows only once the sources are exhausted.
  - A listing without coordinates is in the list but has no pin. Today every source gives every
    listing a point (SRC-3, kept), so this is a guard, not a case the design draws.
- **Phone.**
  - A discarded sheet leaves the search, the URL and the summary untouched (MAPUI-21, MAPUI-50).
- **Crear alerta.**
  - A too-broad search: the button is disabled, and the server refuses anyway (MAPUI-41, ALERT-38).
  - An empty name (MAPUI-44).
  - Twenty alerts already (MAPUI-45).
  - Already saved (MAPUI-43).
  - Signed out (MAPUI-46).
  - A session that ends while the dialog is open gets `unauthenticated` inline (MAPUI-45).

## Out of scope

- The landing's search (F4). Until F4 the landing still sends free text as `?q=`, which the map keeps
  using without showing it (MAPUI-18).
- The saved-cars and alerts pages' own layouts (F5, F6). This phase changes only the card they render
  (MAPUI-38), their phone header and their tab bar (MAPUI-52 to MAPUI-54). The phone car sheet on
  saved cars and the phone alert page are designed (`F5-guardados-coche`, `F6-alerta`,
  `F6-alerta-estados`) but are built in F5 and F6.
- Using the browser's location to centre the first search (issue #117).
- Recency on coches.net and Milanuncios. «Publicado» reaches Wallapop only, as `timeFilter` does today
  (`docs/specs/data-sources.md`).
- A photo carousel on the card (its own issue).
- Deduplicating the same car across sources (`docs/specs/data-sources.md`).
- Showing the place name on `/alerts`. The stored criteria hold coordinates, not a name.

## Contracts

**`createAlert`** (`server/alerts/actions.ts`) keeps its signature `createAlert(criteria, label)`. Its
success result becomes `{ ok: true, created: boolean }`:

- `created: false` when the caller already had a live alert with the same criteria hash;
- `created: true` for a new alert, including one restored from a soft-deleted row.

The error codes are unchanged: `unauthenticated`, `invalidCriteria`, `criteriaTooBroad`,
`tooManyAlerts`.

**Brand list.** The type-ahead's brands are the existing 35-brand list
(`components/map/search-filter-options.ts`). Models come from `listCarModels(make)`, one call per
matching brand, at most three per query. They are cached per brand in the page's hook for the
session, and deduplicated by name ignoring case. The model is stored and sent by name, which
coches.net resolves through its existing name lookup (SRC-7, kept).

**Location.** `searchLocations` (`lib/geo/nominatim.ts`) stays browser-side (FRONT-7). The second
line is the display name after its first comma, without a trailing «España».

**Dependencies.**
- Added, approved by the owner on 2026-10-12 and recorded in the dependency ADR:
  - `@radix-ui/react-popover`, for the desktop popovers, the filters dropdown, «Crear alerta» and the
    preview card;
  - `@radix-ui/react-dialog`, for the phone sheets, with focus trapped and returned;
  - `@radix-ui/react-slider`, for the price range.
- Removed: `@radix-ui/react-select`.

**i18n keys**, both locales, `lib/i18n/types.ts`:
- New `search.*`: the segment labels, the placeholders, «Toda España», «Cualquier marca», «Cualquier
  precio», «Radio», «Marcas», «Modelos», «Modelo de {brand}…», «{count} resultados», the price
  shortcuts and the summary formats.
- New `mapStates.*`: the empty, error and loading copy and the status pills.
- New `createAlert.*`: the title, «Nombre», the buttons, the too-broad notice, the empty-name error and
  the two toasts.
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
- **`favorites.md` (FAV).**
  - Amended:
    - FAV-12, by MAPUI-37;
    - FAV-17, whose note "the phone map gets one in F3" is fulfilled by the tab bar (MAPUI-52).
  - Kept: FAV-9 to FAV-11 and FAV-13 on the new card.
- **`alerts.md` (ALERT).** ALERT-1 gains its end-to-end test (MAPUI-47), and ALERT-7 is amended by
  MAPUI-43.
- **`redesign-foundation.md` (LOOK).** LOOK-11 and LOOK-13 move from the deleted select trigger to the
  checkbox select's trigger on `/palette`.
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
already sets keeps a burst of clicks to one search.

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
CNG leave the UI, and so does free text, which goes until F4. The URL keeps understanding all of them.
Old shared links and the current landing keep working instead of silently widening, and nothing a
saved alert or a bookmark relies on breaks. Not showing them as chips is the cost: they would need
copy and a design for criteria the product no longer offers.

**Hybrids grouped, gearbox single.** A buyer asks for "a hybrid", not for the plug-in distinction that
two of the three sources fold anyway. The gearbox becomes one choice because coches.net and
Milanuncios read only the first value, so «Manual + Automático» behaved differently per source.

**Alerts do not save «Publicado».** An alert already looks only for cars new since it last ran. A
saved «Último mes» would make every poll ask Wallapop for a month of listings.

**Telling "already existed" apart (owner decision: "say so").** The upsert hides it today. The service
learns it inside the same transaction rather than through a second query outside it, so the answer
cannot race a parallel create.

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
- «Ya tenías esta alerta»;
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

The current tab is bolder as well as violet, so the state is not carried by colour alone.

**The results heading counts (owner decision).** «Cerca de Madrid» repeated what the search already
says. A count tells the buyer what they have. The sources page their results and give no total, so
the heading says «Más de N» until they run out.

**Postal codes.** «Ciudad o código postal…» promises postal codes. During implementation, one manual
Nominatim query confirms that `countrycodes=es` answers «28013» with Madrid. If it does not, the
placeholder changes in the design first.
