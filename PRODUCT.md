# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Private individuals buying a second-hand car for themselves, who want several portals' listings in one place near their home instead of checking each portal separately. Mostly Spanish speakers (the default locale is `es`), browsing from a phone.

## Product Purpose

BuyCarMap aggregates second-hand car listings from multiple marketplaces and displays them on an interactive map. Users search and filter by location, price, make/model, fuel, gearbox, maximum mileage, minimum year, description text, and recency (horsepower only survives in old links), then browse results as a synchronized card list and map.

For a first-time visitor, success means seeing cars near them within seconds, with no sign-up required: the map opens around their position when the browser shares it, or on the place they set. Signing up is for keeping cars (saved cars) and being told about new ones (alerts).

## Positioning

Aggregates listings from multiple second-hand car marketplaces (Wallapop, coches.net, Milanuncios) into one map and one search, rather than requiring the buyer to check each portal separately: "una web, toda la segunda mano, sin cincuenta pestañas".

## Operating Context

The user is deciding on a car purchase and comparing listings, most likely from a phone (mobile first). They may be checking other portals separately while using BuyCarMap. Not defined yet: any workflow beyond searching and browsing (e.g. contacting a seller, scheduling a viewing) — the product does not yet persist a normalized listing store, send in-app notifications, or send web push.

## Capabilities and Constraints

Built today:

- Search and filter by location, price, make/model, fuel, gearbox, maximum mileage, minimum year, description text, and recency, with a synchronized card list + map. Horsepower is no longer offered; old links that carry it still work.
- Listings aggregated from Wallapop, coches.net, and Milanuncios into one result set.
- Authentication: register, login, password reset, account management, two-factor, optional OAuth.
- Favorites: save listings, manage them at `/favorites`, reconciled into search results.
- Car alerts: saved search criteria (deduplicated across users), a queue drained every five minutes, email digests, `/alerts` and `/alerts/[id]`, one-click unsubscribe.

Being redesigned ("BuyCarMap 2.0", approved 2026-10-11, in `docs/design/`): every screen moves to a map-first structure — a list and a map side by side on desktop; on the phone, the map under a top band with the search summary and the quick filters, and a three-position bottom sheet (moved by its handle or by dragging), the map also on saved cars and alerts. The redesign drops the light theme and keeps Google as the only OAuth provider. Left out of it, each tracked as its own issue: an exact vector map style, a photo carousel, search-as-I-move-the-map, a total result count, new-match markers on alerts, and redesigned emails.

Constraints:

- Mobile first.
- Strict accessibility: WCAG 2.2 AA, full keyboard support, screen reader support.

Explicitly not built, and not to be assumed: normalized `Car` listing persistence, in-app notifications, web push.

## Brand Commitments

Name: BuyCarMap. The wordmark is type only — "BUYCAR" in the text colour, "MAP" in lime, set in Unbounded 900 — with no logo file.

Look: a night with one light. Near-black (`#0F0F10`) everywhere, Unbounded in uppercase for headlines, counts and prices, Rethink Sans for everything else, round pill shapes, a minimal dark map. Two complementary accents with fixed jobs: lime (`#C6FF3D`) for what you are doing or looking at now — prices, the one primary button, the active pin and its card — and violet (`#7C4DFF`) for what is yours and for states — the saved heart, active chips, the account. Dark only: there is no light theme.

Tone: "macarra", cheeky and street-smart — someone from the neighbourhood who knows cars, not a bank. Short, colloquial lines with attitude, never selling smoke: no invented figures ("50K+", "100 %"), no "Bienvenido a…", "Descubre…", "La mejor forma de…". Headlines are a question and a punchline («¿EN BUSCA DE COCHE? MIRA EL MAPA», «¿TE MOLA UN COCHE? GUÁRDALO»), the punchline in lime and with no full stop. Buttons say what happens: «Buscar», «Guardar», «Ver anuncio», «Crear alerta».

The full brand book, tokens and components are the design system in `docs/design/system/`; the screens are in `docs/design/canvas/`.

## Evidence on Hand

The approved design canvas and design system (claude.ai artifacts, snapshotted in `docs/design/`). No user research or analytics yet.

## Product Principles

- Show nearby cars within seconds on first visit, with no sign-up required.
- The map is the product: every screen that lists cars shows them on the map too.
- Mobile first.
- Strict accessibility: WCAG 2.2 AA, keyboard support, screen reader support.
- Cheeky, never intimidating and never lying: attitude in the copy, honesty in the numbers.
- One map and one search across multiple marketplaces, instead of checking each portal separately.
- Design first: a visual change is designed and approved before it is specified or coded (`CLAUDE.md` › Design first).

## Accessibility & Inclusion

WCAG 2.2 AA. Full keyboard support and screen reader support are explicit product constraints, not just a technical nicety. On the dark theme, text on lime and on violet meets AA (lime with near-black text, violet with off-white text `#FAF9F8` at 4.6:1), and state is never shown by colour alone: an active chip or pin also changes weight, and the active pin gains a halo.
