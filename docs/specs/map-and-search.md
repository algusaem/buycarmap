# Map and search

Key: MAP
Status: Implemented
Last updated: 2026-09-28

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

## Worked examples

- **MAP-7** — Locale es, all three sources 500 → the results list's inline error state reads "No se pudieron cargar los anuncios. Inténtalo de nuevo." with a Retry button (FRONT-14); latitude 999 → "Esos filtros de búsqueda no son válidos."
- **MAP-16** — Centre Madrid (40.4168, −3.7038), radius 100 km, each source one near and one far item (far Wallapop in Barcelona 41.3874, 2.1686) → exactly wallapop-wp-near, cochesnet-cn-near, milanuncios-mn-near.
- **MAP-17** — Madrid, 100 km; coches.net Getafe cn-near plus coches.net and Milanuncios items with unresolvable "Villarriba" / province 99 (pinned at the Spain centre 40.0, −3.5, ~49 km away) → exactly ["cochesnet-cn-near"].
- **MAP-18** — Brand "BMW", model "Serie 3", no location; coches.net cn-contradicts (model "Serie 5", title "BMW Serie 5 530d") and Milanuncios mn-diluted (title "BMW Serie 5 530d Luxury") among matches → exactly wallapop-wp-match, cochesnet-cn-match, milanuncios-mn-match.
- **MAP-19** — Madrid, 100 km, only Wallapop answers; page 1 = one Barcelona item wp-bcn with next_page "page-2", page 2 = wp-madrid → pages requested ["first","page-2"], listings ["wallapop-wp-madrid"], isLoading false; both pages Barcelona-only → exactly 2 requests, listings [], hasMore false.
- **MAP-20** — typing "Nowhereville" (no results) → no listbox, `aria-expanded="false"`, the status region reads "No locations found", axe reports no violations; typing "Madrid" → listbox `location-listbox` with the option, `aria-expanded="true"`, axe reports no violations.
- **MAP-21** — mount, unmount, then resolve geolocation → `search` was called exactly once (the immediate mount search).
- **MAP-22** — type "Madrid", unmount, advance 400 ms → 0 requests to Nominatim.

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
- Partial source failure: see Decisions › Sources fail independently.
- Out-of-order responses: see Decisions › A version counter, not cancellation.
- Pagination on a cache hit: see Decisions › The cache holds page 1 only, and resets pagination on a hit.
- Termination of the fetch loop: see Decisions › A page filtered down to nothing must not end the load (MAP-19).

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
the sources' own page counts. Deliberately **not** capped at N rounds: a cap
is just the same dead end further away, and the case that would hit it — a
rare model in a tight radius — is exactly the search where giving up early
shows "nothing found" about a country that has one.

The cost is honest and accepted: a narrow radius can spend several sequential
upstream round trips on one gesture, with the spinner showing throughout.
Wiring the upstream location filters (open question 6) reduces the waste; it
does not remove the need for this rule.

### Brand and model are coupled in one direction

Setting a brand clears the model (MAP-12); setting a model does not touch the
brand. Model ids are only meaningful within a brand — `server/search/service.ts`
resolves them per `makeId` — so a model left over from the previous brand is
either meaningless or, worse, silently matches something unintended.

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
5. **The alert runner has the same hole (found with MAP-16).**
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
