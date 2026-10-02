# 0003 — Proxy routes for every source

> **Superseded by [0016](0016-server-search-and-next-intl.md).** The five route handlers this ADR
> describes (`app/api/wallapop/*`, `app/api/cochesnet/*`, `app/api/milanuncios/*`) are deleted.
> The upstream headers and error contract this ADR won still apply — they moved into
> `server/search/service.ts`, called from a Server Action instead of a route handler, since the
> browser still cannot reach these upstreams directly for the reasons below.

## Decided

The browser never calls Wallapop, coches.net or Milanuncios. Every source is
reached through a Next.js route handler under `app/api/<source>/`, which adds the
headers the upstream demands and returns JSON.

Route handlers exist **only** for this and for webhooks. Mutations are server
actions.

## What it beat

Calling the upstreams directly from the client, which would remove a network hop
and a deployment's worth of egress.

It is not merely worse — it does not work:

- **Wallapop** is behind CloudFront and requires `x-deviceos: 0` and
  `x-appversion: 85000`. Without them, 403. CORS blocks the request before that
  anyway.
- **coches.net** needs `X-Schibsted-Tenant: coches` and is a cross-origin POST.
- **Milanuncios** has no API at all. The response is an HTML page whose results
  live in `window.__INITIAL_PROPS__`, and the site gates datacenter IPs behind
  bot protection that a plain `fetch` trips.

So the proxy is not a design preference. It is the only thing that works.

## What it bought, beyond making it possible

Three things fall out of the layer existing, and they are worth knowing because
they explain code that would otherwise look redundant:

1. **A uniform error contract.** Every proxy returns `{ error }` with the
   upstream status, or 502 on a rejected fetch. Four of the five originally
   lacked the `try`/`catch`, so a dropped connection escaped the handler and Next
   answered with an unhandled 500 instead — the clients could not distinguish it
   from anything else.
2. **Secrets stay server-side**, which matters the moment a source needs a key.
3. **CSP stays tight.** Because listings are proxied through this origin, the
   `connect-src` allowlist only needs Nominatim.

## What it costs

The server's IP becomes the caller, and **Wallapop geo-filters by caller IP**. In
production that is a Vercel server in the United States, so a Spanish user would
get American listings. The fix is that the client always sends coordinates —
explicit location, then browser geolocation, then Spain centre — which is why
`searchWallapop` sends lat/lng even when the user chose no location.

This is invisible locally, where your own IP is Spanish. It was a real bug.

## What would change our mind

- A source publishing a real, CORS-enabled public API with documented terms.
  That source could go direct; the rest would stay proxied.
- Egress cost becoming material, which at this traffic it is not.

## See also

- [specs/data-sources.md › Wallapop](../specs/data-sources.md#wallapop)
- [specs/data-sources.md › coches.net](../specs/data-sources.md#cochesnet)
- [specs/data-sources.md › Milanuncios](../specs/data-sources.md#milanuncios)
