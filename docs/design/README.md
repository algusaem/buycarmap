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
with the first screens and a component library. It is well behind the canvas — it predates the
violet accent, the illustrations and every F0 screen — and is not kept in sync. The canvas wins.

## The canvas

Page "Pantallas", every screen in journey order, each artboard a desktop screen (1440 × 900)
beside its phone screen (390 × 844):

- `R3-landing.dc.html`, `R3-login.dc.html` — the landing and sign in.
- `F0-registro.dc.html`, `F0-confirmar.dc.html`, `F0-contrasena.dc.html`,
  `F0-nueva-contrasena.dc.html` — register, confirm the account, request and set a new password,
  each with a phone variant of its follow-up state (check your inbox, account ready, expired link).
- `R2Base.dc.html` — the map screen. `R3-mapa-detalle.dc.html` imports it and adds a car's preview
  and the phone filters sheet, so keep both.
- `F0-estado-cargando.dc.html`, `F0-estado-sin-resultados.dc.html`,
  `F0-estado-error-busqueda.dc.html` — the map loading, with no results and with a failed search.
- `R3-favoritos.dc.html`, `F0-estado-guardados-vacio.dc.html` — saved cars, full and empty.
- `R3-alertas.dc.html`, `F0-estado-alertas-vacio.dc.html` — alerts, full and empty.
- `F0-cuenta.dc.html` — account. `F0-legal.dc.html` — privacy and terms.
  `F0-estado-error-pagina.dc.html` — any page that failed to load.

Page "UI Kit": `UIKit.dc.html`, every reusable piece in its states (colours, type, buttons,
search pill and chips, map pins, alert zone and preview, car cards, navigation, form fields, loading
and empty states, account cards, the password meter and the footer).

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
- [EmptyState](system/components/EmptyState/README.md)
- [AccountCard](system/components/AccountCard/README.md)
- [PasswordField](system/components/PasswordField/README.md)
- [Footer](system/components/Footer/README.md)

## Relation to `DESIGN.md`

The root `DESIGN.md` still describes the current app ("Cartographic Modern"). It is replaced from
this design system when the redesign is implemented, not before.
