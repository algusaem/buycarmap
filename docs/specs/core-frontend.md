# Frontend: data flow, i18n, URL state, feedback and design tooling (migration phase 9)

Key: FRONT
Status: Implemented
Last updated: 2026-10-05

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
- [x] FRONT-11 · unit — `lib/format.ts` exports the only formatters: `formatPrice` (EUR), `formatNumber`, `formatMileage` (km) and `formatRelativeTime`, using date-fns with the locale. Components never format inline: a test fails on `toLocaleString`, `toFixed`, `new Intl.` or a date-fns `format` import in `components/` or `app/`. The time zone comes from next-intl's config and is never a literal in a component. (`formatDate`, an absolute-date formatter, was removed: nothing in the current UI shows an absolute date — alert matches show `foundAt` with `formatRelativeTime` instead — and an unused formatter is dead code, not a reason to keep one on spec alone.)
- [x] FRONT-12 · unit — `translateAuthError`, `translateError` and every other code-to-copy helper resolve through next-intl's message keys, with the same fallbacks as today.

### URL state

- [x] FRONT-13 · e2e — The search filters, location and radius live in the URL through nuqs parsers in `lib/search/url-state.ts`. A filtered search deep-links, a reload restores it, and Back and Forward restore the previous filters and their results. The existing search e2e tests pass unchanged.

### Feedback channels

- [x] FRONT-14 · component — Every list has four states: loading (a skeleton that mirrors the cards), empty (written copy with the primary action), error (inline, with a Retry button that re-runs the read) and populated. The lists are the map's results list, `/favorites`, `/alerts` and `/alerts/[id]` matches.
- [x] FRONT-15 · unit — A failed **read** is never a toast. A test fails on `toast.error` inside `lib/hooks/` or in a component's data-loading path. `toast.error` stays only for the failure of an action the user just clicked that has no form to put the error in: saving or removing a favorite, deleting an alert. Validation errors stay inline.
- [x] FRONT-23 · e2e — A toast takes its colours from the active theme's tokens: background `--card`, border `--border`, text `--foreground`, in both dark and light. The `<Toaster>` receives the resolved next-themes theme once mounted (`lib/hooks/useMounted.ts`), so Sonner's secondary styles follow the same theme, and the token classes carry Tailwind's important modifier because Sonner's unlayered styles otherwise beat Tailwind 4's `@layer utilities`. Any change to the toast's look is approved by the owner with screenshots in both themes, on mobile and desktop (`RULES.md` §1, §17).
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
- [x] FRONT-19 · e2e — `e2e/a11y.spec.ts` no longer disables `color-contrast`, and the main flows (`/`, `/map`, `/login`, `/register`, `/favorites`, `/alerts`, `/account`) pass axe with no serious or critical violation in both themes. Any token or colour that changes to get there is approved by the owner first (`RULES.md` §1, §17).
- [x] FRONT-20 · e2e — Every surface whose look changed, through FRONT-14, FRONT-18 or FRONT-19, has Playwright screenshots on mobile and desktop, and the owner confirms them before the commit (`RULES.md` §22 item 5).

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
- **FRONT-8**: `messages/en.json` has `favorites.empty` and `messages/es.json` does not → the test fails naming `favorites.empty`.
- **FRONT-9**:
  - cookie `locale=en` → English;
  - no cookie, `Accept-Language: fr-FR,en;q=0.8` → English;
  - no cookie, `Accept-Language: fr-FR` → Spanish.
- **FRONT-11**:
  - `formatPrice(12500, "es")` → `12.500 €`; `formatPrice(12500, "en")` → `€12,500`;
  - `formatMileage(84000, "es")` → `84.000 km`.
- **FRONT-13**: `/map?make=seat&maxPrice=10000&radius=50` loads with those filters applied. Changing `maxPrice` to 8000 and pressing Back returns to 10 000, with that search's results.
- **FRONT-14**: the search action rejects → the results list shows the error state and a "Retry" button, and no toast appears. Retry re-runs the same round.
- **FRONT-23**: `/login` in the dark theme, submit a wrong password → the error toast's computed `background-color` equals the computed value of `var(--card)` in that theme, not `rgb(255, 255, 255)` (measured before the fix on sonner 2.0.7 and 2.0.8). The same check in the light theme → `var(--card)` of the light theme. Border and text match `var(--border)` and `var(--foreground)` the same way.
- **FRONT-24**: valid credentials, no two-factor → `toast.success` is not called and `window.location.href` is set to the redirect target; valid credentials then a valid TOTP code → the same. `messages/en.json` and `messages/es.json` have no `auth.signInSuccess`.
- **FRONT-25** (issue #82): another application is already listening on port 3000 when the e2e run starts.
  - Before the fix (both `webServer` entries left `reuseExistingServer: !process.env.CI`): Playwright adopts that server. 50 tests fail and 16 pass, with `/map` landing on the other application's login page.
  - After the fix (`reuseExistingServer: false` on both entries): the run stops before any test with Playwright's "already used" error naming `http://localhost:3000`. Setting `E2E_PORT=3100` moves the app server off the occupied port and the suite runs: 66 passed, 0 failed.

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
- **Contrast fixes in one theme.** Each theme passes axe on its own, and a fix in dark mode must not break light mode.

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
