# Surface brief: /

The landing page of BuyCarMap 2.0, the first page most visitors see. Behaviour is specified in
[`docs/specs/redesign-entry.md`](../../docs/specs/redesign-entry.md) (ENTRY); the visual source of truth is
the design in [`docs/design/`](../../docs/design/README.md) (board `R3-landing`, the UI Kit). Where this
brief and the design disagree, the design wins and this brief is corrected.

## 1. Job and audience

- A private buyer in Spain looking for a second-hand car for themselves, mostly on a phone, often
  with other portals open in other tabs (`PRODUCT.md` › Users, Operating Context).
- A first-time visitor who has not searched yet, signed in or out; the signed-in case only changes
  the header and, on a phone, adds the tab bar (ENTRY-8).
- Mode: Persuade — deciding whether to search here at all; the headline and the map preview are
  the pitch before any search happens.

## 2. Outcome and proof

- Primary task: choose a place, a car or a price and press «Buscar» (desktop) or «Ver coches»
  (phone), or pick a popular car, and land on `/map` with that search applied (ENTRY-2, ENTRY-3,
  ENTRY-4, ENTRY-5).
- Success: the visitor reaches `/map` with a search already narrowed, without typing free text —
  the landing produces no `?q=` link (ENTRY-6).
- Evidence on screen: the headline «¿En busca de coche? Mira el mapa», the line «Una web, toda la
  segunda mano, sin cincuenta pestañas.», the search, «Populares» and the map preview. No made-up
  figures, no «Ver el mapa» as a separate link, no «Accede para guardar búsquedas» (ENTRY-1).
- The map preview is a fixed illustration with example pins and an example car card, not live data
  (ENTRY-7; owner decision, 2026-10-14: a live map would load the map library and query the sources
  before the visitor asks for anything).

## 3. Selected direction

- Visual authority: the approved BuyCarMap 2.0 world, "one light in the night" (`DESIGN.md`):
  near-black `bg` and `surface`, lime for what the visitor is doing now, Unbounded uppercase for the
  headline, Rethink Sans for the rest.
- Structural thesis: the search is a pill, not a page. From 1440 wide the headline and the search
  sit beside the map-preview illustration, with the Storyset arrows pointing at it; from 1024 to
  1439 wide they stack in one centred column with no map preview and no arrows, the Storyset
  illustration whole under «Populares» and the footer links just below it (ENTRY-23, ENTRY-24).
  The phone keeps the map preview on screen with a
  search card over it that opens the map's own «BUSCAR» sheet (ENTRY-5).
- Focal moment: the map preview's one lime pin with its price, the same active-pin treatment
  `/map` uses for the car the visitor is looking at.

## 4. Scope and boundaries

- In scope: the landing body (desktop and phone, signed in or out), its search and popovers (reused
  from `/map`), «Populares», the map preview, the Storyset illustration and arrows, and the
  signed-in phone tab bar (ENTRY-8).
- Untouched here: `/login`'s own surface is [`login.md`](login.md); the map itself (F3); the
  saved-cars and alerts page layouts (F5, F6); emails.
- Anti-goals: no free-text search box, no live map or real listings on the landing (owner decision,
  2026-10-14), no per-source filter UI, no figures the sources did not produce.

## 5. States and ranges

- Landing search: nothing chosen, a place only, a car only, a price only, or all three — each
  reflected in its own segment, the same popovers as `/map` (ENTRY-2, worked examples).
- «Populares»: «Golf», «SEAT León», «BMW Serie 3», «Audi A4», desktop only — the phone shows no
  popular list (ENTRY-4).
- Signed in vs signed out: the body is the same either way; only the header and, on a phone, the
  tab bar change (ENTRY-1, ENTRY-8). Signed out keeps «Entrar»; signed in shows no avatar and no
  «Entrar», and the tab bar marks no tab current, because the landing is none of «Mapa»,
  «Guardados», «Alertas» or «Cuenta».
- No-match and invalid-price states inside the popovers are the map's own (MAPUI-56, MAPUI-11,
  MAPUI-14), reused as-is.
- A popular car whose model the brand list does not return: raised during implementation, not
  guessed (Worked examples, ENTRY spec).

## 6. Interaction and layout

- Desktop: each popover holds a draft, same as `/map`'s, but nothing is searched until «Buscar» —
  the landing navigates, it does not search (ENTRY-2).
- Phone: tapping anywhere on the search card, «Buscar» included, opens the map's «BUSCAR» sheet
  over the landing; «Ver coches» goes to `/map` with what was chosen, and closing the sheet changes
  nothing (ENTRY-5).
- The map-preview illustration is one link to `/map`, named «Ver el mapa» (ENTRY-7).
- The popovers and the phone sheet move as on `/map` (`docs/specs/motion.md`): with a pointer the
  popovers fade over 180ms and the sheet fades over 180ms, leaving the way they came; with a key or
  Escape they appear and disappear at once. The type-ahead lists never animate. Reduced motion is
  honoured.

## 7. Constraints and open decisions

- WCAG 2.2 AA, full keyboard support and screen reader support; `/` passes axe at desktop and phone
  width (ENTRY-21).
- All copy through next-intl keys; Spanish is the default locale and the design gives Spanish only.
- Reuse the map's search popovers and phone sheet (`components/map/search/*`,
  `components/map/phone/SearchSheet.tsx`) and the design system's theme tokens; no new colour,
  token or pattern without approval.
- Not for the builder to invent: any copy, value or state the design and the ENTRY spec do not
  give — including the popular-car model strings, confirmed against the brand list during
  implementation.
