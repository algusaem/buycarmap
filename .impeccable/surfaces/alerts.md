# Surface brief: /alerts and /alerts/[id]

The alerts pages of BuyCarMap 2.0, «Alertas» and an alert's own page. Behaviour is specified in
[`docs/specs/redesign-alerts.md`](../../docs/specs/redesign-alerts.md) (ALERTUI); the visual source of
truth is the design in [`docs/design/`](../../docs/design/README.md) (boards `R3-alertas`,
`F6-alerta`, `F6-alerta-estados`, `F6-alertas-escritorio`, `F6-alerta-escritorio`,
`F6-alerta-mas-estados`, `F0-estado-alertas-vacio`, `F0-estado-error-pagina` and the UI Kit). Where
this brief and the design disagree, the design wins and this brief is corrected.

## 1. Job and audience

- A private buyer in Spain, signed in, checking what their saved searches have found, on a phone as
  often as on a laptop (`PRODUCT.md` › Users).
- Operator mode: the alerts are theirs. They look over a handful of saved searches (twenty at most),
  open the one that found something, scan its matches and the zone it watches, and drop the searches
  they no longer want.

## 2. Outcome and proof

- Primary task: see what an alert has found and open the match worth a call («Ver anuncio»), or save
  it to Guardados.
- Success: the listing opens on its portal, a match is saved or removed, or an alert the buyer no
  longer wants is gone after they confirm.
- Evidence on screen is the alert's criteria as the buyer set them («Toyota Corolla · Híbrido · Hasta
  18.000 € · Madrid · 50 km»), its zone on the map, its match count, the date it was created and each
  match's snapshot as found. No refreshed price, no availability, no «new» marker.

## 3. Selected direction

- Visual authority: the approved BuyCarMap 2.0 world, "one light in the night" (`DESIGN.md`), as on
  `/map` and `/favorites`: near-black `bg` and `surface`, lime for prices, the open card's border and
  the zone, violet for what is the buyer's (the saved heart), Unbounded uppercase for «ALERTAS», the
  alert names and prices.
- Structural thesis: the list beside its map. Desktop keeps `/favorites`' list column (546px from
  1024px, 830px from 1280px) with the alert map filling the rest; only the list column scrolls. One
  alert is open at a time, the others fold to one line. The phone lists the alerts as links to their
  page, which shows the zone as a small static map over compact rows.
- Focal moment: opening an alert and seeing its zone settle on the map with its pins, the pill naming
  it.

## 4. Scope and boundaries

- In scope: the heading, «Nueva alerta» and the line, the AlertCard (open, folded and phone), the
  alert match card, the alert map with its zone, pill, pins and preview, which alert is open in the
  URL, the alert page at both widths with its virtualised matches, the phone zone map, the car sheet,
  the delete confirmation, the toast's place, and the loading, empty and error states.
- Untouched here: `/map` beyond sending the place name with «Crear alerta», `/favorites` beyond the
  shared card, row and sheet toggling the saved state, the alert emails (#123), new-match markers
  (#122).
- Anti-goals: no editing an alert, no resume button for a paused one, no undo after a delete (it is
  confirmed first), no toast after a successful delete, no sort, filter or pagination, no draggable
  map on the phone.

## 5. States and ranges

- Alerts: none, one, a few, twenty; names short to very long; active or paused («En pausa»); with a
  place and a place name, with a place and no name (created before F6: the radius alone), or with no
  place (no zone, the pill names the alert alone); criteria that no longer parse (no criteria line).
- Matches: none («Sin coincidencias», «Te avisaremos en cuanto salga un coche que encaje.»), one to
  four (all on the open card), more than four («Ver las N coincidencias»), two hundred or more on the
  alert's page; with or without a photo; already saved or not.
- Pins: one per point; matches at one point share «N coches · desde <precio>».
- Delete: confirmed in a dialog (desktop) or a sheet (phone); «Eliminar» busy while it runs; a
  failure closes it, keeps the alert and toasts the error.
- Empty: «¿Sin alertas?» over «Crea una», «Buscar coches», and the map's «Aquí verás la zona de cada
  alerta».
- Loading: the heading, folded-card or row placeholders, the map with only «Cargando…».
- Error: «¿Se ha roto algo?» over «No es culpa tuya», «Reintentar» and «Volver al mapa».

## 6. Interaction and layout

- The open alert lives in the URL (`alert=<id>`, none for the newest), each press a history entry;
  the alert open before stays on screen until the next one has loaded.
- Hovering or focusing a match marks its pin; a pin outlines its cards and opens its preview; on the
  alert's page it scrolls its card into view.
- Back restores the alert page's scroll; Tab walks every match in order to «Eliminar alerta».
- The car sheet and the confirmation sheet slide up over the dimmed screen and close by dragging the
  handle, Escape or a press outside, returning focus to their opener. Motion follows
  `docs/specs/motion.md`: opened or closed with a pointer, the sheets slide over 240ms and the
  dialogs fade over 180ms; with a key or Escape they appear and disappear at once. The alerts list,
  its cards, its empty state, the card rings and the pins never animate.

## 7. Constraints and open decisions

- WCAG 2.2 AA under axe at desktop and phone width; hit areas of at least 44 × 44px on a phone.
- All copy through next-intl keys; Spanish is the default locale and the design gives Spanish only.
- Theme tokens from `app/globals.css` only; the zone's colours are the theme's tokens, read into MapLibre's layers;
  the toast's place is set per page through `data-toast-anchor`.
- Not for the builder to invent: any copy, value or state the design and the spec do not give.
