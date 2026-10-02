# 0016 — Server search action, and the frontend's move onto the core

Status: Accepted · Date: 2026-10-02 · Resolves ADR 0007 row 19 (and begins rows 20, 21, 28)

## Context

[ADR 0007](0007-adopt-core-rules.md) row 19 named the deviation: search fanned out from
`lib/hooks/useListingsSearch.ts` to three browser-bound fetchers, each calling its own proxy route
(`app/api/wallapop/search`, `app/api/cochesnet/search`, `app/api/milanuncios/search`), with two more
proxies for car models. The alert runner (`server/alerts/search.ts`) could not reuse any of it — the
fetchers resolve their URL against `window.location.origin` — so it kept a second, parallel fan-out
against the same three upstreams. [docs/specs/core-frontend.md](../specs/core-frontend.md) (FRONT-1
through FRONT-7) is the spec; this records the decisions behind it.

## Decided

**One server-side fan-out, not three browser fetches and a second server-side copy.**
`server/search/service.ts` exports `searchRound(input, cursors, options?)`: it runs Wallapop,
coches.net and Milanuncios in parallel with `Promise.all`, reusing the pure query builders
(`buildWallapopQuery`, `buildCochesNetFilters`, `buildMilanunciosQuery`) that used to live only in
the browser-bound clients. A failing source is reported in `failedSources` with its cursor left
unchanged, rather than failing the round — the same partial-failure tolerance the old browser path
had, now in one place. `server/alerts/search.ts`'s `searchAllSources` calls the same `searchRound`,
passing the two overrides the poller needs (`wallapopOrderBy: "newest"`, `cochesNetSortTerm:
"publishedDate"`) that the interactive search does not — see `docs/specs/alerts.md`.

**One Server Action per search round, not one per source.** Next runs Server Actions serially per
client, so three separate actions would serialise the sources a single action can run in parallel
on the server. `server/search/actions.ts`'s `searchListings(input, cursors)` validates the input
(`lib/search/schema.ts`) and the cursors (`server/search/schema.ts`), rate-limits per client IP
(`server/rate-limit/service.ts`, 120 rounds/minute, key `search:<ip>`), calls `searchRound` once, and
applies the merge post-filters (`lib/listings/merge.ts`'s `applyResultFilters`) before returning.
`listCarModels(make)` replaces the two model proxies the same way, calling
`server/search/service.ts`'s `fetchModelsForMake` directly.

**The five proxy routes are deleted**, along with the browser-bound fetchers that called them
(`searchWallapop`, `searchCochesNet`, `searchMilanuncios`, `lib/wallapop/filters.ts`,
`lib/cochesnet/models.ts`'s fetch). The pure query builders they wrapped stay, reused by
`server/search/service.ts`. `lib/hooks/useListingsSearch.ts` and `lib/hooks/useCarModels.ts` call
the two Server Actions instead.

**Nominatim stays in the browser** (`lib/geo/nominatim.ts`). Its usage policy is per client;
routing every user's geocoding through the server's one IP would exhaust it in a way a shared
marketplace proxy does not have to worry about, since it serves far more requests than a single
free-tier geocoder allows. It is also public, read-only location data, not a marketplace guarding
against scraping — the "never call a marketplace from the browser" rule (ADR 0003) does not cover
it, and the CSP already allows the host.

**The locale stays in a cookie**, resolved per request rather than from a URL prefix.
`i18n/request.ts`'s `resolveLocale(cookieValue, acceptLanguage)` is a pure function: a known
`locale` cookie value wins; absent, `Accept-Language` is checked for English and falls back to
Spanish (`lib/i18n/config.ts`'s `DEFAULT_LOCALE`) otherwise; an unrecognised cookie value is treated
as absent rather than resolving to itself. No link or bookmark breaks, because no URL changes.
`setLocale` keeps writing the same cookie it does today. A `tz` cookie, written once per browser by
a tiny client component in the root layout from `Intl.DateTimeFormat().resolvedOptions().timeZone`,
carries the time zone the same way — absent, the fallback is UTC rather than a guess.

**`next-intl/plugin` is not wired into `next.config.ts`.** The plugin
(`createNextIntlPlugin`) only sets `turbopack.resolveAlias["next-intl/config"]` (and the
equivalent `webpack` alias, which this config has no use for — it defines no custom `webpack()`)
to the request-config file, so that `next-intl/server`'s `getRequestConfig` import resolves. It
does this by eagerly requiring `@swc/core` to parse the config file, whose native addon refuses to
load on this machine: `C:\Users\alexe\AppData\Local` carries an inherited ACE granting an
AppContainer SID access, which trips a cache-ownership check in `@swc/core`'s binding. That ACL is
OS security configuration, out of scope to change. `next.config.ts` sets the same
`turbopack.resolveAlias` entry directly instead, which is the only effect that matters here — this
app never needs the plugin's other behaviour (reading `./messages/*.json` for IDE tooling, in
particular, since the request config already imports them directly). `pnpm-workspace.yaml`'s
`allowBuilds` does not need `@swc/core` or `@parcel/watcher` for this — they were added while
chasing the plugin's failure and are not needed with it unwired.

## What it beat

A second alert-runner-style fan-out kept in sync with the interactive one by hand, which is what
the deviation this ADR resolves actually was — two independent implementations of "ask three
upstreams for cars," agreeing only by discipline. One Server Action per source was also considered
and rejected: Next's serial-per-client execution of Server Actions would have turned three
parallel browser fetches into three serial server round trips, which is slower than before.

**e2e stubs a mock upstream server, not the browser.** `page.route()` stubbed
the old proxy routes in the browser; now that the fetch happens inside the
Server Action, on the server, the browser never sees the request to stub.
`lib/env.ts` gains three optional base-URL vars (`WALLAPOP_API_BASE_URL`,
`COCHESNET_API_BASE_URL`, `MILANUNCIOS_BASE_URL`), defaulting to the real
hosts, that `server/search/service.ts` builds its upstream URLs from.
`e2e/fixtures/upstream-server.ts` is a plain `node:http` server serving the
same fixtures the old `page.route()` stubs did, behind a scenario switch
(`POST /__scenario`); `playwright.config.ts` runs it as its own `webServer`
entry on a fixed port and points the three base-URL vars at it, so a
Playwright run never reaches a real marketplace. See
`docs/ARCHITECTURE.md` › Testing › End-to-end for the full shape.

## What it costs

A Server Action is a public endpoint with no visible URL, so `searchListings` and `listCarModels`
carry their own validation and rate limiting rather than inheriting a route handler's. The rate
limit is per IP, same as the proxies had nothing at all — this is strictly tighter, not weaker.

## What would change our mind

A fourth upstream source that needs its own Server Action shape would be a reason to reconsider
whether `searchRound`'s fixed three-source shape still fits.

## See also

- [docs/specs/core-frontend.md](../specs/core-frontend.md) — FRONT-1 through FRONT-7, FRONT-9
- [docs/specs/alerts.md](../specs/alerts.md) — the poller's overrides on the shared fan-out
- [docs/specs/data-sources.md](../specs/data-sources.md) — the upstream contracts
  `server/search/service.ts` now owns
- [0001](0001-no-data-fetching-library.md), [0003](0003-proxy-routes.md) — superseded by this ADR
