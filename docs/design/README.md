# Design — BuyCarMap 2.0

The approved redesign of BuyCarMap (2026-10-11): what every screen should look like, and the system
it is built from. Nothing here is implemented yet; it is the reference the redesign specs and code
will be written against.

## Where it lives

**This folder is the source of truth**, and the design is viewed in the Claude Design project
[BuyCarMap 2.0](https://claude.ai/design/p/838f9ee3-0bcc-4990-8c5a-5a685806db48), which is published
from it (its id is pinned in `.design-sync/config.json`):

| | Source here | In the project |
| --- | --- | --- |
| Screens and UI kit | `docs/design/canvas/` | groups "Pantallas" and "UI Kit", one card per artboard in journey order |
| Design system | `docs/design/system/` | tokens, README and one card per component |

A design change is made here, shown to the owner, and republished to the project in the same pull
request, so the two never differ.

The first version lived in two claude.ai artifacts, a canvas
(`https://claude.ai/artifact/9TxaFxZY17u59e2L1DEZjf`) and a design system
(`https://claude.ai/artifact/Rzes1CqbkBtFkVBjG2nihj`). They are frozen at commit `944a770`: an
artifact created from an artifact type cannot be published to from a coding session.

A Figma copy exists too ([BuyCarMap — Rediseño](https://www.figma.com/design/j0j8TrycVYlM50otNVJNdU)),
with the first screens and a component library. It is well behind the canvas — it predates the
violet accent, the illustrations and every F0 screen — and is not kept in sync. The canvas wins.

## The canvas

Page "Pantallas", every screen in journey order, each artboard a desktop screen (1440 × 900)
beside its phone screen (390 × 844); the landing, sign in and saved cars also carry a laptop screen (1024 × 900):

- `R3-landing.dc.html`, `R3-login.dc.html` — the landing and sign in.
- `F0-registro.dc.html`, `F0-confirmar.dc.html`, `F0-contrasena.dc.html`,
  `F0-nueva-contrasena.dc.html` — register, confirm the account, request and set a new password,
  each with a phone variant of its follow-up state (check your inbox, account ready, expired link).
- `R2Base.dc.html` — the map screen. `R3-mapa-detalle.dc.html` imports it and adds a car's preview
  and the phone filters sheet, so keep both.
- `F3-mapa-filtros.dc.html`, `F3-mapa-crear-alerta.dc.html`, `F3-crear-alerta-estados.dc.html` — the
  map with the filters open (the desktop dropdown and the phone sheet), with «Crear alerta» open, and
  creating an alert from a search that is too broad and once it is created.
- `F3-buscador-donde.dc.html`, `F3-buscador-coche.dc.html`, `F3-buscador-precio.dc.html` — the map
  with each search pill segment open (Dónde, Coche, Precio) on desktop; on the phone, the map with
  the search row and the «Buscar» sheet it opens.
- `F0-estado-cargando.dc.html`, `F0-estado-sin-resultados.dc.html`,
  `F0-estado-error-busqueda.dc.html` — the map loading, with no results and with a failed search.
- `R3-favoritos.dc.html`, `F5-guardados-coche.dc.html`, `F5-guardados-estados.dc.html`,
  `F0-estado-guardados-vacio.dc.html` — saved cars, with a car open (the preview on desktop, the car sheet
  on the phone), on a laptop, scrolled down a long list, with several cars at one point on the map,
  after removing one (desktop and phone), loading, and empty.
- `R3-alertas.dc.html`, `F6-alerta.dc.html`, `F6-alerta-estados.dc.html`, `F0-estado-alertas-vacio.dc.html` —
  alerts; an alert's page on the phone; that page scrolled to the end, a match open, the delete
  confirmation and an alert with no matches (phones only); and no alerts.
- `F0-cuenta.dc.html` — account. `F0-legal.dc.html` — privacy and terms.
  `F0-estado-error-pagina.dc.html` — any page that failed to load.

Page "UI Kit": `UIKit.dc.html`, every reusable piece in its states (colours, type, buttons,
search pill and the filter row, the search pill popovers and the phone «Buscar» sheet, the
filters panel, the «Crear alerta» popover and sheet, map pins, alert zone and preview, car cards,
navigation and the phone tab bar, the phone car and confirm sheets, the phone alert page, form
fields, loading and empty states, account cards, the password meter and the footer).

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
- [SearchPopover](system/components/SearchPopover/README.md)
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
- [Toast](system/components/Toast/README.md)
- [Select](system/components/Select/README.md)
- [StatusPill](system/components/StatusPill/README.md)
- [HeaderNav](system/components/HeaderNav/README.md)
- [AlertCard](system/components/AlertCard/README.md)
- [GoogleButton](system/components/GoogleButton/README.md)
- [MapZoom](system/components/MapZoom/README.md)
- [FilterSheet](system/components/FilterSheet/README.md)
- [CreateAlert](system/components/CreateAlert/README.md)
- [Cover](system/components/Cover/README.md)

## Relation to `DESIGN.md`

The root `DESIGN.md` still describes the current app ("Cartographic Modern"). It is replaced from
this design system when the redesign is implemented, not before.
