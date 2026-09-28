# Data sources

Key: SRC
Status: Implemented
Last updated: 2026-09-28

---

## Problem

The listings on this map do not belong to us. They come from three Spanish
marketplaces that never agreed to be aggregated: none publishes a documented
API, none uses the same vocabulary for "diesel" or "automatic", one returns no
coordinates at all, and one embeds its results inside a server-rendered HTML
page. They change without warning and fail without pattern.

Everything downstream — the list, the map, the filters, favorites — assumes one
listing shape and one filter set. Something has to absorb the difference, and
absorb it without letting one flaky upstream take the page down with it.

In scope: translating the shared filter set into each source's dialect,
mapping each source's results back into `CarListing`, the proxy routes that make
the upstreams reachable at all, and how failures at each boundary behave.

## Acceptance criteria

- [x] SRC-1 · unit — Each source maps a well-formed result into the same listing shape the rest of the app consumes
- [x] SRC-2 · unit — Listings a source marks as reserved or sold never reach the user
- [x] SRC-3 · unit — A listing with no coordinates is placed by city, then by province, then at the country centre
- [x] SRC-4 · unit — A listing missing optional attributes still produces a usable card rather than blanks or undefined values
- [x] SRC-5 · unit — The one shared filter set is translated into each source's own parameter names
- [x] SRC-6 · unit — A filter value a source has no equivalent for is dropped, never passed through raw
- [x] SRC-7 · unit — A model name that matches nothing in a source falls back to filtering by brand alone
- [x] SRC-8 · unit — A search always sends coordinates to Wallapop, even when the user has chosen no location
- [x] SRC-9 · node — Each proxy adds the headers its upstream refuses to answer without
- [x] SRC-10 · node — A proxy called without its required parameter answers 400 and does not contact the upstream
- [x] SRC-11 · node — An upstream error status is passed through unchanged, on every proxy
- [x] SRC-12 · node — When the upstream connection itself fails, every proxy answers 502 rather than throwing
- [x] SRC-13 · unit — A source client throws when its proxy answers non-ok, so a failed source is never mistaken for an empty one
- [x] SRC-14 · unit — A brand's model list is fetched once per session, and a failed fetch does not permanently disable model filtering for that brand
- [x] SRC-15 · contract — The test fixtures still match the shape each normalizer reads
- [x] SRC-16 · unit — A caller can override Wallapop's result ordering, so a background poll can ask for newest-first where the interactive search asks for relevance

## Worked examples

- **SRC-12** — Upstream connection fails; GET /api/wallapop/search?keywords=golf → 502 with an { error } body, never a thrown 500.
- **SRC-14** — /api/cochesnet/models returns [{ id: 4321, label: "Serie 3" }]; resolveCochesNetModelId(103, "Serie 3") twice → 1 upstream call; make 104 with a first 503 then success → first call undefined, second 4321, 2 calls in total.

## Data model

None: this feature adds or changes no table or column.

## Permissions

None: this area handles only public marketplace listings through the proxy
routes and stores no user data; no criterion here concerns who may do what to
which records.

## Edge cases

- SRC-2 — reserved or sold listings are dropped.
- SRC-3 — a listing with no coordinates falls back to city, province, then country centre.
- SRC-4 — a listing missing optional attributes still produces a usable card.
- SRC-6 — a filter value with no equivalent in a source is dropped.
- SRC-7 — a model name that matches nothing falls back to brand-only filtering.
- SRC-10 — a proxy called without its required parameter answers 400.
- SRC-11 — an upstream error status is passed through unchanged.
- SRC-12 — a failed upstream connection answers 502.
- SRC-13 — a non-ok proxy response makes the client throw, not return empty.
- SRC-14 — a failed model fetch does not disable model filtering for the brand.
- Failure versus empty: see Decisions › A failed source must throw, not return empty.
- Unrecognised filter tokens: see Decisions › Unmapped filter values are dropped, not forwarded.
- Semi-automatic on coches.net: see Decisions › Semi-automatic folds into automatic for coches.net.

## Out of scope

Out of scope, deliberately:

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

## Contracts

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

What each upstream actually does, as observed. The criteria above are what we
guarantee; this is the behaviour underneath them, none of it documented by the
sources themselves. The nightly contract test (`pnpm test:contract:live`) is the
alarm when any of it changes.

### Wallapop

Reverse-engineered. There is no public API, no documentation and no agreement
that any of this keeps working — the nightly contract test is the alarm.

#### The endpoints

| Purpose | Upstream | Proxied at |
| --- | --- | --- |
| Search | `GET https://api.wallapop.com/api/v3/search/section` | `/api/wallapop/search` |
| Models for a brand | `GET …/api/v3/search/filters/model` | `/api/wallapop/filters/models?brand=` |

**Two headers are mandatory.** Without them CloudFront answers 403:

```
x-deviceos: 0
x-appversion: 85000
```

They are added by the proxy route
([`app/api/wallapop/search/route.ts`](../../app/api/wallapop/search/route.ts)),
never by the browser.

**Never call Wallapop from the browser.** CORS and CloudFront both block it. That
is the entire reason the proxy routes exist.

#### Request

Built by [`lib/wallapop/client.ts`](../../lib/wallapop/client.ts). Four constants
identify a car search:

```
category_id=100
source=deep_link
section_type=organic_search_results
order_by=most_relevance | newest
```

`order_by` switches to `newest` when the user has picked no location — relevance
against an arbitrary map centre is not meaningful, recency is.

**A caller can override that choice.** `buildWallapopQuery` takes an `orderBy`
option, and the alert runner forces `newest` even with a location set: it reads
only the first page, so anything ranked twentieth by relevance is something it
never sees. The interactive search does not pass the option and keeps the
behaviour above. See SRC-16.

| Shared filter | Wallapop parameter |
| --- | --- |
| keywords | `keywords` |
| location | `latitude`, `longitude`, `distance_in_km` |
| price | `min_sale_price`, `max_sale_price` |
| mileage | `min_km`, `max_km` |
| year | `min_year`, `max_year` |
| power | `min_horse_power`, `max_horse_power` |
| brand / model | `brand`, `model` |
| fuel / transmission | `engine`, `gearbox` (comma-joined) |
| recency | `time_filter` |
| pagination | `next_page` (opaque cursor) |

Wallapop is the source whose vocabulary the shared filter set borrows: `engine`,
`gearbox` and the model *name* as its own id all come from here. The other two
sources translate away from it, not towards it.

##### Coordinates are always sent

Even when the user has chosen no location. The fallback chain is **explicit
location → browser geolocation → Spain centre (40.0, −3.5)**, with
`distance_in_km` defaulting to 1000 when there is no explicit location.

This is not a nicety. Without coordinates Wallapop geo-filters by the caller's IP
— and in production that is a Vercel server in the United States, so a Spanish
user would get American listings. The bug is invisible locally, where your own IP
is Spanish.

#### Response

The item shape is **flat — there is no `.content` wrapper.** An older shape had
one; anything you remember about `item.content.price` is out of date.

```
data.section.items[]
  id
  title
  description
  web_slug
  price.amount
  images[].urls.big | .medium
  location.latitude | .longitude | .city
  reserved.flag
  type_attributes.{ brand, model, year, km, engine, horsepower }
meta.next_page
```

`reserved.flag` replaced an older `flags.{sold,reserved,banned,expired}` object.

#### Normalisation

[`lib/wallapop/normalize.ts`](../../lib/wallapop/normalize.ts) maps items into
`CarListing`:

- **Reserved items are dropped** (`reserved.flag`).
- Car data comes from `type_attributes`, not from the title.
- Image prefers `urls.big`, falls back to `urls.medium`, then empty string.
- Missing coordinates fall back to `getCityCoordinates(city)`, then to Madrid.
- `id` becomes `wallapop-<id>`; `url` becomes
  `https://es.wallapop.com/item/<web_slug>`.

Wallapop is the **only** source whose coordinates are genuinely per-listing. The
other two are approximated to a city or province.

#### Known behaviour

Accumulated the hard way. None of it is discoverable from the response.

- **Results are biased toward the search centre**, regardless of
  `distance_in_km`. A Madrid-centred search returns mostly Madrid-area listings
  even at a 1000 km radius.
- **`distance_in_km` is also a hard bound, including across pagination.**
  Probed live 2026-08-12: Madrid + 50 km over six `next_page` pages returned
  zero listings beyond the radius, and a rare-brand query exhausted at 16
  local items rather than padding with far-away ones. Far results in the
  merged UI therefore never come from this source.
- **`distance_in_km > 2000` returns 400.** Values up to 2000 do not meaningfully
  widen the result set beyond the local area — the proximity bias dominates.
- **`/api/v3/cars/search` is a trap.** The old endpoint returns randomised
  coordinates and wrong data. Coordinates from `search/section` are accurate. Do
  not use it, however plausible its name looks.
- **A city-centre fan-out was tried and rejected.** Firing parallel requests from
  ten Spanish city centres and deduplicating by id yields ~400 items across ~86
  cities. It works; it was not wanted. Do not rebuild it without asking.

#### Failure handling

The proxy wraps the upstream call in `try`/`catch` and returns
`{ error }` with status 502 on a rejected fetch, or the upstream status when the
response is not ok. A dropped connection is routine against an API we do not
control — without the catch it escapes the handler and Next answers with an
unhandled 500 instead of the shape every caller expects.

Client-side, a rejection from `searchWallapop` is absorbed by
`Promise.allSettled` in `useListingsSearch`, so the other two sources still
render.

#### Images

`cdn.wallapop.com`, allowed in `next.config.ts` via `**.wallapop.com`. A fixture
image URL in a test must use an allowed host or `next/image` throws.

### coches.net

Reverse-engineered, like the other two. A Schibsted property, which shows in the
API design: it is a clean JSON gateway with numeric taxonomy ids for everything.

#### The endpoints

| Purpose | Upstream | Proxied at |
| --- | --- | --- |
| Search | `POST https://web.gw.coches.net/search/listing` | `/api/cochesnet/search` |
| Models for a make | `GET https://web.gw.coches.net/models?makeId=` | `/api/cochesnet/models` |

**One mandatory header**, added by the proxy:

```
X-Schibsted-Tenant: coches
```

Search is a **POST with a JSON body**, not a query string — the only source that
works this way.

#### Request

Built by [`lib/cochesnet/client.ts`](../../lib/cochesnet/client.ts):

```json
{
  "pagination": { "page": 1, "size": 40 },
  "sort": { "order": "desc", "term": "relevance" },
  "filters": { }
}
```

| Shared filter | coches.net filter |
| --- | --- |
| keywords | `searchText` |
| price / year / km / power | `price`, `year`, `km`, `hp` — each `{ from, to }`, nulls allowed |
| fuel | `fuelTypeIds: number[]` |
| transmission | `transmissionTypeId: number` |
| brand / model | `vehicles: [{ makeId, modelId }]` |

**The vehicle filter is flat.** `vehicles: [{ makeId, modelId }]` — not nested
under a make object, which is the shape you would guess.

**Location is not sent.** coches.net filters by province name on their side, and
there is no lat/lng parameter. Distance and coordinates from the shared filter
set are simply dropped for this source.

**Recency is not wired.** There is no `time_filter` equivalent in use; ordering
falls back to the site default.

**Filters are strict — exhausted results are not padded.** Probed live
2026-08-12: `BMW` capped at 300 € returned exactly 3 matching items and
`totalResults: 3`, no "related" filler. A narrow filter set returns fewer
results, never different ones.

##### Taxonomy translation

The shared filter set speaks Wallapop's vocabulary, so everything has to be
mapped:

- [`lib/cochesnet/taxonomy.ts`](../../lib/cochesnet/taxonomy.ts) — brand name →
  `makeId`, and Wallapop fuel/transmission tokens → coches.net numeric ids.
- [`lib/cochesnet/models.ts`](../../lib/cochesnet/models.ts) — model **name** →
  `modelId`, resolved against `GET /models?makeId=`.

The model dropdown stores the model *name*, because Wallapop uses the name as its
own option id. That happens to make the shared value source-agnostic: coches.net
resolves the name to a number, Milanuncios folds it into free text.

**No exact name match means make-only filtering**, not an empty result. A model
this source does not recognise degrades the search rather than breaking it.

**A failed model fetch is deliberately not cached.** `modelsByMake` is a
module-level `Map` with no expiry, so caching an empty list on a transient blip
would disable model filtering for that make until the page reloaded, with nothing
ever retrying. This was a real bug.

#### Response

```
items[]
  id
  title
  url                       (path only — prefix with https://www.coches.net)
  make | model
  price.amount
  km | year | fuelType
  resources[].{ type, url }  (type "IMAGE")
  location.{ cityLiteral, mainProvince, mainProvinceId }
meta.totalPages
```

#### Normalisation

[`lib/cochesnet/normalize.ts`](../../lib/cochesnet/normalize.ts):

- `id` becomes `cochesnet-<id>`; `url` is a path and gets the origin prefixed.
- Image is the first `resources[]` entry of type `IMAGE`, else the first
  resource, else empty.
- `subtitle` is `make + model` joined — this source has no free-text description
  to trim, unlike Wallapop.

##### Items carry no coordinates

The single most important fact about this source. Every listing has to be placed
on the map by name, in [`lib/cochesnet/geo.ts`](../../lib/cochesnet/geo.ts):

1. Exact city name via `getCityCoordinates(cityLiteral)`
2. Province name via `getCityCoordinates(mainProvince)`
3. **Province-capital centroid** keyed by `mainProvinceId` — the INE province
   code, 1–52, hardcoded as a full table
4. Spain centre (40.0, −3.5)

So **coches.net pins are city- or province-level approximations, not real
positions.** Two listings in the same province can land on the exact same
coordinate. Anything that treats marker position as meaningful — clustering,
distance sorting, "cars near this pin" — has to account for that.

#### Failure handling

Same shape as the other proxies: `try`/`catch` around the upstream fetch, `502`
with `{ error }` on rejection, upstream status passed through otherwise. The
models route additionally returns `400` when `makeId` is absent.

#### Images

`**.ccdn.es`, allowed in `next.config.ts`.

### Milanuncios

The most fragile of the three, and the only one that is genuinely **scraping**
rather than calling an undocumented API.

#### There is no API

Milanuncios exposes no JSON search endpoint. The cars search page is
server-rendered HTML with the results embedded in a script tag:

```js
window.__INITIAL_PROPS__ = JSON.parse("{…escaped json…}")
```

[`app/api/milanuncios/search/route.ts`](../../app/api/milanuncios/search/route.ts)
fetches that page server-side and returns the extracted node as clean JSON, so
the client never knows the difference.

**Browser-like headers are required.** The site gates datacenter IPs behind bot
protection, so the proxy sends a full desktop Chrome `User-Agent`, an HTML
`Accept`, and `Accept-Language: es-ES`. A bare `fetch` gets blocked.

This is the source most likely to break without warning: any change to the page's
script layout kills it, and unlike a JSON contract there is nothing to version.

#### Request

The make is selected by **URL path**, everything else by query string. Built in
[`lib/milanuncios/client.ts`](../../lib/milanuncios/client.ts):

```
https://www.milanuncios.com/<make-slug>/?palabras=…&desde=…
```

| Shared filter | Milanuncios parameter |
| --- | --- |
| brand | path slug — `audi-de-segunda-mano`, or `coches-de-segunda-mano` for all |
| keywords **+ model** | `palabras` |
| price | `desde`, `hasta` |
| year | `anod`, `anoh` |
| mileage | `kilometersFrom`, `kilometersTo` |
| power | `engineHpFrom`, `engineHpTo` |
| fuel | `fuels` (comma-joined tokens) |
| transmission | `cajacambio` |
| pagination | `pagina` (omitted on page 1) |

Two consequences of that mapping:

- **There is no structured model filter**, so the model name is folded into the
  free-text `palabras` alongside the keywords. Results skew toward the model
  rather than being filtered to it. Quantified live 2026-08-12:
  `palabras=A110` under the Alpine slug returned 49 ads of which roughly one
  in four never mentions A110 (mostly A290s) — fuzzy text match, not a
  filter. Structured params are honoured strictly, though: with `hasta=300`,
  zero of 41 ads exceeded the price cap.
- **There is no location or distance filter at all.** Coordinates are dropped for
  this source.

**The make slug is mechanical**, not a lookup table:
`<name>-de-segunda-mano`, lowercased, accents stripped, non-alphanumerics
collapsed to hyphens. Every brand in the app's list was verified against live
data to match that rule, which is why
[`lib/milanuncios/taxonomy.ts`](../../lib/milanuncios/taxonomy.ts) has no
per-brand overrides. A brand added later needs checking.

#### Parsing

[`lib/milanuncios/parse.ts`](../../lib/milanuncios/parse.ts) extracts the props
node without `eval`:

1. Find `window.__INITIAL_PROPS__`, then the `JSON.parse(` after it.
2. Read the double-quoted JS string literal, respecting backslash escapes.
3. **Decode twice** — the literal is a JSON string whose *content* is itself
   JSON.
4. Read `adListPagination.adList.ads` and `adListPagination.pagination`.

Every failure at every step returns an empty result rather than throwing. This is
scraped external data: only the node actually consumed is typed, and every field
is read through optional chaining.

#### Response

```
ads[]
  id | title | description | url
  price.cashPrice.value
  images[]                      (scheme-less URLs)
  category.name                 (the make)
  location.{ city, province }
  tags[].{ type, text }         (Spanish labels)
  isReserved
pagination.{ page, resultsPerPage, totalAds, totalPages }
```

#### Normalisation

[`lib/milanuncios/normalize.ts`](../../lib/milanuncios/normalize.ts). Three
things here exist nowhere else:

**Numbers live in display strings.** Mileage, year and fuel are not fields — they
are entries in `tags[]` keyed by a **Spanish label** (`kilómetros`, `año`,
`combustible`) holding text like `"76.852 kms"`. They are parsed by stripping
non-digits, so `"76.852 kms"` → `76852`. Anything unparseable becomes `0`, which
is this codebase's "unknown" for numeric listing fields.

**Images need a size rule.** Photo URLs arrive without a scheme
(`images.milanuncios.com/api/v1/ma-ad-media-pro/images/<id>`). The normalizer
prepends `https://` and appends `?rule=hw396_70` — the rule the site's own result
cards use. **Without a rule the image API 404s.**

**Model is always empty.** Milanuncios results carry no structured model; it
exists only inside the title text. `CarListing.model` is left `""` for this
source rather than guessed at.

Reserved ads are filtered out: an ad is kept when `isReserved` is null or
`"RELEASED"`.

##### No coordinates

Like coches.net, and resolved the same way in
[`lib/milanuncios/geo.ts`](../../lib/milanuncios/geo.ts): city name → province
name → **province-capital centroid by INE code** (the same 1–52 table) → Spain
centre.

The two province tables are duplicated deliberately-ish rather than shared. If
you touch one, check the other.

#### Failure handling

`try`/`catch` around the page fetch, `502` with `{ error }` on rejection,
upstream status passed through otherwise. A parse failure is **not** an error —
it returns zero ads, so a layout change degrades this source to empty rather than
failing the whole search.

That is the right trade-off for a scraper, but it has a cost worth knowing:
**Milanuncios going quietly empty looks identical to Milanuncios having no
matches.** The contract test is what distinguishes them.

## Decisions and rationale

### About this spec

> **This is a backfill.** The code exists and works. This area turned out to be
> the best-tested in the project — roughly eighty existing tests across three
> source integrations, five proxy routes and three contract suites. The spec
> found four gaps rather than the dozen Wave A produced, and two of them are
> defects. See Open questions.

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

## Open questions

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
