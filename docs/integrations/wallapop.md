# Wallapop

Reverse-engineered. There is no public API, no documentation and no agreement
that any of this keeps working — the nightly contract test is the alarm.

What we *guarantee* about this source is in
[`../specs/data-sources.md`](../specs/data-sources.md). This page is about what
Wallapop actually does.

## The endpoints

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

## Request

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
behaviour above. See SRC-16 in [`../specs/data-sources.md`](../specs/data-sources.md).

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

### Coordinates are always sent

Even when the user has chosen no location. The fallback chain is **explicit
location → browser geolocation → Spain centre (40.0, −3.5)**, with
`distance_in_km` defaulting to 1000 when there is no explicit location.

This is not a nicety. Without coordinates Wallapop geo-filters by the caller's IP
— and in production that is a Vercel server in the United States, so a Spanish
user would get American listings. The bug is invisible locally, where your own IP
is Spanish.

## Response

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

## Normalisation

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

## Known behaviour

Accumulated the hard way. None of it is discoverable from the response.

- **Results are biased toward the search centre**, regardless of
  `distance_in_km`. A Madrid-centred search returns mostly Madrid-area listings
  even at a 1000 km radius.
- **`distance_in_km > 2000` returns 400.** Values up to 2000 do not meaningfully
  widen the result set beyond the local area — the proximity bias dominates.
- **`/api/v3/cars/search` is a trap.** The old endpoint returns randomised
  coordinates and wrong data. Coordinates from `search/section` are accurate. Do
  not use it, however plausible its name looks.
- **A city-centre fan-out was tried and rejected.** Firing parallel requests from
  ten Spanish city centres and deduplicating by id yields ~400 items across ~86
  cities. It works; it was not wanted. Do not rebuild it without asking.

## Failure handling

The proxy wraps the upstream call in `try`/`catch` and returns
`{ error }` with status 502 on a rejected fetch, or the upstream status when the
response is not ok. A dropped connection is routine against an API we do not
control — without the catch it escapes the handler and Next answers with an
unhandled 500 instead of the shape every caller expects.

Client-side, a rejection from `searchWallapop` is absorbed by
`Promise.allSettled` in `useListingsSearch`, so the other two sources still
render.

## Images

`cdn.wallapop.com`, allowed in `next.config.ts` via `**.wallapop.com`. A fixture
image URL in a test must use an allowed host or `next/image` throws.
