# Surface brief: /favorites

The saved-cars page of BuyCarMap 2.0, «Guardados». Behaviour is specified in
[`docs/specs/redesign-saved.md`](../../docs/specs/redesign-saved.md) (SAVED); the visual source of truth
is the design in [`docs/design/`](../../docs/design/README.md) (boards `R3-favoritos`,
`F5-guardados-coche`, `F5-guardados-estados`, `F0-estado-guardados-vacio`, `F0-estado-error-pagina` and
the UI Kit). Where this brief and the design disagree, the design wins and this brief is corrected.

## 1. Job and audience

- A private buyer in Spain, signed in, coming back to the cars they picked out on the map, on a phone
  as often as on a laptop (`PRODUCT.md` › Users).
- Operator mode: the list is theirs. They compare a handful to a few hundred cars, sort them, open
  the one worth a call, and drop the ones they no longer want.

## 2. Outcome and proof

- Primary task: find the saved car worth opening — the cheapest, the one with the fewest kilometres,
  the one in the right city — and open «Ver anuncio».
- Success: the listing opens on its portal, or a car the buyer no longer wants leaves the list, with
  «Deshacer» a tap away.
- Evidence on screen is the snapshot taken when the car was saved: photo, name, city, year, mileage
  and price. No refreshed price, no availability, no count beside the heading.

## 3. Selected direction

- Visual authority: the approved BuyCarMap 2.0 world, "one light in the night" (`DESIGN.md`), as on
  `/map`: near-black `bg` and `surface`, lime for prices and what is active, violet for what is the
  buyer's (the saved heart, the pressed sort chip), Unbounded uppercase for «GUARDADOS» and prices.
- Structural thesis: the list beside its map. Desktop keeps `/map`'s list column (546px from 1024px,
  830px from 1280px) with the saved map filling the rest; only the list column scrolls. The phone is
  a list of compact rows that open the car sheet, with no map and no sort.
- Focal moment: a pin and its card lighting up together, and a removed card leaving with its pin while
  the toast offers «Deshacer».

## 4. Scope and boundaries

- In scope: the heading, the sort chips, the Guardados card, the saved map with its pins, preview and
  pill, the compact row and the car sheet, removal with undo, the toast's place, the virtualised list,
  and the loading, empty and error states.
- Untouched here: `/map` beyond the grouped pin's unknown price and the toast's place, `/alerts` (F6),
  the snapshot's refresh (#128).
- Anti-goals: no subtitle about stale prices, no back arrow, no confirmation dialog before removing,
  no sort on the phone, no filters or pagination.

## 5. States and ranges

- Saved cars: none, one, a few, two hundred or more; names and cities short to very long; with or
  without a photo (the car's tint and icon); price or kilometres unknown (0), which sort last.
- Pins: one per point; cars at one point share «N coches · desde <precio>», ignoring unknown prices;
  a group with no known price reads «desde 0 €».
- Removal: at once, before the server answers; a failed removal puts the car back; a failed undo
  takes it out again; both toast the error; two removals have two toasts.
- Empty: «¿Aún nada?» over «Guarda alguno», «Buscar coches», and the map's «Aquí saldrán tus guardados».
- Loading: the heading, the chips, placeholder cards or rows, the map with only its pill.
- Error: «¿Se ha roto algo?» over «No es culpa tuya», «Reintentar» and «Volver al mapa».

## 6. Interaction and layout

- The sort lives in the URL (`sort=price`, `sort=km`), each chip a history entry.
- Hovering or focusing a card marks its pin; a pin outlines its cards, scrolls the first into view and
  opens its preview.
- Back restores the list's scroll; Tab walks every card in order; focus after a removal goes to the
  next item, the previous one, or the empty state's heading.
- The car sheet slides up over the dimmed screen and closes with «Cerrar», Escape or a press outside,
  returning focus to its row. Everything that appears or disappears animates with Motion.

## 7. Constraints and open decisions

- WCAG 2.2 AA under axe at desktop and phone width; hit areas of at least 44 × 44px on a phone.
- All copy through next-intl keys; Spanish is the default locale and the design gives Spanish only.
- Theme tokens from `app/globals.css` only; the toast's place is set per page through
  `data-toast-anchor`.
- Not for the builder to invent: any copy, value or state the design and the spec do not give.
