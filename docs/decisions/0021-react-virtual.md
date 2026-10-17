# 0021 — TanStack Virtual for the saved cars list

Status: Accepted · Date: 2026-10-15 · Supersedes in part [0007](0007-adopt-core-rules.md) › Dependencies outside `STACK.md`

## Context

The saved cars page ([docs/specs/redesign-saved.md](../specs/redesign-saved.md), F5) shows every car
a buyer has saved, with no pagination: the list is unbounded. `RULES.md` §19 requires a list over 50
items to be virtualised, and the page used to mount every card, photo included. At 200 saved cars
that is 200 cards and 200 photos in the DOM, where a screen shows about twelve.

`STACK.md` lists no library for virtualising a list. Its baseline already carries the TanStack
family through `@tanstack/react-table`.

## Decided

**`@tanstack/react-virtual`** (3.14.19) is added, approved by the owner on 2026-10-15
(redesign-saved.md › Contracts › Dependency).

- Its virtualiser runs in `lib/hooks/useSavedList.ts`, the saved list's state (ADR 0007 row 19:
  hooks own the lifecycle). `components/favorites/SavedList.tsx` draws its rows and imports only
  its `Virtualizer` type.
- The rows are placed with an inline `height` on the list (its total size) and an inline
  `transform` on each row (its offset): both are the virtualiser's numbers, measured and changed at
  run time, which no theme class can hold.
- It virtualises by row: a row of two or three Guardados cards on desktop, one compact row on the
  phone. Only the rows in view and a few past each edge are mounted (SAVED-25).
- What virtualising takes away from a plain list is rebuilt on top of it, each with its criterion:
  a pin scrolls its card's row into view (SAVED-26); Back restores the first car in view, recorded
  per history entry in `sessionStorage` (SAVED-27; amended 2026-10-15: the car's index rather than
  its row's, so a column count that changed in between lands on the same car); focusing a card brings it into view, so the next
  one is mounted before Tab reaches it (SAVED-28); cards are keyed by the car, so removal and undo
  keep each card with its own car (SAVED-29).

It is headless: it computes offsets and leaves the markup, the tokens and the focus order to us, as
the rest of the UI is built.

## Alternatives considered

- **Incremental rendering** (draw the first 50, then more as the list scrolls, as the map's
  infinite scroll does): nothing is ever unmounted, so at the end of a long list every card is in
  the DOM again. It defers the cost rather than bounding it, and `RULES.md` §19 asks for the
  bound.
- **CSS `content-visibility: auto`**: the browser skips rendering off-screen cards, but they stay
  in the DOM with their React state, their images and their listeners, so the mounted count is
  unchanged. It also needs a reserved size per card (`contain-intrinsic-size`) that the 20:17
  photo does not give at every width.
- **Hand-written windowing**: the offsets, measurement of real row heights, scroll correction while
  rows above are measured, and scroll-to-index are what the library provides; writing them is
  the bulk of the work and the part most likely to be subtly wrong.
- **`react-window` / `react-virtuoso`**: a second family where TanStack is already in the stack,
  and both draw their own list container, which fights the list column that also holds the heading
  and the chips.

## Consequences

- jsdom has no layout, so the component tests stub `offsetHeight` and `offsetWidth` for every
  element and the list mounts all their few cars. What it mounts, and pin, Back, Tab and removal
  over 200 cars, are e2e criteria in `pnpm test:e2e:db` (SAVED-25 to SAVED-29).
- `STACK.md` is unchanged: a library it does not list is recorded by an ADR (`RULES.md` §5), as
  [0020](0020-radix-popover-dialog-slider.md) is for the Radix packages.

## See also

- [docs/specs/redesign-saved.md](../specs/redesign-saved.md) › Decisions and rationale › Virtualised
- [0007](0007-adopt-core-rules.md) › Dependencies outside `STACK.md`
