# Map and search

Key: MAP
Status: Implemented
Last updated: 2026-10-09

---

## Problem

Someone looking for a second-hand car in Spain has to search Wallapop,
coches.net and Milanuncios separately, in three tabs, with three different
filter vocabularies, and none of them show where the cars actually are. Comparing
a Madrid listing against a Valencia one means holding both in your head.

The map is the whole product: one filter set fanned out across every source,
results merged into one list, and every car placed geographically so distance is
something you see rather than calculate.

In scope: the search lifecycle — validation, fan-out, merging, caching,
stale-response handling, pagination — plus the filter panel that drives it, the
listings list, and the map that mirrors it.

## Acceptance criteria

MAP-1 through MAP-15 are proven. Nine already held when the spec was written;
six were gaps, and two of those (MAP-7) were defects rather than merely
untested. MAP-16 through MAP-18 were amended in and implemented test-first on
2026-08-12, and MAP-19 the same day, to close the failure mode they introduced.
MAP-24 was amended in and implemented test-first on 2026-10-09.

- [x] MAP-1 · unit — A search queries all three sources and interleaves the results, so no single source fills the top of the list
- [x] MAP-2 · unit — When some sources fail, the results from the rest still render
- [x] MAP-3 · unit — When every source fails, no listings render and the user is told the search failed
- [x] MAP-4 · unit — A response belonging to a superseded search is discarded rather than overwriting newer results
- [x] MAP-5 · unit — Repeating an identical search within the cache window reuses the previous results instead of refetching
- [x] MAP-6 · unit — A search whose parameters fail validation makes no request to any source
- [x] MAP-7 · unit — Every message shown when a search fails is in the user's language
- [x] MAP-8 · component — Scrolling to the end of the list appends the next page from each source that has one
- [x] MAP-9 · component — Once every source is exhausted, reaching the end of the list requests nothing further
- [x] MAP-10 · unit — Overlapping requests for the next page do not fetch the same page twice
- [x] MAP-11 · unit — Adjusting a filter re-searches after a pause, while pressing search re-searches at once
- [x] MAP-12 · unit — Changing the brand clears the selected model, so the two cannot contradict each other
- [x] MAP-13 · unit — A distance radius is sent only when the user has chosen a location
- [x] MAP-14 · unit — The first search uses a country-wide fallback, re-runs once the browser reports the user's position, and does not override a location the user picked
- [x] MAP-15 · component — A search returning nothing shows the empty state, and the list and the map always show the same set of listings
- [x] MAP-16 · unit — When the user has chosen a location, no listing whose map position lies outside the chosen radius appears in the results, whatever its source
- [x] MAP-17 · unit — When the user has chosen a location, a listing whose position could only be resolved to the country-centre fallback is excluded rather than placed at the country centre
- [x] MAP-18 · unit — When a model is selected, a listing that names the chosen model neither in its model field nor in its title does not appear in the results
- [x] MAP-19 · unit — When every listing on a fetched page is removed by the filters, the search keeps fetching until a page yields a listing or every source is exhausted — on the first search as well as on the sentinel
- [x] MAP-20 · unit — While the location search is loading or has no results, no listbox is rendered: the combobox reports `aria-expanded="false"` with no `aria-controls`, and the loading or no-results text is announced through a polite status region that stays mounted. With results, `aria-controls="location-listbox"` and `aria-expanded="true"` point at the listbox of options. After the "Madrid" options show, typing more starts a new search: while it loads, no listbox is rendered (the previous options are not shown), `aria-expanded="false"`, and the status region reads "Loading…". While that new search loads, ArrowDown then Enter selects nothing — hidden options are not selectable. A response for an earlier query that arrives after a later query was typed is discarded: the listbox shows only the latest query's options, and while the latest search is pending it stays hidden. While options animate out — after a new query, Escape, a click outside, or a selection — they are no longer a listbox and cannot be selected; a click on a fading option selects nothing. A late response for "Madr" that arrives after the query was shortened to "M" is discarded: results stay empty and nothing is loading.
- [x] MAP-21 · unit — If the map unmounts before the browser's geolocation resolves, the search is not repeated when it does.
- [x] MAP-22 · unit — If the location search unmounts before its 400 ms debounce fires, no geocoding request is sent.
- [x] MAP-23 · unit — Every map tile URL, dark and light, carries the CARTO Basemaps key from `NEXT_PUBLIC_CARTO_API_KEY` as the URL-encoded `key` query parameter; with no key configured the tile URLs carry no `key` parameter.
- [x] MAP-24 · unit — Within one search, a Wallapop `next_page` cursor that was already requested — the same cursor handed back again (c1 → c1) or an earlier one coming round again (c1 → c2 → c1) — is treated as Wallapop being exhausted: that round reports no next Wallapop cursor and `hasMore.Wallapop` false, the page that carried the repeat keeps its listings, and the other sources keep paging, so neither the first search nor the sentinel loops forever
- [x] MAP-25 · unit — The map fits its viewport to the results when a search's first results arrive, and only then: appending the next page, or toggling a favourite, leaves the viewport where the user left it. A search whose first results are empty leaves the viewport alone.
- [x] MAP-26 · unit — A next page that arrives after a newer search has committed its results is discarded: the newer search's list is not extended with it, and its next page continues the newer search, not the older one (issue #74).
- [x] MAP-27 · unit — A search that carries coordinates but no `distanceInKm` is searched within 50 km of them — the radius the filter panel defaults to — so the radius post-filter (MAP-16) and every source's query respect it as if the caller had sent it; because `searchSchema` is where the interactive search (`server/search/actions.ts`) and the stored alert criteria (`server/alerts/schema.ts`'s `parseStoredCriteria`, `server/alerts/actions.ts`'s `createAlert`) alike parse their input, both get the default from one change. A search with no coordinates still sends no radius (MAP-13 unchanged) (issue #75; see also alerts.md ALERT-43/ALERT-44 and its open question 7).

## Worked examples

- **MAP-7** — Locale es, all three sources 500 → the results list's inline error state reads "No se pudieron cargar los anuncios. Inténtalo de nuevo." with a Retry button (FRONT-14); latitude 999 → "Esos filtros de búsqueda no son válidos."
- **MAP-16** — Centre Madrid (40.4168, −3.7038), radius 100 km, each source one near and one far item (far Wallapop in Barcelona 41.3874, 2.1686) → exactly wallapop-wp-near, cochesnet-cn-near, milanuncios-mn-near.
- **MAP-17** — Madrid, 100 km; coches.net Getafe cn-near plus coches.net and Milanuncios items with unresolvable "Villarriba" / province 99 (pinned at the Spain centre 40.0, −3.5, ~49 km away) → exactly ["cochesnet-cn-near"].
- **MAP-18** — Brand "BMW", model "Serie 3", no location; coches.net cn-contradicts (model "Serie 5", title "BMW Serie 5 530d") and Milanuncios mn-diluted (title "BMW Serie 5 530d Luxury") among matches → exactly wallapop-wp-match, cochesnet-cn-match, milanuncios-mn-match.
- **MAP-19** — Madrid, 100 km, only Wallapop answers; page 1 = one Barcelona item wp-bcn with next_page "page-2", page 2 = wp-madrid → pages requested ["first","page-2"], listings ["wallapop-wp-madrid"], isLoading false; both pages Barcelona-only → exactly 2 requests, listings [], hasMore false.
- **MAP-24** — The bug this records (#72): Wallapop handing back a cursor already requested, on a page the filters empty, made the MAP-19 loop refetch it forever.
  - *One round, server side.* Cursors `{ wallapop: "c2", wallapopRequested: ["c1"], cochesNet: 2, milanuncios: 0 }`; Wallapop's "c2" page is wp-a with `next_page` "c1", coches.net and Milanuncios answering → the round's listings include `wallapop-wp-a`, its cursors are `{ wallapop: null, wallapopRequested: ["c1", "c2"], cochesNet: 3, milanuncios: 1 }`, `hasMore.Wallapop` false. The same round with Wallapop failing → `wallapop` "c2" and `wallapopRequested` ["c1"], unchanged.
  - *c1 → c1, the repeat page kept.* Madrid, 100 km, Milanuncios returns no ads; coches.net has 3 pages, pages 1–2 one Barcelona item each (cn-bcn-1, cn-bcn-2), page 3 cn-madrid. Wallapop first page = wp-bcn (Barcelona) with `next_page` "c1"; its "c1" page = wp-madrid with `next_page` "c1" again → the first search requests Wallapop pages ["first","c1"] and coches.net pages [1,2], listings ["wallapop-wp-madrid"], isLoading false, hasMore true; the sentinel then requests no Wallapop page and coches.net page 3 → listings ["wallapop-wp-madrid","cochesnet-cn-madrid"], hasMore false. Wallapop is requested exactly 2 times in all.
  - *c1 → c2 → c1, another source still paging.* Madrid, 100 km, Milanuncios returns no ads; Wallapop first page wp-bcn-1 `next_page` "c1", "c1" page wp-bcn-2 `next_page` "c2", "c2" page wp-bcn-3 `next_page` "c1" — all Barcelona; coches.net has 4 pages, pages 1–3 Barcelona only, page 4 cn-madrid → the first search requests Wallapop pages exactly ["first","c1","c2"] and coches.net pages [1,2,3,4], listings ["cochesnet-cn-madrid"], hasMore false, isLoading false. Before the fix the same input never settles.
- **MAP-20** — typing "Nowhereville" (no results) → no listbox, `aria-expanded="false"`, the status region reads "No locations found", axe reports no violations; typing "Madrid" → listbox `location-listbox` with the option, `aria-expanded="true"`, axe reports no violations.
- **MAP-21** — mount, unmount, then resolve geolocation → `search` was called exactly once (the immediate mount search).
- **MAP-22** — type "Madrid", unmount, advance 400 ms → 0 requests to Nominatim.
- **MAP-23** — key `cb1_test` → dark `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_test`, light `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_test`; key `a b&c` → dark `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=a%20b%26c`; no key → the dark and light URLs without `?key=`. The bug this records: on 2026-10-06 the map showed only CARTO's "API KEY REQUIRED" watermark, because every keyless tile request now returns that watermark (the same 2,513-byte PNG for any dark z/x/y) with a 200 status.
- **MAP-25** — a search's first results are wallapop-1 (40.4168, −3.7038) and wallapop-2 (41.3874, 2.1686) → `fitBounds` is called once, with the bounds of [[40.4168, −3.7038], [41.3874, 2.1686]] and `{ padding: [40, 40], maxZoom: 14 }`; wallapop-1 is marked as a favourite → still exactly one call; the next page appends wallapop-3 (39.4699, −0.3763) → still exactly one call; a new search whose first results are wallapop-4 (37.3891, −5.9845) → a second call, with the bounds of [[37.3891, −5.9845]]; a new search with no results → no further call. The bug this records (issue #6): every appended page refitted the map to all the listings loaded so far, pulling it away from wherever the user had panned or zoomed.
- **MAP-26** — The bug this records (issue #74): `loadMore` carries no version check, so a next-page round started by one search but resolved after a later one has committed its results clobbers that later search's list and cursors.
  - Search A (keywords "golf") commits `[a1]`, `hasMore` true, cursors `{ wallapop: "a-page-2", wallapopRequested: [], cochesNet: 1, milanuncios: 1 }`. Scrolling starts a next-page round for A with those cursors; it is held before it resolves.
  - While that round is held, search B (keywords "ibiza") commits `[b1]`, `hasMore` true, cursors `{ wallapop: "b-page-2", wallapopRequested: [], cochesNet: 1, milanuncios: 1 }`.
  - The held A round then resolves with `[a2]` and next cursors `{ wallapop: "a-page-3", wallapopRequested: ["a-page-2"], cochesNet: 2, milanuncios: 2 }`.
  - Wrong result today: the list becomes `[b1, a2]` and `cursorsRef.current` is overwritten with A's cursors above, so B's next page is requested with keywords "ibiza" but A's cursors — continuing search A's pagination, not search B's.
  - Correct result: the list stays `[b1]`; the discarded round leaves `cursorsRef.current` at B's cursors `{ wallapop: "b-page-2", wallapopRequested: [], cochesNet: 1, milanuncios: 1 }`, so B's next page is requested with keywords "ibiza" and those cursors.
- **MAP-27** — Centre Madrid (40.4168, −3.7038), no `distanceInKm`; wallapop-wp-alcala at Alcalá de Henares (40.4818, −3.3643, ~29.6 km from Madrid) and wallapop-wp-toledo at Toledo (39.8628, −4.0273, ~66.9 km from Madrid) → wrong today: both wallapop-wp-alcala and wallapop-wp-toledo reach the results, and the Wallapop request carries no `distance_in_km`; correct: exactly wallapop-wp-alcala — Toledo excluded — and the Wallapop request carries `distance_in_km=50`. The same search with no coordinates at all → no radius is applied: no listing is dropped by distance, and the Wallapop request keeps the nationwide `distance_in_km=1000` it already sends without a location (MAP-13 unchanged).

## Data model

None: this feature adds or changes no table or column. No database involvement:
nothing on this path is persisted.

## Permissions

None: search reads public marketplace listings through the proxy routes and
persists nothing (see Data model and Contracts); no criterion here concerns who
may do what to which records.

## Edge cases

- MAP-2 — some sources fail; the rest still render.
- MAP-3 — every source fails; nothing renders and the user is told.
- MAP-4 — a response from a superseded search is discarded.
- MAP-6 — invalid parameters make no request.
- MAP-7 — failure messages are in the user's language.
- MAP-9 — every source exhausted; nothing further is requested.
- MAP-10 — overlapping next-page requests do not fetch the same page twice.
- MAP-15 — an empty result shows the empty state.
- MAP-17 — a listing resolved only to the country-centre fallback is excluded under a radius.
- MAP-19 — a page filtered down to nothing keeps the search fetching until a listing or exhaustion.
- MAP-20 — no results, a pending search, and a late response for an earlier query.
- MAP-21 — the map unmounts before geolocation resolves.
- MAP-22 — the location search unmounts before its debounce fires.
- MAP-24 — Wallapop hands back a cursor already requested in this search, directly or after a cycle.
- MAP-25 — a page appended, a favourite toggled, and a new search with no results: none of them moves the map.
- Opening the mobile map: see Decisions › The map fits on a new search, not on a new page (MAP-25).
- Partial source failure: see Decisions › Sources fail independently.
- Out-of-order responses: see Decisions › A version counter, not cancellation.
- Pagination on a cache hit: see Decisions › The cache holds page 1 only, and resets pagination on a hit.
- Termination of the fetch loop: see Decisions › A page filtered down to nothing must not end the load (MAP-19), and › A repeated Wallapop cursor ends Wallapop (MAP-24).

## Out of scope

Out of scope, deliberately:

- **How each source is called and normalised.** `lib/wallapop/*`,
  `lib/cochesnet/*` and `lib/milanuncios/*` translate the shared filter set into
  each API's dialect and map results back to `CarListing`. That is Wave B; this
  spec treats the sources as three functions that return listings or fail.
- **Geocoding.** `lib/geo/*` and Nominatim belong with Wave D.
- **Favorites.** The heart on a listing card is [favorites.md](favorites.md).
- **Search history and saved searches.** A `SearchHistory` model exists in the
  schema and nothing writes to it. Out of scope until someone specifies it.

## Contracts

The contracts are:

- **`SearchInput`** (`lib/search/schema.ts`) — the one filter set all three
  sources translate from. Bounds worth keeping: latitude ±90, longitude ±180,
  `distanceInKm` positive, `minYear` at least 1900, `timeFilter` one of
  `today` / `lastWeek` / `lastMonth`.
- **`CarListing`** (`interfaces/listing.ts`) — what every source normalises to
  and what both the list and the map consume.
- **Pagination differs per source and cannot be unified**: Wallapop returns an
  opaque `next_page` cursor, coches.net and Milanuncios use page numbers with a
  total. `PageState` tracks all three separately; "there is more" is the OR of
  them.
- **The proxy routes** (`/api/*/search`) are the only way these APIs are
  reachable — CORS and CloudFront block the browser directly.

## Decisions and rationale

### About this spec

> **Amended 2026-08-12: MAP-16, MAP-17 and MAP-18, implemented.** Filtering by
> location previously constrained only Wallapop — coches.net and Milanuncios
> were always searched nationwide and merged in unfiltered, so with a radius
> chosen, two thirds of the visible results could be anywhere in Spain; and
> the Milanuncios model filter is free-text, so a model search was diluted
> with related-but-wrong cars. The three criteria make the chosen filters a
> real promise at the merge: every listing shown respects the radius and the
> model, whatever its source.

> **Amended 2026-08-12: MAP-19, implemented.** Post-filtering broke the
> assumption that fetching a page grows the list, and both readers of that
> assumption failed: a first page filtered down to nothing showed a permanent
> empty state with the sentinel unrendered, and a later one stalled the scroll
> because `IntersectionObserver` reports crossings rather than states. The
> criterion makes a filtered-away page a reason to keep fetching, not an
> answer.

> **Amended 2026-10-09: MAP-24, implemented.** MAP-19's loops end only
> because every round advances each source, and Wallapop's cursor is whatever
> its `next_page` says. When Wallapop hands back a cursor it has already been
> asked for, on a page the filters empty, nothing advances and the search
> refetches the same page forever (#72). The criterion makes a repeated cursor
> mean Wallapop has nothing more for this search.

> **Amended 2026-10-09: MAP-25, implemented.** The map refitted its
> viewport to every listing loaded so far each time the list changed, so
> scrolling the list to load the next page pulled the map away from wherever
> the user had panned (issue #6). The criterion ties the fit to a search's
> first results, not to the list growing.

> **This is a backfill.** The behaviour below is already built and working. The
> spec was written from the code, so it cannot disagree with it — which is the
> one thing a spec is normally for. Its value is elsewhere: the criteria list
> flushed out six behaviours nothing tests, and two of those turned out to be
> defects rather than gaps. Read Open questions before approving.

### Results are interleaved, not concatenated

`interleave()` in `lib/listings/merge.ts` round-robins the three lists rather than
appending them. Concatenating would put every Wallapop result above every
coches.net one, and since users read from the top, the second and third sources
would effectively not exist. Round-robin makes the merge visible without ranking
sources against each other — which we cannot do honestly, because the three APIs
expose no comparable relevance score.

### Sources fail independently

`Promise.allSettled`, not `Promise.all`. These are three reverse-engineered
APIs; one being down is a normal Tuesday. `all` would mean any single failure
blanks the entire page. The user is only told something went wrong when **all
three** fail, because an error for a partial failure would show regularly and be
ignored within a week. Since `docs/specs/core-frontend.md` (FRONT-14) that error is
the results list's inline error state with Retry, not a toast.

### The cache holds page 1 only, and resets pagination on a hit

`lib/wallapop/cache.ts` is a 60-second module-level `Map` keyed by the
stringified params. A cache hit deliberately resets `pageRef` and sets
`hasMore` false: the cached value is page one, and leaving the previous
search's pagination cursors in place would make the scroll sentinel page
*forward* through a query the user is no longer looking at. Sixty seconds is
short enough that a stale listing set is not a concern and long enough to absorb
the double-search that geolocation causes on mount (see MAP-14).

### A version counter, not cancellation

`searchVersionRef` increments per search, and a resolved response that does not
match the current version is dropped. The requests are not aborted — an
`AbortController` per source would be tidier but the responses are cheap and
already in flight, and dropping them at the boundary is one comparison instead
of threading signals through three clients.

### Coordinates are always sent

Even with no location chosen, the search sends the Spain centre. This is not
cosmetic: Wallapop geo-filters by the caller's IP when it gets no coordinates,
and on Vercel that IP is American, so an unlocated search returns American
listings to a Spanish user. Recorded here because it looks like a redundant
default and will be "simplified away" by someone otherwise.

### Filters debounce, the search button does not

Every filter change re-searches after 400 ms, so dragging a price range does not
fire eight requests. The explicit search button bypasses the debounce and also
collapses the filter panel — the user has finished choosing and the panel is
covering the results they asked for. `update()` deliberately does not collapse
the panel, because closing it under someone still adjusting filters would be
hostile.

### The radius is enforced at the merge, not upstream (MAP-16, MAP-17)

Only Wallapop accepts coordinates, and it honours them: a live probe
(2026-08-12, Madrid + 50 km, six pages, including a rare-brand query that
exhausted) returned zero listings beyond the radius, so `distance_in_km` is a
hard bound in practice, enforced across pagination. coches.net and Milanuncios
have no wired location filter at all, so today a search for "Madrid, 50 km"
returns two nationwide result sets round-robined against one radius-limited
one — and the more filters the user adds, the worse it gets, because
Wallapop's local pool shrinks while the national pools do not. Every far-away
result comes from those two sources. That is the bug this amendment forbids.

The fix is a post-filter where the three lists meet: with a location chosen,
drop every listing whose resolved position is outside the radius. One rule for
all three sources, applied to the same coordinates the map pins use, so the
circle the user asked for and the pins they see can never disagree — MAP-15's
list/map sync is preserved for free.

Consequences accepted deliberately:

- **The filter is only as precise as the pin.** coches.net and Milanuncios
  positions are city- or province-capital approximations (SRC-3), so a car
  pinned at a province capital inside the radius may physically sit outside
  it, and vice versa. This is still categorically better than no constraint,
  and it is honest: what is shown inside the circle is what the map claims is
  inside the circle.
- **Unknown-location listings are excluded, not shown (MAP-17).** The
  country-centre fallback (40.0, −3.5) is ~49 km from Madrid, so without this
  rule every listing whose city failed to resolve would pass a Madrid 50 km
  filter — the exact complaint, disguised as a pin in Guadalajara province.
  A separate criterion because a naive radius check gets it wrong silently.
- **Pages go sparse, and some yield nothing at all (MAP-19).** A nationwide
  coches.net page of 40 may yield a handful of survivors for a tight radius —
  or none. MAP-8 keeps fetching from sources that have more, but only while
  something asks it to, so a page filtered down to nothing needs its own rule;
  see below. Result counts per scroll are smaller with narrow radii either
  way.

Wiring coches.net's upstream province filter (it exists, unwired —
`docs/specs/data-sources.md` › Contracts › coches.net) would reduce the waste, but it is an
efficiency improvement on top of this rule, not a substitute: province ≠
radius, Milanuncios would still need the post-filter, and the upstream shape
is unverified. Left as an open question.

### The model filter is enforced at the merge too (MAP-18)

The other filter that leaks. Milanuncios has no structured model filter — the
model is folded into free-text `palabras`, and probing live (2026-08-12)
showed roughly one in four results for a model search never mentioning that
model. coches.net degrades to make-only filtering when a model name has no
exact `modelId` match, which is the right upstream behaviour but still lets
contradicting models through. Every other filter (price, year, km, power,
fuel, transmission, brand) was probed strict on all three sources; the model
is the only one that needs enforcing here.

The rule: with a model selected, keep a listing only if its model field or
its title names that model, case-insensitively. Substring, not equality —
erring permissive, because dropping a legitimately matching car is worse than
letting a mislabelled one through. Titles are checked because Milanuncios
carries no structured model at all (`CarListing.model` is `""` for that
source); descriptions are not, because "acepto cambio por un Serie 3" would
false-match.

### A page filtered down to nothing must not end the load (MAP-19)

The post-filter's own failure mode, and the reason it needs a criterion rather
than a note. Before MAP-16 every fetched page produced listings, so "fetched a
page" and "the list grew" were the same event. They no longer are, and both
places that assumed they were break:

- **On the first page**, an empty result renders the empty state, and the
  scroll sentinel lives in the branch that is not taken when the list is empty
  (`components/map/MapView.tsx`). Nothing is left on screen that could ask for
  page 2. "No cars found" becomes permanent while the sources still hold
  pages — the worst outcome available, because it is indistinguishable from an
  honest empty result.
- **On a later page**, the list does not grow, so the sentinel neither
  unmounts nor moves out of view. `IntersectionObserver` reports crossings,
  not states, so it does not fire again: loading stops with more still
  promised.

The rule: a round that yields no survivors is not an answer. Keep fetching
until a round yields at least one listing or every source is exhausted — on
the first search and on the sentinel alike.

It terminates. Every round advances Wallapop's cursor and each paged source's
page number, or clears that source's has-more flag, so the loop is bounded by
the sources' own page counts. Wallapop's cursor is opaque, so "advances" holds
only because a cursor already requested is refused — see A repeated Wallapop
cursor ends Wallapop (MAP-24). Deliberately **not** capped at N rounds: a cap
is just the same dead end further away, and the case that would hit it — a
rare model in a tight radius — is exactly the search where giving up early
shows "nothing found" about a country that has one.

The cost is honest and accepted: a narrow radius can spend several sequential
upstream round trips on one gesture, with the spinner showing throughout.
Wiring the upstream location filters (open question 6) reduces the waste; it
does not remove the need for this rule.

### A repeated Wallapop cursor ends Wallapop (MAP-24)

coches.net and Milanuncios page by number, and the server increments it, so
they advance by construction. Wallapop pages by an opaque `next_page` cursor
that the server stores as given, so nothing guaranteed it advances: a cursor
handed back again — c1 → c1, or c1 → c2 → c1 — on a page the post-filter
empties made MAP-19's loop request the same page forever (#72).

The rule (owner's decision, 2026-10-09): within one search, a `next_page` equal
to any Wallapop cursor already requested means Wallapop is exhausted. The round
reports no next Wallapop cursor and `hasMore.Wallapop` false, exactly as if
Wallapop had returned no `next_page`. The page that carried the repeat is still
a real page, so its listings are kept. The other sources are untouched and keep
paging.

**The mechanism is server-side, and the client only carries it.** The fan-out
is server-only (ADR 0016), and each round is a separate `searchListings` call
whose only memory is the `SearchCursors` the client hands back. So the history
travels with the cursors: `SearchCursors` (`server/search/schema.ts`) gains
`wallapopRequested: string[]` — every Wallapop cursor requested in earlier
rounds of this search — and `EMPTY_SEARCH_CURSORS` starts it at `[]`.
`searchRound` (`server/search/service.ts`) reads it and writes it:

- A round that requests Wallapop with cursor X and succeeds returns
  `wallapopRequested` with X appended. If the `next_page` it got back equals X
  or is already in the list, it returns `wallapop: null`, which `roundHasMore`
  already reads as no more Wallapop.
- The first round requests no cursor, so it appends nothing and cannot repeat.
- A round that does not request Wallapop, or whose Wallapop request fails,
  returns `wallapopRequested` unchanged — the same rule as the cursor itself
  (FRONT-1), so a retry asks for the same page with the same history.

`lib/hooks/useListingsSearch.ts` keeps its logic: it already passes back the
`cursors` each round returns, and resets them to `EMPTY_SEARCH_CURSORS` on a
new search and on a cache hit, which is what scopes the history to one search.
Detecting the repeat in the hook was rejected: it would put source-specific
pagination knowledge back in the browser, while the server would still store
whatever cursor it was given.

`wallapopRequested` defaults to `[]` in `searchCursorsSchema`, so a client
built before this change and still open during a deploy keeps validating; it
only lacks the protection until it reloads. The list holds client-supplied
strings that are only compared with Wallapop's answer, never sent upstream.

**The alert runner is not affected.** `server/alerts/search.ts` calls
`searchRound` once per poll with `EMPTY_SEARCH_CURSORS` and never follows a
cursor, so it cannot loop; it picks up the new field through that constant and
its behaviour does not change.

### Brand and model are coupled in one direction

Setting a brand clears the model (MAP-12); setting a model does not touch the
brand. Model ids are only meaningful within a brand — `server/search/service.ts`
resolves them per `makeId` — so a model left over from the previous brand is
either meaningless or, worse, silently matches something unintended.

### Tiles carry a CARTO key (MAP-23)

CARTO's basemap CDN stopped serving keyless tiles under its Basemaps terms of 29 September 2026:
a request without `?key=` gets a 200 with an "API KEY REQUIRED" watermark tile, so nothing errors
and the map silently shows the watermark everywhere. The key travels in every tile URL the
browser requests, so it is public by nature: it is a `NEXT_PUBLIC_` variable rather than a
secret, and its protection is the domain restriction set in the CARTO dashboard. It is optional
in `lib/env.ts` — without it the app still boots, and the watermark makes the missing key
obvious at a glance.

### The map fits on a new search, not on a new page (MAP-25)

`FitBounds` in `components/map/ListingsMap.tsx` refits whenever the `listings` array changes, and
`loadMore` in `lib/hooks/useListingsSearch.ts` replaces that array with the previous listings plus
the new page. So every appended page refitted the map to everything loaded so far, discarding the
user's pan and zoom. Fitting is right when the question changes — new filters, a new location, a
Retry — because the old viewport describes results that are gone. It is wrong when the answer only
grows: the user is reading the list, and the map is where they left it on purpose.

How a new search is told apart from an appended page: `useListingsSearch` returns a results
generation number that changes each time `search` commits a search's first results — the network
path, after the MAP-19 loop, and the cache-hit path alike — and that `loadMore` never touches.
`MapView` passes it to `ListingsMap`, and `FitBounds` fits when the generation changes (and when
the map mounts), never on a change to the `listings` array alone. Rejected alternatives:

- **`searchVersionRef`.** It already exists, but it increments when a search *starts*, before its
  results arrive — the map would fit to the previous search's listings — and for searches that are
  later superseded. It is also a ref, so changing it re-renders nothing.
- **Comparing the new array with the previous one** (same first listings means an append). A new
  search whose results begin with the same listings — the same query again, or a widened filter —
  would be taken for an append and not refit. It infers from the data what the hook already knows.

Consequences accepted deliberately:

- **Appended pages never refit, even if the user has not touched the map.** A rule that refits
  until the first pan would need to tell user moves from the map's own `fitBounds` animation, and
  would still make the map jump while someone scrolls the list. Never refitting on an append is the
  simpler rule and the predictable one. Pins from later pages can fall outside the current viewport;
  zooming out shows them.
- **Toggling a favourite does not refit.** Favourites reconcile in `MapView` through `favoriteIds`,
  which only the cards receive; neither the listings nor the generation change.
- **Opening the mobile map fits it.** `MobileMapOverlay` mounts a fresh `ListingsMap`, which fits
  to every listing loaded so far on mount, as it does today. The desktop map is a separate
  instance, so its viewport is not affected.
- **An empty first page does not fit**, as before: there are no bounds to fit to.

Why `unit` is enough: with `react-leaflet` mocked (Leaflet cannot run in jsdom — `docs/ARCHITECTURE.md`
› Testing), the test can count `fitBounds` calls across re-renders, and "no call" is exactly the
property — a viewport nothing refits stays where the user put it. Dragging the real map is not
needed to prove it.

## Open questions

1. ~~Approving this commits you to retitling nine existing tests.~~ **Settled:
   retitled.** Nine existing test titles now carry their `MAP-n` prefix, so one
   rule holds for backfilled and new specs alike. Original reasoning: Nine
   criteria are already proven, but by tests whose titles predate the id
   convention, and `spec:check` only recognises a criterion when a test title
   names it. Either those tests get `MAP-n:` prefixes — mechanical, nine
   titles across four files — or backfilled specs need an exemption in
   `spec:check`. **Recommendation: retitle.** One rule that always holds beats a
   rule with a category of exceptions, and this is a one-time cost per wave.
2. ~~MAP-7 is a defect, not a gap.~~ **Fixed.** Three keys added to both
   locales; `useListingsSearch` now reads them through `useTranslation`.
   Original finding: `useListingsSearch` shows
   `"Failed to fetch listings"` and `"Failed to load more listings"` as
   hardcoded English, and a validation failure surfaces the raw Zod issue
   message — also English. The default locale is Spanish, so a Spanish user
   currently gets English on every search failure. This violates the project's
   own i18n rule. Fixing it needs three new keys in both locales; the criterion
   is written as the behaviour we want, so it will fail until fixed.
3. **Decided: one generic message.** Invalid parameters are rejected before any
   request, and the user now gets a single localised sentence rather than the
   raw Zod issue. The detail is not actionable for them: every filter in the UI
   is a select or a bounded number input, so a validation failure means
   something is wrong in our code, not in their input. Naming the offending
   field would be leaking a developer message into a dead end. Original note: Invalid parameters are rejected before any
   request, which is right, but the only feedback is that raw Zod message from
   question 2. Worth deciding whether validation failure deserves a real message
   or should be unreachable from the UI in the first place.
4. ~~`CarListingCard.onHover` is dead code.~~ **Closed: removed.** Hovering a
   card highlighting its marker is a real feature and would need its own
   criterion and tests; the prop as it stood did nothing, so it went rather than
   being left as a promise the app never kept. Original note: The prop exists and `MapView`
   never passes it, so hovering a card highlights nothing on the map. Either it
   was intended to and the wiring was lost, or it should be removed. Not
   specified here because it is not currently a behaviour.
5. **The alert runner has the same hole (found with MAP-16).** Taken up by
   ALERT-43 and ALERT-44 in [alerts.md](alerts.md), which apply this spec's
   post-filter to every alert poll; the coordinates-without-radius case is
   alerts.md open question 7. Original note:
   `server/alerts/search.ts` merges all three sources with no distance filter
   either, so a location-scoped alert emails nationwide coches.net and
   Milanuncios matches. It also passes `distanceInKm` straight through: stored
   criteria with coordinates but no radius reach `lib/wallapop/client.ts`,
   whose falsy `if (distance)` check then omits `distance_in_km` entirely — an
   unbounded search around a point. The fix belongs behind an `ALERT`
   criterion in [alerts.md](alerts.md), not here; ideally sharing the same
   radius-filter helper. Not folded into this amendment to keep its blast
   radius reviewable.
6. **Wiring coches.net's upstream province filter** (and investigating
   Milanuncios' province URL slugs) would cut the fetched-then-discarded waste
   that MAP-16 introduces for narrow radii. Efficiency follow-up, needs live
   probing of unverified upstream shapes; the post-filter stays either way.
7. ~~Should `wallapopRequested` be bounded (MAP-24)?~~ **Settled 2026-10-09: no
   bound.** It grows by one cursor per Wallapop round and resets with every new
   search, so it is bounded by how many pages Wallapop serves for one query.
   That count, and the length of a real `next_page` cursor, are not measured,
   so the payload each round carries back is unknown. A `.max(n)` on the schema
   would turn a long legitimate scroll into an `invalidInput` error, so none is
   added; if a bound is wanted later, it needs a measured n and a defined
   behaviour at the limit.
