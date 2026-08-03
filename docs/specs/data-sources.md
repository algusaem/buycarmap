# Spec: Data sources

Key: SRC
Status: Implemented
Last updated: 2026-08-02.

> **This is a backfill.** The code exists and works. This area turned out to be
> the best-tested in the project — roughly eighty existing tests across three
> source integrations, five proxy routes and three contract suites. The spec
> found four gaps rather than the dozen Wave A produced, and two of them are
> defects. See §6.

---

## 1. Problem

The listings on this map do not belong to us. They come from three Spanish
marketplaces that never agreed to be aggregated: none publishes a documented
API, none uses the same vocabulary for "diesel" or "automatic", one returns no
coordinates at all, and one embeds its results inside a server-rendered HTML
page. They change without warning and fail without pattern.

Everything downstream — the list, the map, the filters, favorites — assumes one
listing shape and one filter set. Something has to absorb the difference, and
absorb it without letting one flaky upstream take the page down with it.

## 2. Scope

**In scope.** Translating the shared filter set into each source's dialect,
mapping each source's results back into `CarListing`, the proxy routes that make
the upstreams reachable at all, and how failures at each boundary behave.

**Out of scope, deliberately:**

- **The search lifecycle that calls all this.** Fan-out, merging, caching and
  pagination are [map-and-search.md](map-and-search.md), which treats each
  source as a function that returns listings or fails.
- **Adding a fourth source.** The pattern is established; a new source is new
  work with its own spec.
- **Deduplicating the same car across sources.** The same vehicle can be listed
  on two sites and will appear twice. Nothing detects that today and no one has
  asked for it — see the last open question.
- **Live upstream drift.** `CONTRACT_LIVE=1` runs nightly against the real APIs;
  that is a monitoring concern, not a behaviour this spec can assert.

## 3. Acceptance criteria

| AC | Statement | Level | Verified by |
| --- | --- | --- | --- |
| SRC-1 | Each source maps a well-formed result into the same listing shape the rest of the app consumes | unit | `lib/{wallapop,cochesnet,milanuncios}/normalize.test.ts` |
| SRC-2 | Listings a source marks as reserved or sold never reach the user | unit | `lib/wallapop/normalize.test.ts` + `lib/milanuncios/normalize.test.ts` |
| SRC-3 | A listing with no coordinates is placed by city, then by province, then at the country centre | unit | `lib/wallapop/normalize.test.ts` + `lib/cochesnet/geo.test.ts` |
| SRC-4 | A listing missing optional attributes still produces a usable card rather than blanks or undefined values | unit | `lib/wallapop/normalize.test.ts` + `lib/milanuncios/normalize.test.ts` |
| SRC-5 | The one shared filter set is translated into each source's own parameter names | unit | `lib/{wallapop,milanuncios}/client.test.ts` |
| SRC-6 | A filter value a source has no equivalent for is dropped, never passed through raw | unit | `lib/{cochesnet,milanuncios}/taxonomy.test.ts` |
| SRC-7 | A model name that matches nothing in a source falls back to filtering by brand alone | unit | `lib/cochesnet/client.test.ts` + `lib/cochesnet/models.test.ts` |
| SRC-8 | A search always sends coordinates to Wallapop, even when the user has chosen no location | unit | `lib/wallapop/client.test.ts` |
| SRC-9 | Each proxy adds the headers its upstream refuses to answer without | node | all five `app/api/**/route.node.test.ts` |
| SRC-10 | A proxy called without its required parameter answers 400 and does not contact the upstream | node | `app/api/{wallapop/filters,cochesnet}/models/route.node.test.ts` |
| SRC-11 | An upstream error status is passed through unchanged, on every proxy | node | all five `app/api/**/route.node.test.ts` |
| SRC-12 | When the upstream connection itself fails, every proxy answers 502 rather than throwing | node | all five `app/api/**/route.node.test.ts` |
| SRC-13 | A source client throws when its proxy answers non-ok, so a failed source is never mistaken for an empty one | unit | `lib/{wallapop,cochesnet,milanuncios}/client.test.ts` |
| SRC-14 | A brand's model list is fetched once per session, and a failed fetch does not permanently disable model filtering for that brand | unit | `lib/cochesnet/models.test.ts` |
| SRC-15 | The test fixtures still match the shape each normalizer reads | contract | `test/contract/*.contract.test.ts` |
| SRC-16 | A caller can override Wallapop's result ordering, so a background poll can ask for newest-first where the interactive search asks for relevance | unit | `lib/wallapop/client.test.ts` |

## 4. Decisions and rationale

### Everything goes through a proxy route, and that is not optional

The browser cannot call any of these APIs. Wallapop's CloudFront blocks
cross-origin requests outright, and it returns 403 without the `x-deviceos: 0`
and `x-appversion: 85000` headers — values discovered by inspection, with no
documentation behind them. coches.net needs `X-Schibsted-Tenant: coches`.
Milanuncios has no API at all: the proxy fetches an HTML page and extracts the
JSON the server embedded in it.

Putting these in the browser would also publish the header values to anyone who
opened devtools, which is the fastest way to get them invalidated.

### A failed source must throw, not return empty

Each client raises on a non-ok proxy response rather than returning `[]`. The
distinction matters upstream: `useListingsSearch` uses `Promise.allSettled`, so
a throw is recorded as a rejection and the source is excluded, while an empty
array is indistinguishable from "this source genuinely has no matching cars".
Conflating them would mean a permanently broken source looking like a source
with nothing to offer, and nobody would ever notice.

### coches.net listings are placed approximately, on purpose

The API returns no coordinates. `lib/cochesnet/geo.ts` resolves each listing to
its city centroid, then to its province capital, then to the Spain centre.
Pins are therefore approximate in a way Wallapop's are not — two coches.net cars
in the same city land on the same point. The alternative, geocoding every
listing through Nominatim on every search, would mean dozens of calls against a
free service with a strict usage policy, to place cars whose sellers only
disclosed a city anyway.

### Unmapped filter values are dropped, not forwarded

Each source's taxonomy maps only the tokens it recognises. An unrecognised fuel
type is dropped from the request entirely rather than passed through, because
these APIs do not validate: an unknown value is silently interpreted, and the
observed result is a filter that appears to work while returning an unfiltered
set. Dropping it means the user sees more results than they asked for, which is
visible; forwarding it means they see the wrong ones, which is not.

### Semi-automatic folds into automatic for coches.net

coches.net has no separate id for it. Folding it into automatic returns a
superset — some true automatics the user did not ask for — while dropping the
filter entirely would return manuals too. The superset is the smaller lie.

### Ordering is the caller's choice, because two callers want opposite things

`searchWallapop` picks `most_relevance` once a location is set and `newest`
otherwise, and for a human reading a list that is right: relevance surfaces the
best matches near them, and recency alone would fill the screen with whatever
happened to be posted last.

A background poll wants the opposite. It reads only the first page, so a listing
ranked twentieth by relevance is a listing it never sees — and the whole job is
noticing new ones. `buildWallapopQuery` therefore takes an `orderBy` override
(SRC-16), and the alert runner forces `newest` even with a location set.

The alternative was a second Wallapop client for the alert path, which would
have duplicated every filter translation in this spec and let the two drift.
Exporting the query builder keeps one translation with one caller-supplied knob.

The same divergence is *not* available on the other two: Milanuncios sends no
ordering parameter at all, and coches.net's date sort is used only by the alert
path for the same reason. See [alerts.md](alerts.md).

## 5. Data and contracts

- **`CarListing`** (`interfaces/listing.ts`) is the shape all three normalize
  into, and the only shape anything downstream knows about.
- **Upstream shapes** are captured as Zod schemas in `test/contract/*` — they
  describe only the fields the normalizers actually read, so an upstream adding
  a field does not fail the suite while removing one does.
- **Endpoints:** `GET api.wallapop.com/api/v3/search/section` and
  `.../search/filters/model`; `POST web.gw.coches.net/search/listing` and
  `GET .../models`; `GET www.milanuncios.com/<slug>` returning HTML with the
  results embedded in `__INITIAL_PROPS__`.
- **Pagination is per-source and cannot be unified:** an opaque `next_page`
  cursor for Wallapop, page numbers plus a total for the other two.
- **Image hosts** must stay listed in `next.config.ts` (`**.wallapop.com`,
  `**.ccdn.es`, the Milanuncios CDN) or `next/image` refuses to render them.

## 6. Open questions

1. ~~SRC-12 is a defect, in four places.~~ **Fixed** — all four routes now
   match Milanuncios and answer 502. Original finding: Only
   `app/api/milanuncios/search/route.ts` wraps its `fetch` in a try/catch. The
   other four routes — both Wallapop routes and both coches.net routes — have no
   error handling at all, so a connection failure (DNS, reset, timeout: routine
   for these upstreams) throws out of the handler and Next answers with an
   unhandled 500 instead of the `{ error }` shape every other path promises.
   The user-visible damage is limited, because the client treats any non-ok as a
   failure and `allSettled` absorbs it — but it logs an unhandled exception in
   production and breaks the response contract. Fix: match Milanuncios.
2. ~~SRC-14 is a defect.~~ **Fixed** — the failure branch no longer writes to
   the cache, so the next search retries. Original finding: `lib/cochesnet/models.ts` caches a *failed* model
   fetch as an empty list for the lifetime of the session:
   `modelsByMake.set(makeId, [])` on the non-ok branch. One transient blip
   therefore disables model filtering for that make until the page is reloaded,
   and because the cache is module-level it cannot be cleared. Caching the
   success is right; caching the failure is not.
3. ~~SRC-11 is a partial gap.~~ **Closed** — both `models` routes now cover it.
   Original finding: Error passthrough is tested on three of five
   routes; the two `models` routes are untested on that branch.
4. **Still open, and needs its own spec.** Deduplication is a feature, not a
   gap: matching the same car across sources means a fuzzy comparison on
   make/model/year/price/location with a tunable threshold, and every choice in
   it is a judgement about false positives (hiding a real second listing)
   against false negatives (showing the same car twice). That belongs in a spec
   of its own rather than being folded in here. Original note: The same car
   advertised on Wallapop and coches.net appears twice, with different ids and
   possibly different prices. Deduplication needs a fuzzy match on
   make/model/year/price/location and would be its own spec — worth deciding
   whether it is wanted before the catalogue grows a fourth source.
