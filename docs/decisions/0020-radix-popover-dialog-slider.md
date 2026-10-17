# 0020 — Radix popover, dialog and slider for the map and search redesign

Status: Accepted · Date: 2026-10-13 · Supersedes in part [0007](0007-adopt-core-rules.md) › Dependencies outside `STACK.md`

## Context

The map and search redesign ([docs/specs/redesign-map.md](../specs/redesign-map.md), F3) needs three
interactions the app had no primitive for: a floating panel anchored to a trigger, a modal sheet that
traps focus and returns it, and a two-knob range. Each has keyboard, focus and ARIA behaviour that is
easy to get subtly wrong by hand (`RULES.md` §18, §19). [ADR 0007](0007-adopt-core-rules.md)
approved "the Radix packages shadcn/ui is built on" as a group, which left no record of which
packages, for what, and when they were added.

## Decided

Three Radix packages are added, approved by the owner on 2026-10-12 («Sí, las tres»):

- **`@radix-ui/react-popover`** — the desktop search pill's popovers («Dónde», «Coche», «Precio»),
  the desktop filters dropdown and the desktop «Crear alerta».
- **`@radix-ui/react-dialog`** — the phone sheets: the «BUSCAR» sheet, the full-screen filters and
  the phone «Crear alerta», with focus trapped and returned.
- **`@radix-ui/react-slider`** — the price range.

The map's preview card is **not** a Radix popover: it is the marker's Leaflet popup, so it is
positioned with the map and moves with it (redesign-map.md › Contracts › The preview card).

`@radix-ui/react-select` leaves the dependencies in the same change (MAPUI-48).

## Consequences

- They are imported only by the components that render them (`components/alerts/CreateAlert.tsx`
  and `components/map/**`), never by a page.
- The slider needs plumbing jsdom lacks in component tests (`docs/ARCHITECTURE.md` › Testing).

## See also

- [docs/specs/redesign-map.md](../specs/redesign-map.md) › Contracts › Dependencies
- [0007](0007-adopt-core-rules.md) › Dependencies outside `STACK.md`
