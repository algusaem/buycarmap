# Design — BuyCarMap 2.0

The approved redesign of BuyCarMap (2026-10-11): what every screen should look like, and the system
it is built from. Nothing here is implemented yet; it is the reference the redesign specs and code
will be written against.

## Where it lives

The design is edited in two claude.ai artifacts. The copies in this folder are snapshots of them, so
the design survives without the artifacts and travels with the code.

| | Edited in | Snapshot here |
| --- | --- | --- |
| Screens and UI kit | [Design canvas](https://claude.ai/artifact/9TxaFxZY17u59e2L1DEZjf) | `docs/design/canvas/` |
| Design system | [Design system](https://claude.ai/artifact/Rzes1CqbkBtFkVBjG2nihj) | `docs/design/system/` |

**The artifacts are the source of truth while the design is still moving.** After a change there,
re-export the files here in the same pull request that depends on them; never edit the snapshot by
hand.

A Figma copy exists too ([BuyCarMap — Rediseño](https://www.figma.com/design/j0j8TrycVYlM50otNVJNdU)),
with the same screens and a component library. It is behind the canvas: the desktop saved cars and
alerts screens there lack the 2026-10-11 map split's final details. The canvas wins where they differ.

## The canvas

Page "Final product", each artboard a desktop screen (1440 × 900) beside its phone screen
(390 × 844):

- `R3-landing.dc.html` — the landing.
- `R3-mapa-detalle.dc.html` — the map with a car's preview open, and the phone filters sheet. It
  imports `R2Base.dc.html`, the map screen itself, so keep both.
- `R3-favoritos.dc.html`, `R3-alertas.dc.html`, `R3-login.dc.html` — saved cars, alerts, sign in.

Page "UI Kit": `UIKit.dc.html`, every reusable piece in its states (colours, type, buttons,
search pill and chips, map pins and preview, car cards, navigation, form fields).

The listings, prices and photos in the screens are made-up examples.

`canvas/illus/` holds the two illustrations the landing and sign-in screens use, "Vehicle sale" and
"By my car" from [Storyset](https://storyset.com) (Freepik), "Cuate" style, background hidden and
recoloured to the palette. Their free licence requires the credit "Illustrations by Storyset" with a
link, so the shipped pages must carry it.

## The design system

[`system/README.md`](system/README.md) is the brand book: voice and copy rules, colour, type,
screen structure, icons and accessibility. `system/tokens.json` holds every token;
`system/components/<Name>/` holds each component's guidelines and preview:

- [Button](system/components/Button/README.md)
- [Chip](system/components/Chip/README.md)
- [SearchPill](system/components/SearchPill/README.md)
- [Headline](system/components/Headline/README.md)
- [ListingCard](system/components/ListingCard/README.md)
- [PricePin](system/components/PricePin/README.md)
- [AlertZone](system/components/AlertZone/README.md)
- [MapPreview](system/components/MapPreview/README.md)
- [BottomSheet](system/components/BottomSheet/README.md)
- [BottomNav](system/components/BottomNav/README.md)
- [Wordmark](system/components/Wordmark/README.md)

## Relation to `DESIGN.md`

The root `DESIGN.md` still describes the current app ("Cartographic Modern"). It is replaced from
this design system when the redesign is implemented, not before.
