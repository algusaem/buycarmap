# coches.net

Reverse-engineered, like the other two. A Schibsted property, which shows in the
API design: it is a clean JSON gateway with numeric taxonomy ids for everything.

Behaviour guarantees are in [`../specs/data-sources.md`](../specs/data-sources.md).

## The endpoints

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

## Request

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

### Taxonomy translation

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

## Response

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

## Normalisation

[`lib/cochesnet/normalize.ts`](../../lib/cochesnet/normalize.ts):

- `id` becomes `cochesnet-<id>`; `url` is a path and gets the origin prefixed.
- Image is the first `resources[]` entry of type `IMAGE`, else the first
  resource, else empty.
- `subtitle` is `make + model` joined — this source has no free-text description
  to trim, unlike Wallapop.

### Items carry no coordinates

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

## Failure handling

Same shape as the other proxies: `try`/`catch` around the upstream fetch, `502`
with `{ error }` on rejection, upstream status passed through otherwise. The
models route additionally returns `400` when `makeId` is absent.

## Images

`**.ccdn.es`, allowed in `next.config.ts`.
