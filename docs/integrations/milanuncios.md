# Milanuncios

The most fragile of the three, and the only one that is genuinely **scraping**
rather than calling an undocumented API.

Behaviour guarantees are in [`../specs/data-sources.md`](../specs/data-sources.md).

## There is no API

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

## Request

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

## Parsing

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

## Response

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

## Normalisation

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

### No coordinates

Like coches.net, and resolved the same way in
[`lib/milanuncios/geo.ts`](../../lib/milanuncios/geo.ts): city name → province
name → **province-capital centroid by INE code** (the same 1–52 table) → Spain
centre.

The two province tables are duplicated deliberately-ish rather than shared. If
you touch one, check the other.

## Failure handling

`try`/`catch` around the page fetch, `502` with `{ error }` on rejection,
upstream status passed through otherwise. A parse failure is **not** an error —
it returns zero ads, so a layout change degrades this source to empty rather than
failing the whole search.

That is the right trade-off for a scraper, but it has a cost worth knowing:
**Milanuncios going quietly empty looks identical to Milanuncios having no
matches.** The contract test is what distinguishes them.
