# Spec: Map and search

Key: MAP
Status: Implemented
Last updated: 2026-08-02.

> **This is a backfill.** The behaviour below is already built and working. The
> spec was written from the code, so it cannot disagree with it — which is the
> one thing a spec is normally for. Its value is elsewhere: the criteria list
> flushed out six behaviours nothing tests, and two of those turned out to be
> defects rather than gaps. Read §6 before approving.

---

## 1. Problem

Someone looking for a second-hand car in Spain has to search Wallapop,
coches.net and Milanuncios separately, in three tabs, with three different
filter vocabularies, and none of them show where the cars actually are. Comparing
a Madrid listing against a Valencia one means holding both in your head.

The map is the whole product: one filter set fanned out across every source,
results merged into one list, and every car placed geographically so distance is
something you see rather than calculate.

## 2. Scope

**In scope.** The search lifecycle — validation, fan-out, merging, caching,
stale-response handling, pagination — plus the filter panel that drives it, the
listings list, and the map that mirrors it.

**Out of scope, deliberately:**

- **How each source is called and normalised.** `lib/wallapop/*`,
  `lib/cochesnet/*` and `lib/milanuncios/*` translate the shared filter set into
  each API's dialect and map results back to `CarListing`. That is Wave B; this
  spec treats the sources as three functions that return listings or fail.
- **Geocoding.** `lib/geo/*` and Nominatim belong with Wave D.
- **Favorites.** The heart on a listing card is [favorites.md](favorites.md).
- **Search history and saved searches.** A `SearchHistory` model exists in the
  schema and nothing writes to it. Out of scope until someone specifies it.

## 3. Acceptance criteria

All fifteen are now proven. Nine already held when the spec was written; six
were gaps, and two of those (MAP-7) were defects rather than merely untested.

| AC | Statement | Level | Verified by |
| --- | --- | --- | --- |
| MAP-1 | A search queries all three sources and interleaves the results, so no single source fills the top of the list | unit | `lib/hooks/useListingsSearch.test.tsx` |
| MAP-2 | When some sources fail, the results from the rest still render | unit | `lib/hooks/useListingsSearch.test.tsx` |
| MAP-3 | When every source fails, no listings render and the user is told the search failed | unit | `lib/hooks/useListingsSearch.test.tsx` |
| MAP-4 | A response belonging to a superseded search is discarded rather than overwriting newer results | unit | `lib/hooks/useListingsSearch.test.tsx` |
| MAP-5 | Repeating an identical search within the cache window reuses the previous results instead of refetching | unit | `lib/hooks/useListingsSearch.test.tsx` |
| MAP-6 | A search whose parameters fail validation makes no request to any source | unit | `lib/hooks/useListingsSearch.test.tsx` |
| MAP-7 | Every message shown when a search fails is in the user's language | unit | `lib/hooks/useListingsSearch.test.tsx` (failure + invalid filters) |
| MAP-8 | Scrolling to the end of the list appends the next page from each source that has one | component | `lib/hooks/useListingsSearch.test.tsx` + `components/map/MapView.test.tsx` |
| MAP-9 | Once every source is exhausted, reaching the end of the list requests nothing further | component | `components/map/MapView.test.tsx` |
| MAP-10 | Overlapping requests for the next page do not fetch the same page twice | unit | `lib/hooks/useListingsSearch.test.tsx` |
| MAP-11 | Adjusting a filter re-searches after a pause, while pressing search re-searches at once | unit | `lib/hooks/useSearchFilters.test.tsx` (debounced + immediate) |
| MAP-12 | Changing the brand clears the selected model, so the two cannot contradict each other | unit | `lib/hooks/useSearchFilters.test.tsx` |
| MAP-13 | A distance radius is sent only when the user has chosen a location | unit | `lib/hooks/useSearchFilters.test.tsx` |
| MAP-14 | The first search uses a country-wide fallback, re-runs once the browser reports the user's position, and does not override a location the user picked | unit | `lib/hooks/useSearchFilters.test.tsx` (re-search + user choice wins) |
| MAP-15 | A search returning nothing shows the empty state, and the list and the map always show the same set of listings | component | `components/map/MapView.test.tsx` (empty + map sync) |

## 4. Decisions and rationale

### Results are interleaved, not concatenated

`interleave()` in `useListingsSearch` round-robins the three lists rather than
appending them. Concatenating would put every Wallapop result above every
coches.net one, and since users read from the top, the second and third sources
would effectively not exist. Round-robin makes the merge visible without ranking
sources against each other — which we cannot do honestly, because the three APIs
expose no comparable relevance score.

### Sources fail independently

`Promise.allSettled`, not `Promise.all`. These are three reverse-engineered
APIs; one being down is a normal Tuesday. `all` would mean any single failure
blanks the entire page. The user is only told something went wrong when **all
three** fail, because a toast for a partial failure would fire regularly and be
ignored within a week.

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

### Brand and model are coupled in one direction

Setting a brand clears the model (MAP-12); setting a model does not touch the
brand. Model ids are only meaningful within a brand — `lib/cochesnet/models.ts`
resolves them per `makeId` — so a model left over from the previous brand is
either meaningless or, worse, silently matches something unintended.

## 5. Data and contracts

No database involvement: nothing on this path is persisted. The contracts are:

- **`SearchInput`** (`lib/validations/search.ts`) — the one filter set all three
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

## 6. Open questions

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
