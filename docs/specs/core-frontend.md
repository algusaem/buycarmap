# Frontend: data flow, i18n, URL state, feedback and design tooling (migration phase 9)

Key: FRONT
Status: Implemented
Last updated: 2026-10-31

---

## Problem

The frontend predates the core and deviates from it in four places (`docs/decisions/0007-adopt-core-rules.md` rows 19, 20, 21, 28):

- **Reads go through the browser.**
  - The search fans out from `lib/hooks/useListingsSearch.ts` to three route-handler proxies (`app/api/wallapop/search`, `app/api/cochesnet/search`, `app/api/milanuncios/search`). Each source is a separate request per round.
  - Car models come from two more proxies (`app/api/wallapop/filters/models`, `app/api/cochesnet/models`), called from effects.
  - The browser-bound fetchers resolve URLs against `window.location.origin`. So the server cannot reuse them, and the alert runner keeps a second fan-out in `server/alerts/search.ts` (`RULES.md` §9, `STACK.md` §6).
- **Hand-rolled i18n, URL state and formatting.**
  - `lib/i18n/*` is hand-rolled, with Spanish as the source language and about 500 keys used by 44 files.
  - The filters' URL state is hand-rolled.
  - There are no shared date, number or currency formatters.
  - `STACK.md` §1 and §14 ask for next-intl with English as the source, nuqs and date-fns.
- **Errors use the wrong channel.** There are 25 `toast.error` calls, and some of them report failed reads. `STACK.md` §14 puts read errors inline with a retry, and keeps toasts for background outcomes.
- **No design tooling, and contrast is unchecked.**
  - Impeccable is not installed: no package, skill, hook, config, `PRODUCT.md` or `DESIGN.md` (`STACK.md` §17).
  - The axe check in `e2e/a11y.spec.ts` disables `color-contrast` (`RULES.md` §22 item 3).

This is phase 9 of ADR 0007, rows 19, 20, 21 and 28, delivered in one PR (owner's decision, 2026-10-01).

## Acceptance criteria

`unit` means a Vitest test with no database; `node` means a `*.node.test.ts` or `*.integration.test.ts`; `component` means a component test with `renderWithI18n`; `e2e` means Playwright.

### Data flow

- [x] FRONT-1 · node — `server/search/service.ts` owns the only server-side fan-out.
  - One call runs one search round: Wallapop, coches.net and Milanuncios, in parallel, from the server.
  - Each source gets its own cursor or page, and the call returns each source's next cursor or page and its has-more flag.
  - The upstream query builders in `lib/*/client.ts` are reused. **Wallapop coordinates are always sent** (`CLAUDE.md` › Upstream sources).
  - A failing source does not fail the round: its error is reported per source, as today.
- [x] FRONT-2 · node — `server/search/actions.ts` exports `searchListings(input, cursors)`, a Server Action.
  - It validates its input with `lib/search/schema.ts`.
  - It calls the service once, and returns the round's listings after the merge post-filters (`lib/listings/merge.ts`), the next cursors, and the failed sources.
  - It is rate-limited per client IP through `server/rate-limit/service.ts` at 120 rounds per minute, returning the code `rateLimited` when exceeded.
- [x] FRONT-3 · unit — `lib/hooks/useListingsSearch.ts` keeps the request lifecycle and the "fetch until a round yields a listing or the sources run out" loops (MAP-19), but each round is now one `searchListings` call instead of three fetches. MAP-1..22 pass unchanged except for their network setup, which mocks the action instead of MSW proxy handlers.
- [x] FRONT-4 · node — `server/search/actions.ts` also exports `listCarModels(make)`, which returns the merged Wallapop and coches.net models for a make, given as the UI's brand label (`"Seat"`). `lib/hooks/useCarModels.ts` calls it instead of the two model proxies.
- [x] FRONT-28 · node — `listCarModels` is rate-limited per client IP through `server/rate-limit/service.ts`, the same way `searchListings` is, at 120 calls per minute, returning the code `rateLimited` when exceeded (issue #96). The PLAT-27 Zod parse of `make` still runs first; the budget is consumed after it and before the upstream calls, matching `searchListings`' order.
- [x] FRONT-5 · unit — The five proxy route handlers under app/api/wallapop/, app/api/cochesnet/ and app/api/milanuncios/ are deleted. So are the browser-bound fetchers that call them: `searchWallapop`, `searchCochesNet`, `searchMilanuncios`, lib/wallapop/filters.ts and lib/cochesnet/models.ts's fetch. A test fails on any file under `lib/` or `components/` that references `/api/wallapop`, `/api/cochesnet` or `/api/milanuncios`.
- [x] FRONT-6 · node — `server/alerts/search.ts` runs its searches through `server/search/service.ts`, so there is one fan-out. The ALERT criteria that cover the runner's search pass unchanged.
- [x] FRONT-7 · unit — Location search keeps calling Nominatim from the browser (`lib/geo/nominatim.ts`). The ADR records why: Nominatim's usage policy limits each client, so routing every user through the server's single IP would exhaust it, and the data is public and not a marketplace.

- [x] FRONT-22 · e2e — No Playwright run reaches a real marketplace.
  - Now that the search runs on the server, `page.route()` can no longer stub it. The upstream base URLs (Wallapop, coches.net, Milanuncios) become optional env vars in `lib/env.ts`, defaulting to the real hosts.
  - Playwright's `webServer` points them at a local mock upstream server that `e2e/global-setup.ts` starts. It serves the e2e fixtures and exposes a per-test scenario switch.
  - Every spec that stubbed the proxies with `page.route()` uses that server instead. A test fails if any e2e file still routes `/api/wallapop`, `/api/cochesnet` or `/api/milanuncios`.
  - Production never sets the variables.
- [x] FRONT-25 · unit — A local Playwright run never adopts a server it did not start: neither `webServer` entry (the mock upstream server and `pnpm dev`) reuses an existing server. If a port is already taken, the run fails before any test runs, and `E2E_PORT` / `E2E_UPSTREAM_PORT` still move the ports (issue #82).

### i18n and formatting

- [x] FRONT-8 · unit — Copy lives in next-intl message files: `messages/en.json` (the source language) and `messages/es.json`. A test fails if a key exists in one file and not the other, or if a value is empty. lib/i18n/translations.ts, lib/i18n/client.tsx, lib/i18n/server.ts and the locale objects are removed.
- [x] FRONT-9 · node — The locale is resolved per request by next-intl's `getRequestConfig`, with no prefix in the URL.
  - The existing `locale` cookie decides it first; if there is none, `Accept-Language`, limited to `es` and `en`, falls back to `es`.
  - `setLocale` keeps writing that cookie and the user's saved locale.
  - Alert emails still use the recipient's saved locale.
- [x] FRONT-10 · component — Client components use `useTranslations` and server components use `getTranslations`. `test/utils/render.tsx` `renderWithI18n` wraps `NextIntlClientProvider` with the English messages, so the existing component tests keep querying English labels.
- [x] FRONT-11 · unit — `lib/format.ts` exports the only formatters: `formatPrice` (EUR), `formatNumber`, `formatMileage` (km) and `formatRelativeTime`, using date-fns with the locale. Components never format inline: a test fails on `toLocaleString`, `toFixed`, `new Intl.` or a date-fns `format` import in `components/` or `app/`. The time zone comes from next-intl's config and is never a literal in a component. (`formatDate`, an absolute-date formatter, was removed: nothing in the current UI shows an absolute date — alert matches show `foundAt` with `formatRelativeTime` instead — and an unused formatter is dead code, not a reason to keep one on spec alone.) — `formatNumber` removed, unused since F3; `formatPrice` always uses a thousands point, four-digit amounts included («9.500 €»), and is the only price formatter: the formatters are `formatPrice`, `formatMileage` and `formatRelativeTime` (MAPUI-57) (amended 2026-10-13, MAPUI — redesign-map.md) — `formatDate` comes back for «Creada el …» on the alerts pages: an absolute date, the day and the month in the page's locale and in next-intl's time zone, with the year only when it differs from the current year in that time zone («2 de octubre», «20 de diciembre de 2025»), so the formatters are `formatPrice`, `formatMileage`, `formatRelativeTime` and `formatDate` (amended 2026-10-15, ALERTUI-10 — redesign-alerts.md) — `formatMonth` (the account summary's «desde <mes>», the month in the page's locale and in next-intl's time zone, with the year only when it differs from the current year) and `formatDeviceLabel` (a session's «<navegador> en <sistema>») join them, so the formatters are `formatPrice`, `formatMileage`, `formatRelativeTime`, `formatDate`, `formatMonth` and `formatDeviceLabel` (amended 2026-10-16, PAGES — redesign-pages.md) — `formatMileage` always uses a thousands point, four-digit amounts included (amended 2026-10-31, MAPUI-82 — redesign-map.md)
- [x] FRONT-12 · unit — `translateAuthError`, `translateError` and every other code-to-copy helper resolve through next-intl's message keys, with the same fallbacks as today.

### URL state

- [x] FRONT-13 · e2e — The search filters, location and radius live in the URL through nuqs parsers in `lib/search/url-state.ts`. A filtered search deep-links, a reload restores it, and Back and Forward restore the previous filters and their results. The existing search e2e tests pass unchanged. — the search is set through the pill and the filters panel: the worked-example URL still parses, criteria the UI no longer offers still reach the search with no control for them (MAPUI-18), and the search e2e moves to the pill (MAPUI-49) (amended 2026-10-13, MAPUI — redesign-map.md) — the search is also set through the description field, which keeps its text in the URL as `q` (DESC-6, DESC-15) (amended 2026-10-31, DESC — map-description-search.md)

### Feedback channels

- [x] FRONT-14 · component — Every list has four states: loading (a skeleton that mirrors the cards), empty (written copy with the primary action), error (inline, with a Retry button that re-runs the read) and populated. The lists are the map's results list, `/favorites`, `/alerts` and `/alerts/[id]` matches. — on the map, loading adds the «Buscando coches…» status pill (MAPUI-30), empty is «¿Nada por aquí?» with «Ampliar a … km» and «Quitar filtros» (MAPUI-31), and error is «¿Se ha caído algo?» with «Reintentar» (MAPUI-32) (amended 2026-10-13, MAPUI — redesign-map.md) — on `/favorites`, loading mirrors the Guardados card and the compact row (SAVED-30), empty is «¿Aún nada?» with «Buscar coches» (SAVED-31), and the error is the route's page-error state, «¿Se ha roto algo?» with «Reintentar» and «Volver al mapa», in place of an inline one (SAVED-32) (amended 2026-10-15, SAVED — redesign-saved.md) — on `/alerts` and `/alerts/[id]`, loading mirrors the folded AlertCard, the alert page and its rows, with «Cargando…» on the desktop map (ALERTUI-38, ALERTUI-39); empty is «¿Sin alertas?» with «Buscar coches» on `/alerts` (ALERTUI-40) and «Sin coincidencias» with «Te avisaremos en cuanto salga un coche que encaje.» for an alert with no match (ALERTUI-41); and the error is the route's page-error state, «¿Se ha roto algo?» with «Reintentar» and «Volver al mapa», in place of an inline one (ALERTUI-42) (amended 2026-10-15, ALERTUI — redesign-alerts.md) — `/account`'s loading and error are PAGES-56 and PAGES-57 (amended 2026-10-16, PAGES — redesign-pages.md)
- [x] FRONT-15 · unit — A failed **read** is never a toast. A test fails on `toast.error` inside `lib/hooks/` or in a component's data-loading path. `toast.error` stays only for the failure of an action the user just clicked that has no form to put the error in: saving or removing a favorite, deleting an alert. Validation errors stay inline. — creating an alert from the map reports its outcome as a toast, «Alerta creada» or «Ya tienes esta alerta» (MAPUI-42, MAPUI-43); its failures stay inline in the dialog (MAPUI-45) (amended 2026-10-13, MAPUI — redesign-map.md) — the server's password rejections on `/register` are field errors, the expired or used link a page state (PAGES-16, PAGES-19, PAGES-24), and every other failure of a form on these pages, dialogs included, sits in the form, never a toast: a wrong password (PAGES-44, PAGES-55) and `rateLimited` or `generic` (PAGES-4, PAGES-71); the confirmed registration shows no toast (PAGES-15) (amended 2026-10-16, PAGES — redesign-pages.md)
- [x] FRONT-23 · e2e — A toast takes its colours from the design tokens: background `surface`, border `line`, text `text`, in the app's single dark theme (LOOK-14, `docs/specs/redesign-foundation.md`). The token classes carry Tailwind's important modifier because Sonner's unlayered styles otherwise beat Tailwind 4's `@layer utilities`. Any change to the toast's look is approved by the owner with screenshots on mobile and desktop (`RULES.md` §1, §17). (amended 2026-10-12, LOOK — redesign-foundation.md) — every toast sits where the Toast README draws it, 12px below the header (below the filter row on `/map`) — on `/map`, 12px under the header band, at 163px, since the filter row moved into it (SAVED-24 as amended, MAPUI-64) (amended 2026-10-17, #134) and centred over the list column on `/map` and `/favorites`, centred on the viewport elsewhere, 16px from the sides on the phone (SAVED-24), and its close button is «Cerrar aviso» (SAVED-36) (amended 2026-10-15, SAVED — redesign-saved.md)
- [x] FRONT-24 · component — Signing in shows no success toast. `LoginForm` (password, and password plus two-factor code) navigates with a full page load, which tears the toast down before it paints; the redirect and the signed-in navbar are the confirmation. The `auth.signInSuccess` message key is removed from both locales (owner's decision, 2026-10-05).

### Design tooling and accessibility

- [x] FRONT-16 · unit — Impeccable is set up exactly as `STACK.md` §17 steps 1–8 describe:
  - `impeccable@4.1.0` pinned;
  - the skill copied from tag `skill-v4.3.1` into `.claude/skills/impeccable/`, and its agents into `.claude/agents/`;
  - its hook merged into the committed `.claude/settings.json`, keeping the existing `require-branch-db` hook;
  - the `.gitignore` block added;
  - `.impeccable/config.json` created.

  `lint` runs `impeccable detect app components lib` (the root layout's equivalent of `src`) and fails on any finding. A test checks that the skill VERSION equals the package's engine version.
- [x] FRONT-17 · unit — `PRODUCT.md` exists, written from the `/impeccable init` interview with the owner, and `DESIGN.md` exists, from `/impeccable document` over the current theme. Both are at the root.
- [x] FRONT-18 · unit — `impeccable detect app components lib` reports zero findings. Every finding found at setup is fixed (owner's decision, 2026-10-01). A waiver in `.impeccable/config.json` exists only with the owner's approval and its reason.
- [x] FRONT-19 · e2e — `e2e/a11y.spec.ts` no longer disables `color-contrast`, and the main flows (`/`, `/map`, `/login`, `/register`, `/favorites`, `/alerts`, `/account`) pass axe with no serious or critical violation in the dark theme, `/` and `/login` at desktop and phone width (ENTRY-21), `/favorites` at desktop and phone width, with saved cars and with none (SAVED-33; amended 2026-10-15, SAVED — redesign-saved.md), `/alerts` at desktop and phone width with alerts and with none, and `/alerts/[id]` with matches and with none and with its confirmation open (ALERTUI-43; amended 2026-10-15, ALERTUI — redesign-alerts.md). Any token or colour that changes to get there is approved by the owner first (`RULES.md` §1, §17). (amended 2026-10-12, LOOK — redesign-foundation.md) — the routes of PAGES-58 and PAGES-70, at desktop and phone width (amended 2026-10-16, PAGES — redesign-pages.md)
- [x] FRONT-20 · e2e — Every surface whose look changed, through FRONT-14, FRONT-18 or FRONT-19, has Playwright screenshots on mobile and desktop, and the owner confirms them before the commit (`RULES.md` §22 item 5). — F6 owes them for `/alerts` and `/alerts/[id]` at 390×844, 1024×900 and 1440×900: populated, an alert open with more than four matches, with no place, paused, with no match, loading, empty and the page error, plus the car sheet and the confirmation sheet on the phone and the confirmation dialog on desktop (amended 2026-10-15, ALERTUI — redesign-alerts.md) — F7 owes them for every board frame (amended 2026-10-16, PAGES — redesign-pages.md)

### Fonts

- [x] FRONT-26 · unit — The app's two fonts are served from files committed in the repository under `app/fonts/` and loaded with `next/font/local`, not `next/font/google`: no build step downloads a font. The CSS variables are `--font-sans` (Rethink Sans, variable weight, latin subset) from `app/fonts/rethink-sans/rethink-sans-latin-wght-normal.woff2` and `--font-display` (Unbounded, variable weight, latin subset) from `app/fonts/unbounded/unbounded-latin-wght-normal.woff2`, each with its `OFL.txt` alongside; `--font-mono` is no longer required. A test reading `app/layout.tsx` fails if it imports `next/font/google`, or if either family's font files or `OFL.txt` are missing from `app/fonts/`. (amended 2026-10-12, LOOK — redesign-foundation.md)

### Motion

- [x] FRONT-29 · component — The app root renders every page inside a `MotionConfig` with `reducedMotion="user"` in `components/MotionProvider.tsx` (named export `MotionProvider`, rendered by `app/layout.tsx`), so Motion switches off transform and opacity animations for a user whose OS asks for reduced motion (`RULES.md` §17/§19, issue #9). (amended 2026-10-12, LOOK — redesign-foundation.md)

### Legal pages

- [x] FRONT-27 · component — The privacy page (`app/privacy/page.tsx`, copy in `legal.privacy` of `messages/en.json` and `messages/es.json`) names every processor in `docs/privacy/processors.md` and what each receives, in both locales, and states only what the app does: it keeps no search history, the criteria of an alert that another user's alert also uses outlive an account's deletion, every cookie the app sets is listed, and the Location section states that the server sends your coordinates to Wallapop with your search. The Cookies section no longer names the theme, which is no longer kept anywhere. Milanuncios stays named, because the server still sends it the filters on every round (issue #52). Each section stays one plain paragraph, so `components/legal/LegalContent.tsx` does not change (issues #22, #73). (amended 2026-10-12, LOOK — redesign-foundation.md) — `LegalContent` changes (the index, the anchors, the title); the content rules stay (amended 2026-10-16, PAGES — redesign-pages.md). — OpenFreeMap replaces CARTO in «Third-party services» / «Servicios de terceros» (amended 2026-10-19, MAPLIBRE — map-maplibre.md, MAPLIBRE-13).

### Docs

- [x] FRONT-21 · unit — The docs record the new data flow:
  - ADR 0016 records the search Server Action, deleting the proxies, Nominatim staying in the browser, and the cookie-based locale.
  - ADRs 0001 and 0003 are marked superseded by it.
  - `docs/ARCHITECTURE.md` › Frontend and the search fan-out section describe the new flow.
  - `CLAUDE.md` › Upstream sources and › Stack today no longer describe browser proxies.
  - `docs/specs/data-sources.md` › Contracts points at `server/search/service.ts`.
  - ADR 0007 rows 19, 20, 21 and 28 end with `Resolved in phase 9`.

## Worked examples

- **FRONT-1**: input "Seat Ibiza, ≤ 10 000 €, Madrid, 50 km", first round.
  - The three upstream requests start before any of them resolves.
  - The Wallapop request carries `latitude=40.4168&longitude=-3.7038`.
  - When coches.net answers 503, the round returns Wallapop's and Milanuncios's listings, `failedSources: ["Coches.net"]`, and a coches.net cursor that has not advanced.
- **FRONT-2**: the 121st round from one IP within a minute → `{ ok: false, error: { code: "rateLimited", messageKey: "searchErrors.rateLimited" } }`, and no upstream request is made.
- **FRONT-28**: the 121st `listCarModels` call from one IP within a minute → `{ ok: false, error: { code: "rateLimited", messageKey: "searchErrors.rateLimited" } }`, and no request reaches Wallapop's or coches.net's models endpoint. The 121st call from a different IP in the same window → allowed, because the budget is keyed per IP (`listCarModels:<ip>`).
- **FRONT-8**: `messages/en.json` has `favorites.empty` and `messages/es.json` does not → the test fails naming `favorites.empty`.
- **FRONT-9**:
  - cookie `locale=en` → English;
  - no cookie, `Accept-Language: fr-FR,en;q=0.8` → English;
  - no cookie, `Accept-Language: fr-FR` → Spanish.
- **FRONT-11**:
  - `formatPrice(12500, "es")` → `12.500 €`; `formatPrice(12500, "en")` → `€12,500`;
  - `formatPrice(9500, "es")` → `9.500 €` (MAPUI-57);
  - `formatMileage(84000, "es")` → `84.000 km`;
  - `formatMileage(9000, "es")` → `9.000 km` (MAPUI-82).
- **FRONT-13**: `/map?make=seat&maxPrice=10000&radius=50` loads with those filters applied. Changing `maxPrice` to 8000 and pressing Back returns to 10 000, with that search's results.
- **FRONT-14**: the search action rejects → the results list shows the error state and a "Retry" button, and no toast appears. Retry re-runs the same round.
- **FRONT-23**: signed in on `/map`, create an alert → the «Alerta creada» toast's computed `background-color` equals the computed value of `var(--surface)`, not `rgb(255, 255, 255)` (measured before the fix on sonner 2.0.7 and 2.0.8). Border and text match `var(--line)` and `var(--text)` the same way. It runs in the DB suite, since sign-in failures are no longer toasts (amended 2026-10-14, ENTRY-11 — redesign-entry.md).
- **FRONT-24**: valid credentials, no two-factor → `toast.success` is not called and `window.location.href` is set to the redirect target; valid credentials then a valid TOTP code → the same. `messages/en.json` and `messages/es.json` have no `auth.signInSuccess`.
- **FRONT-25** (issue #82): another application is already listening on port 3000 when the e2e run starts.
  - Before the fix (both `webServer` entries left `reuseExistingServer: !process.env.CI`): Playwright adopts that server. 50 tests fail and 16 pass, with `/map` landing on the other application's login page.
  - After the fix (`reuseExistingServer: false` on both entries): the run stops before any test with Playwright's "already used" error naming `http://localhost:3000`. Setting `E2E_PORT=3100` moves the app server off the occupied port and the suite runs: 66 passed, 0 failed.
- **FRONT-26**: `next build` while `fonts.googleapis.com` is unreachable, with `app/layout.tsx` still loading `Plus_Jakarta_Sans` and `JetBrains_Mono` via `next/font/google` → Turbopack aborts: "Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'" / "next/font/google queries have exactly one entry". Seen three times on 2026-10-09 (issue #86): PR #85's Check job `next build`, PR #76's E2E web server (passed only on re-run), and a local `pnpm build` in a worktree for PR #77. Correct result: the build completes and the pages render with Plus Jakarta Sans and JetBrains Mono, because both load from files committed in the repository with no network call.
- **FRONT-29** (issue #9): `ThemeProvider` renders, wrapping a probe component that reads `useContext(MotionConfigContext)` → the context's `reducedMotion` field is `"user"`.
- **FRONT-27** (issues #22, #73): the privacy page dated "7 July 2026" lists only Wallapop, coches.net, Milanuncios, Nominatim, CARTO and Neon; says "we save your search queries" and "save your searches", though nothing stores search history; says "When you delete your account, the associated data is removed", though shared alert criteria outlive it; and lists language and theme cookies, though the theme is in local storage and the time-zone cookie is missing. Correct result: `updated` and the six bodies below, word for word; the other sections stay as they are (amended 2026-10-14, ENTRY — redesign-entry.md: GitHub removed from the three bodies that named it, and `updated` moved to 14 October 2026; amended 2026-10-21, map-and-search.md MAP-35, MAP-36: `updated` moved to 21 October 2026).
  - The cookies the app sets, measured on 2026-10-11: `better-auth.session_token` (the session; `lib/auth/auth.ts`, `server/auth/actions.ts`); `better-auth.two_factor` (the two-factor sign-in step, 10 minutes, Better Auth's `twoFactor` plugin default); `better-auth.state` (OAuth sign-in, 5 minutes, Better Auth's default with database state storage); `locale` (one year, `lib/hooks/useLocaleSwitcher.ts`); `tz` (one year, `lib/geo/TimeZoneCookie.tsx`). Better Auth adds the `__Secure-` prefix to its own cookies over HTTPS. No `trust_device` cookie is set, because no call passes `trustDevice`, and no `session_data` cookie, because `cookieCache` is off.
  - EN `updated`: "21 October 2026". (amended 2026-10-21, map-and-search.md MAP-35, MAP-36)
  - EN "Information we collect": "If you create an account, we store your email address, an optional display name, and a securely hashed password — never the password itself. If you sign in with Google, we store the identifier of that account, the sign-in tokens it issues and the address of your profile picture. If you turn on two-factor authentication, we store its secret in encrypted form. We also store the listings you save as favourites, the alerts you create with their search criteria (including any location you chose or, if the search started from “Your location”, your approximate location), your language so emails reach you in it, and, for each signed-in session, the IP address and browser it came from, so you can see and end your sessions from your account page. We do not keep a history of your searches. To protect the service from abuse, we process your IP address and, when you sign in or ask for a password reset, your email address." (amended 2026-10-21, map-and-search.md MAP-35, MAP-36)
  - EN "How we use your data": "We use your data to provide the service: to authenticate you, keep you signed in, keep your favourites and alerts, send you account and alert emails, protect the service from abuse, and improve how BuyCarMap works. We do not sell your personal data."
  - EN "Cookies": "We use only the cookies the app needs to work: one that keeps you signed in; while you sign in, a short-lived one for the two-factor step (10 minutes) or for signing in with Google (5 minutes); and two that remember your language and your time zone for one year. We do not use advertising or analytics cookies."
  - EN "Third-party services": "We rely on these external providers, and each receives only what it needs: Neon (database hosting) stores everything we keep; Vercel (hosting) receives every request, including your IP address; Resend (email delivery) receives your email address and the content of the emails we send you; Google (sign-in) receives your sign-in request, only if you choose to sign in with Google; Have I Been Pwned (leaked-password check) receives the first five characters of a one-way hash of a new password, never the password itself; Upstash (abuse protection) receives your IP address and a one-way hash of your email address, kept for at most one hour; Sentry (error reports) receives technical details of errors, without cookies, your IP address or your account details; OpenStreetMap / Nominatim (place search) receives the place you type, straight from your browser; OpenFreeMap (map tiles) receives tile requests straight from your browser, which show the area you are viewing; Wallapop (listings) receives your search filters and the coordinates of the search: the location you chose, your browser's position, or the centre of Spain; coches.net and Milanuncios (listings) receive your search filters. Our server sends the requests to Wallapop, coches.net and Milanuncios, so they see its address, not yours. Their handling of any data is governed by their own privacy policies."
  - EN "Data retention": "We keep your account data, favourites and alerts for as long as your account is active. A favourite or alert you remove is erased 30 days later. When you delete your account, its data is removed at once, except the search criteria of an alert that another user's alert also uses: those are kept, no longer linked to you, until no alert uses them. Unconfirmed sign-ups, password-reset and confirmation links, and abuse-protection records are deleted after they expire."
  - EN "Location": "To centre the map on you, we may ask your browser for your location. It is used to centre the map and to search near you, so our server sends its coordinates to Wallapop with your search. It is never stored on our servers unless you save it as part of an alert. You can decline, and we fall back to the centre of Spain."
  - ES `updated`: "21 de octubre de 2026". (amended 2026-10-21, map-and-search.md MAP-35, MAP-36)
  - ES "Información que recopilamos": "Si creas una cuenta, guardamos tu correo electrónico, un nombre opcional y una contraseña cifrada de forma segura, nunca la contraseña en sí. Si inicias sesión con Google, guardamos el identificador de esa cuenta, los tokens de inicio de sesión que emite y la dirección de tu foto de perfil. Si activas la verificación en dos pasos, guardamos su clave secreta cifrada. También guardamos los anuncios que marcas como favoritos, las alertas que creas con sus criterios de búsqueda (incluida la ubicación que elijas o, si la búsqueda partía de «Tu ubicación», tu ubicación aproximada), tu idioma para enviarte los correos en él y, por cada sesión iniciada, la dirección IP y el navegador desde los que se abrió, para que puedas ver y cerrar tus sesiones desde la página de tu cuenta. No guardamos un historial de tus búsquedas. Para proteger el servicio frente a abusos, tratamos tu dirección IP y, cuando inicias sesión o pides restablecer la contraseña, tu correo electrónico." (amended 2026-10-21, map-and-search.md MAP-35, MAP-36)
  - ES "Cómo usamos tus datos": "Usamos tus datos para prestar el servicio: autenticarte, mantener tu sesión, conservar tus favoritos y alertas, enviarte los correos de la cuenta y de las alertas, proteger el servicio frente a abusos y mejorar el funcionamiento de BuyCarMap. No vendemos tus datos personales."
  - ES "Cookies": "Usamos solo las cookies que la aplicación necesita para funcionar: una que mantiene tu sesión; mientras inicias sesión, otra de corta duración para el paso de verificación en dos pasos (10 minutos) o para entrar con Google (5 minutos); y dos que recuerdan tu idioma y tu zona horaria durante un año. No usamos cookies publicitarias ni de analítica."
  - ES "Servicios de terceros": "Nos apoyamos en estos proveedores externos, y cada uno recibe solo lo que necesita: Neon (alojamiento de la base de datos) almacena todo lo que guardamos; Vercel (alojamiento) recibe cada petición, incluida tu dirección IP; Resend (envío de correo) recibe tu correo electrónico y el contenido de los correos que te enviamos; Google (inicio de sesión) recibe tu solicitud de acceso, solo si decides entrar con Google; Have I Been Pwned (comprobación de contraseñas filtradas) recibe los cinco primeros caracteres de un hash irreversible de una contraseña nueva, nunca la contraseña; Upstash (protección frente a abusos) recibe tu dirección IP y un hash irreversible de tu correo electrónico, que se conservan como máximo una hora; Sentry (informes de errores) recibe datos técnicos de los errores, sin cookies, sin tu dirección IP y sin datos de tu cuenta; OpenStreetMap / Nominatim (búsqueda de lugares) recibe el lugar que escribes, directamente desde tu navegador; OpenFreeMap (teselas del mapa) recibe las peticiones de teselas directamente desde tu navegador, que revelan la zona que estás viendo; Wallapop (anuncios) recibe tus filtros de búsqueda y las coordenadas de la búsqueda: la ubicación que elegiste, la posición de tu navegador o el centro de España; coches.net y Milanuncios (anuncios) reciben tus filtros de búsqueda. Las peticiones a Wallapop, coches.net y Milanuncios las hace nuestro servidor, así que ven su dirección, no la tuya. El tratamiento que hagan de los datos se rige por sus propias políticas de privacidad."
  - ES "Conservación de datos": "Conservamos los datos de tu cuenta, tus favoritos y tus alertas mientras tu cuenta esté activa. Un favorito o una alerta que eliminas se borra 30 días después. Cuando eliminas tu cuenta, sus datos se borran en ese momento, salvo los criterios de búsqueda de una alerta que también usa la alerta de otro usuario: se conservan, ya sin vínculo contigo, hasta que ninguna alerta los use. Las altas pendientes de confirmar, los enlaces de restablecimiento y de confirmación y los registros de protección frente a abusos se borran después de caducar."
  - ES "Ubicación": "Para centrar el mapa en ti, podemos pedir a tu navegador tu ubicación. Se usa para centrar el mapa y buscar cerca de ti, así que nuestro servidor envía sus coordenadas a Wallapop junto con tu búsqueda. Nunca se guarda en nuestros servidores salvo que la guardes como parte de una alerta. Puedes no permitirlo y usaremos el centro de España."

## Data model

No change.

## Permissions

- `searchListings` and `listCarModels` are public, as the proxies are today, and rate-limited per IP.
- Every other action keeps its checks.

## Edge cases

- **Server Actions run one at a time per client.** One action per round keeps the three sources in parallel inside it. A second round waits for the first, which the hook's loop already does.
- **A user types faster than rounds finish.** The hook's version guard still discards stale responses (`CLAUDE.md` › Stack today).
- **JavaScript disabled.** The map needs JavaScript, as today.
- **Back pressed before the page has settled (FRONT-13).** nuqs 2.10.1, the latest release, clears its queued URL update on Back only once its `popstate` listener is registered, which happens in an effect after hydration. If a filter is changed and Back pressed before then, for example on a slow device while the first search runs, the URL moves back but the filters and results stay on the changed value until the next filter change. This is a known library limitation, accepted on 2026-10-05; the FRONT-13 test waits for the listener before exercising Back.
- **Unknown locale in the cookie.** Treated as absent.

## Out of scope

- **TanStack Table.** There are no data tables.
- **Moving the map to Server Components.** The map stays a client component; only its data flow changes.
- **Better Auth**: phase 11.
- **New features or copy rewrites** beyond what FRONT-14 and FRONT-18 require.

## Contracts

- **New dependencies**, all named in `STACK.md` §1: `next-intl`, `nuqs`, `date-fns`, `@date-fns/tz`, and `impeccable@4.1.0` (dev).
- **Configuration authorised by this spec**:
  - the `lint` script gains the Impeccable detector;
  - `.claude/settings.json` gains Impeccable's hook;
  - `.gitignore` gains Impeccable's block;
  - `e2e/a11y.spec.ts` drops the disabled rule;
  - `next.config.ts` gains the next-intl plugin.
- **Owner checkpoints inside the PR**, each blocking:
  1. the `/impeccable init` interview for `PRODUCT.md`;
  2. approval of any changed token or colour (FRONT-19);
  3. confirmation of the screenshots (FRONT-20).

## Decisions and rationale

### One PR for the whole phase (owner's decision, 2026-10-01)

The four rows ship together, with the owner checkpoints above inside the PR.

### One Server Action per search round (owner's decision, 2026-10-01)

Next runs Server Actions serially per client, so one action per source would serialise the three sources. A single action fans out in parallel on the server: one request per round instead of three, and the alert runner shares the same fan-out.

### The locale stays in a cookie (owner's decision, 2026-10-01)

URLs do not change, so no link or bookmark breaks. next-intl reads the cookie the app already writes.

### Fix every Impeccable finding (owner's decision, 2026-10-01)

The detector starts clean rather than starting from a list of waivers.

### Nominatim stays in the browser

Its usage policy is per client. Proxying it would put every user behind one IP and one rate limit. It is not a marketplace, so the "never from the browser" rule does not cover it, and CSP already allows it.
