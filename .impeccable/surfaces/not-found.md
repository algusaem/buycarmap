# Surface brief: the not-found page and the root error

The not-found page (every unmatched address and every `notFound()`) and the root error boundary of
BuyCarMap 2.0. Behaviour is specified in
[`docs/specs/redesign-pages.md`](../../docs/specs/redesign-pages.md) (PAGES-57, PAGES-65 to PAGES-69);
the visual source of truth is the design in [`docs/design/`](../../docs/design/README.md) (boards
`F7-no-existe`, `F0-estado-error-pagina`, the EmptyState README). Where this brief and the design
disagree, the design wins and this brief is corrected.

## 1. Job and audience

- Anyone who followed a wrong address or a stale link, or hit a failure on a page with no error file
  of its own (the access pages, the legal pages, `/` and `/login`).
- Mode: Recover — say what happened in one line and offer the way back to the map.

## 2. Outcome and proof

- The visitor is back on `/map` in one press.
- Evidence on screen: «¿Te has perdido?» over «Esto no existe» and «Esta dirección no lleva a
  ninguna página. Vuelve al mapa y sigue buscando.» (PAGES-65); for a failure «¿Se ha roto algo?»
  over «No es culpa tuya», «Reintentar» and «Volver al mapa» (PAGES-57, PAGES-68).

## 3. Selected direction

- Visual authority: the approved BuyCarMap 2.0 world (`DESIGN.md`), the page-error body
  (`EmptyState`, `PageError`).
- Structural thesis: the state in a list-width column, and at desktop width the empty map beside it,
  drawn for the eye only.
- Focal moment: the one action — lime on the not-found page, where it is the only one.

## 4. Scope and boundaries

- In scope: the not-found page and the root error, their copy, their header and tab bar.
- Untouched here: `/account`'s and the alerts routes' own error files; a failure of the root layout
  itself (`global-error.tsx`, Out of scope).
- Anti-goals: never the thrown error's text; no second action on the not-found page.

## 5. States and ranges

- Signed out: the access header, no tab bar. Signed in: the pages header with nothing current and,
  on a phone, the tab bar with no tab current; `/alerts/[id]`'s 404 keeps «Alertas» current
  (PAGES-66). While the session resolves: the neutral pending header, offering neither.
- The root error under the header of the route that failed; its sides follow the same session rule.

## 6. Interaction and layout

- «Reintentar» refreshes the route's server data and resets the boundary (PLAT-14).
- The thrown error is reported to Sentry and never shown (PAGES-68).

## 7. Constraints and open decisions

- WCAG 2.2 AA; the not-found page passes axe at 1440×900 and 390×844 (PAGES-70); it answers 404 in
  the request's locale (PAGES-67).
- All copy through next-intl keys.
- Reuse `PageStateLayout`, `EmptyState`, `PageError` and the theme tokens.
- Not for the builder to invent: any copy, value or state the design and the PAGES spec do not give.
