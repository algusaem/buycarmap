# 0001 — No data-fetching library

> **Superseded by [0016](0016-server-search-and-next-intl.md).** The search path no longer fans
> out three browser fetches from `useListingsSearch`: the hook calls one Server Action
> (`searchListings`), which runs the three-source fan-out on the server. The conclusion here — no
> TanStack Query, SWR, RTK Query or Redux — still holds; 0016 records the narrower request shape
> that replaces the one described below.

## Decided

There is no TanStack Query, SWR, RTK Query or Redux. Every request lifecycle
lives in a hand-written hook under `lib/hooks/`, which owns its own loading
state, error handling, caching and cancellation.

**Adding one is a decision to raise, not to make.**

## What it beat

TanStack Query, which would be the default choice for an app that fans out to
three APIs and paginates.

It loses here for a specific reason rather than a philosophical one: **almost
none of what it provides is what this app needs.** The search path wants
round-robin interleaving of three differently-shaped responses, per-source
pagination cursors (one opaque string, two page numbers), and partial-failure
tolerance where two sources succeeding is a success. Expressing that in a query
library means fighting its cache-key model, not being served by it.

What is genuinely wanted — a 60-second cache and an out-of-order guard — is
about forty lines: `lib/wallapop/cache.ts` and a version ref in
`useListingsSearch`.

There is also exactly **one** write path (favorites), and it is a server action.
Mutation orchestration, optimistic-update helpers and invalidation graphs are the
half of a query library that would go entirely unused.

## What it costs

Honestly: every new hook re-implements the same guards, and getting one wrong is
invisible until a race shows up in production. The favorites reconciliation bug —
cards rendering without `isFavorite` — is the kind of thing a normalised cache
would have made structurally impossible.

Consistency is maintained by convention, which means by review.

## What would change our mind

- A **third or fourth write path**, especially one needing optimistic updates and
  invalidation across screens. One mutation does not justify a library; five do.
- **Cross-component cache sharing** becoming a real requirement — two screens
  needing the same fetched data without prop-drilling it.
- A second out-of-order or stale-cache bug of the same class. One is a mistake,
  two is a missing abstraction.

## See also

- [ARCHITECTURE.md](../ARCHITECTURE.md#path-1--a-search)
- [`specs/map-and-search.md`](../specs/map-and-search.md)
