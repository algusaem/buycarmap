# Surface brief: /map

The map and search screen of BuyCarMap 2.0. Behaviour is specified in
[`docs/specs/redesign-map.md`](../../docs/specs/redesign-map.md) (MAPUI); the visual source of truth is
the design in [`docs/design/`](../../docs/design/README.md) (boards `R3-mapa-detalle`, `F3-buscador-*`,
`F3-mapa-filtros`, `F3-mapa-crear-alerta`, `F3-crear-alerta-estados`, the `F0-estado-*` states and the
UI Kit). Where this brief and the design disagree, the design wins and this brief is corrected.

## 1. Job and audience

- A private buyer in Spain looking for a second-hand car for themselves, mostly on a phone, often
  with other portals open in other tabs (`PRODUCT.md` › Users, Operating Context).
- They arrive from the landing or a shared link, signed out more often than not, and want to see
  cars near them within seconds, with no sign-up.
- Visitor mode: scanning and comparing — price, year, mileage, fuel and where the car is — then
  opening the listing on its portal.

## 2. Outcome and proof

- Primary task: narrow the search to a place, a car and a price, and see the matching cars on the
  list and the map at once.
- Success: the buyer finds a car worth opening and opens «Ver anuncio», saves it («Guardar»), or turns
  the search into an alert («Crear alerta»).
- Evidence on screen is only what the sources give: photo, name, city, year, mileage, fuel and price.
  No invented figures, no total count (the heading says «MÁS DE N COCHES» until the sources run out),
  no fuel shown when it is not recognised.
- Product-specific truth: three marketplaces in one map and one search, each source a plain dark badge
  with its name, never its brand colour.

## 3. Selected direction

- Visual authority: the approved BuyCarMap 2.0 world, "one light in the night" (`DESIGN.md`): near-black
  `bg` and `surface`, lime for what the buyer is doing or looking at now, violet for what is theirs
  and for chosen states, Unbounded uppercase for headings, counts and prices, Rethink Sans for the rest.
- Structural thesis: the map is the product. Desktop opens on a two-row `surface` band — in its first
  row's centre the «Dónde · Coche · Precio» search pill with «Crear alerta» beside it, then «Filtros» and
  the quick filters — and under it the list and the map in two halves, the map a rounded card; the cards
  in two columns, three from 1920px. The phone keeps the map on screen under a solid band with the search
  summary, the round «Filtros» and the quick filters, and the results in a three-position sheet over the
  tab bar.
- Focal moment: a price pin and its card lighting up together in lime — hovering a card, or opening a
  pin's preview, marks the other.

## 4. Scope and boundaries

- In scope: the header band with the search pill and its popovers, «Filtros», the quick filters and the
  panel, the phone's top band, search sheet and full-screen filters, price pins and grouping, the preview
  card, zoom, the results sheet, the loading, empty and error states, the shared car card, «Crear alerta»
  and the phone tab bar.
- Untouched here: the landing's search ([`landing.md`](landing.md)), the saved-cars and alerts page layouts (F5, F6), emails.
- Anti-goals: no sort control; no distance clustering; no photo carousel; no search-as-I-move-the-map; no
  navigation menu sheet or hamburger.

## 5. States and ranges

- Results: from none to many pages; the first page can come back empty while more remain, and the
  search keeps fetching. Placeholder cards mirror the car card while loading.
- Empty: «¿Nada por aquí?». With a filter active: over «Amplía el radio» with «Ampliar a … km» and
  «Quitar filtros», or, at 200 km or with no place, over «Quita algún filtro» with «Quitar filtros»,
  which keeps the place and the radius. With no filter: over «Amplía el radio» with «Ampliar a … km»,
  and at 200 km «Toda España».
- Error: «¿Se ha caído algo?» with «Reintentar» inline; the route's own error page reads «Error al
  cargar el mapa. Vuelve a intentarlo más tarde.» with «Reintentar».
- Pins: one price per point; cars sharing a point (city-level coordinates from coches.net and
  Milanuncios) collapse to «N coches · desde <precio>». Every price has a thousands point, «9.500 €».
- Car card: names and cities from short to very long, with or without a photo (a per-car tint and the
  car icon), with or without a recognised fuel («año · km» without it).
- Type-ahead: brand and place matches, and no match («No existe ninguna marca con ese nombre»,
  «No existe ningún lugar con ese nombre»).
- Crear alerta: prefilled, too broad (disabled with the notice), empty name, refused codes inline,
  signed out (to sign-in and back to the same search), and the outcomes «Alerta creada» and «Ya tienes
  esta alerta».

## 6. Interaction and layout

- Desktop applies at once: every popover and panel choice updates the URL and re-searches after the
  short pause; «Buscar» searches immediately. The quick filters apply at once at every width, with no
  pause and no «Ver coches». The phone's search sheet and full-screen filters apply on «Ver coches»;
  closing one discards it.
- Popovers and the filters dropdown anchor under their trigger, one open at a time, closing on a press
  outside or Escape with focus returned. The preview is anchored to its pin and moves with the map;
  it takes focus on open, and opening «Crear alerta» closes it.
- The phone results sheet: peeked, middle, full. Each press of the handle «Lista de resultados»
  moves it one position up (peeked → middle → full, then back to peeked). It also drags from the
  handle strip and the heading, never from the list, and settles on the nearest position, or one
  position on a fast flick. At middle, tapping or panning the map lowers it to peeked; a pin does
  not. The tab bar hides only while the sheet is full.
- Everything that appears or disappears animates with Motion, honouring reduced motion.

## 7. Constraints and open decisions

- WCAG 2.2 AA, full keyboard support and screen reader support; state never by colour alone (chips change
  weight and fill, the active pin gains its halo); hit areas of at least 44 × 44px on a phone; inputs at 16px.
- All copy through next-intl keys; Spanish is the default locale and the design gives Spanish only.
- Reuse the design system's components (`docs/design/system/components/`) and theme tokens from
  `app/globals.css`; no new colour, token or pattern without approval.
- Not for the builder to invent: any copy, value or state the design and the spec do not give.
