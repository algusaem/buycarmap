# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Private individuals buying a second-hand car for themselves, who want several portals' listings in one place near their home instead of checking each portal separately.

## Product Purpose

BuyCarMap aggregates second-hand car listings from multiple marketplaces and displays them on an interactive map. Users search and filter by location, price, make/model, year, mileage, horsepower, fuel, transmission, and recency, then browse results as a synchronized card list and map.

For a first-time visitor, success means seeing cars near them within seconds — open the map, set a location, see results — with no sign-up required.

## Positioning

Aggregates listings from multiple second-hand car marketplaces (Wallapop, coches.net, Milanuncios) into one map and one search, rather than requiring the buyer to check each portal separately.

## Operating Context

The user is deciding on a car purchase and comparing listings, most likely from a phone (mobile first). They may be checking other portals separately while using BuyCarMap. Not defined yet: any workflow beyond searching and browsing (e.g. contacting a seller, scheduling a viewing) — the product does not yet persist a normalized listing store, send in-app notifications, or send web push.

## Capabilities and Constraints

Built today:

- Search and filter by location, price, make/model, year, mileage, horsepower, fuel, transmission, and recency, with a synchronized card list + map.
- Listings aggregated from Wallapop, coches.net, and Milanuncios into one result set.
- Authentication: register, login, password reset, account management, two-factor, optional OAuth.
- Favorites: save listings, manage them at `/favorites`, reconciled into search results.
- Car alerts: saved search criteria (deduplicated across users), a queue drained every five minutes, email digests, `/alerts` and `/alerts/[id]`, one-click unsubscribe.

Constraints:

- Mobile first.
- Strict accessibility: WCAG 2.2 AA, full keyboard support, screen reader support.

Explicitly not built, and not to be assumed: normalized `Car` listing persistence, in-app notifications, web push.

## Brand Commitments

Tone: friendly and approachable — copy close to the user, room to breathe, nothing intimidating.

Not defined yet: name, logo, or other identity assets beyond this tone.

## Evidence on Hand

Not defined yet.

## Product Principles

- Show nearby cars within seconds on first visit, with no sign-up required.
- Mobile first.
- Strict accessibility: WCAG 2.2 AA, keyboard support, screen reader support.
- Friendly, approachable tone — nothing intimidating.
- One map and one search across multiple marketplaces, instead of checking each portal separately.

## Accessibility & Inclusion

WCAG 2.2 AA. Full keyboard support and screen reader support are explicit product constraints, not just a technical nicety.
