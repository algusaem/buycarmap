# CLAUDE.md - BuyCarMap

## Project Overview

BuyCarMap aggregates second-hand car listings and displays them on an interactive map. Users search and filter by location, price, make/model, year, mileage, horsepower, fuel, transmission, and recency, then browse results as a synchronized card list + map.

**Current state**: The live data sources are **Wallapop**, **coches.net** and **Milanuncios**, all proxied through Next.js API routes and merged into one result set. Auth is complete (register, login, password reset, account management, two-factor, optional OAuth) — see **Authentication** below. **Favorites are built**: a `Favorite` model, server actions, a `/favorites` page, and a saved set reconciled into search results (see `docs/specs/favorites.md`). Still not built: normalized `Car` listing persistence, saved searches, notifications. Do not assume `Car`/`SavedSearch` models exist.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Database**: PostgreSQL (Neon) via Prisma 7 using the **`@prisma/adapter-pg`** driver adapter (`pg`). Client is generated to `app/generated/prisma` with the new `prisma-client` generator.
- **Auth**: NextAuth 4 (Credentials provider, JWT sessions)
- **Forms**: React Hook Form + Zod 4 validation
- **Styling**: Tailwind CSS 4 (`@tailwindcss/postcss`), `tw-animate-css`
- **UI primitives**: Radix UI (`react-select`, `react-label`, `react-separator`, `react-slot`) wrapped in `components/ui/*`; `class-variance-authority` + `clsx` + `tailwind-merge` (the `cn` helper lives in `lib/utils.ts`)
- **Animations**: Motion (`motion/react-client`)
- **Toasts**: Sonner
- **Theming**: next-themes (dark default, `.light` class for light)
- **Maps**: Leaflet + react-leaflet with CARTO tiles
- **Geocoding**: Nominatim (OpenStreetMap) for location search; static city fallback in `lib/geo/cities.ts`
- **Icons**: Lucide React (UI), React Icons (brand/specialized)
- **Data fetching**: No data library. Custom hooks in `lib/hooks/*` own all request lifecycles (see Data Fetching below).
- **Language**: TypeScript

> There is no TanStack Query, SWR, or Redux in this project. `@neondatabase/serverless` is a dependency but the Prisma client connects through `@prisma/adapter-pg` with a plain `DATABASE_URL` connection string.

## Commands

```bash
# Package manager is pnpm (v11). Do not use npm/yarn — there is no package-lock.json.
pnpm dev              # Start dev server (next dev)
pnpm build            # prisma generate && next build
pnpm start            # next start
pnpm lint             # eslint
pnpm spec:check       # Assert every approved acceptance criterion still has a test
pnpm test             # Vitest (unit + hook + integration + component + contract)
pnpm test:watch       # Vitest watch mode
pnpm test:coverage    # Vitest with v8 coverage
pnpm test:e2e         # Playwright end-to-end (needs a runnable app + browsers)
pnpm test:contract       # Contract tests vs fixtures (offline)
pnpm test:contract:live  # Contract tests vs the real Wallapop/coches.net APIs

pnpm db:branch        # Give the current git branch its own Neon database (see below)
pnpm db:branch:rm     # Delete this branch's Neon branch when the work is merged
```

> pnpm blocks dependency build/postinstall scripts by default. Packages allowed to run them are allowlisted in `pnpm-workspace.yaml` under `onlyBuiltDependencies` (currently prisma, `@prisma/engines`, msw, sharp, unrs-resolver). If you add a dependency with a native/build step and `pnpm install` reports `ERR_PNPM_IGNORED_BUILDS`, add it there.

## Project Structure

```
app/
  account/page.tsx              # Profile, change password, delete account (guarded)
  reset-password/page.tsx       # Redeems an emailed reset token
  verify-email/page.tsx         # Confirms a signup and creates the account
  confirm-email/page.tsx        # Verifies an address, or completes an email change
  actions/                      # Server actions (register, forgot-password, reset-password, account, favorites)
  favorites/page.tsx            # Saved cars (guarded)
  api/
    auth/[...nextauth]/route.ts # NextAuth handler (authOptions live in lib/auth/options.ts)
    wallapop/search/route.ts    # Proxy → Wallapop search/section
    wallapop/filters/models/    # Proxy → Wallapop model list for a brand
    cochesnet/search/route.ts   # Proxy → coches.net search/listing (POST)
    milanuncios/search/route.ts # Proxy → Milanuncios (HTML, JSON extracted)
  generated/prisma/             # Generated Prisma client (do not edit)
  page.tsx                      # Home (Hero)
  map/page.tsx                  # Main app: <MapView />
  login/  register/             # Auth pages
  palette/  typography/         # Design reference pages
  layout.tsx  globals.css
components/
  map/                          # Map + search feature (see Map Architecture)
  auth/                         # LoginForm, RegisterForm, PasswordInput, OAuthButtons, etc.
  hero/                         # Landing hero
  ui/                           # button, card, input, label, select, separator, toggle-chip, range-input
  Navbar, ThemeProvider, ThemeSwitcher, LanguageSwitcher
lib/
  hooks/                        # useListingsSearch, useSearchFilters, useCarModels, useLocationSearch, useFavorites, useOAuthProviders, useMounted, useThemeTransition
  wallapop/                     # client, filters, normalize, cache
  cochesnet/                    # client, normalize, taxonomy (ID maps), geo (geocoding)
  geo/                          # cities (static), nominatim (geocode), user-location (browser geolocation)
  i18n/                         # config, client, server, errors (code → copy), translations, locales/{en,es}
  validations/                  # auth.ts, search.ts (Zod schemas)
  auth/                         # options (authOptions), session, authorize, hash, cleanup, password-strength,
                                #   password-policy, pwned (HIBP), tokens
  email/                        # client (Resend via fetch), copy, templates/
  env.ts                        # Zod-validated server env; throws at boot if invalid
  rate-limit.ts                 # Postgres-backed fixed-window limiter
  prisma.ts  utils.ts  animations.ts
proxy.ts                        # Route protection (Next 16's renamed middleware)
interfaces/                     # wallapop.ts, listing.ts, location.ts (reusable typings)
types/next-auth.d.ts            # Session type extension
prisma/schema.prisma
```

Note: `lib/mock/listings.ts` is currently unused (dead) — do not wire new features to it.

## Map Architecture (core feature)

The whole app lives under `/map` and is orchestrated by `components/map/MapView.tsx`:

- `MapView` composes state from two hooks: `useListingsSearch()` (results, loading, infinite scroll) and `useSearchFilters(search, getKeywords)` (all filter state + debounced re-search). It renders a left listings panel and a right `ListingsMap`. On mobile, the map opens in `MobileMapOverlay`.
- `ListingsMap` is loaded via `next/dynamic` with `ssr: false` (Leaflet needs the DOM). It switches CARTO tiles by theme, drops amber `divIcon` markers, and auto-fits bounds to the current listings via a `FitBounds` child using `useMap()`.
- `ListingsHeader` holds the keyword input + the filters toggle; it renders `SearchFilters` (a `motion.div` expand/collapse) which contains `LocationSearch`, fuel/transmission `ToggleChip`s, `RangeInput`s (price/mileage/year/horsepower), brand/model `Select`s, and time filters.
- Filter option constants (fuel, transmission, brands, time) live in `components/map/search-filter-options.ts`. Labels are resolved through i18n keys, not the raw constant strings.
- `SearchFiltersProps` is exported from `SearchFilters.tsx` and threaded through `MapView` — keep prop names in sync if you add a filter.

### Search flow

1. `useSearchFilters` fires an initial search on mount (Spain-center fallback), starts browser geolocation, then re-searches once geolocation resolves (unless the user already picked a location).
2. Filter changes call `update()`, which patches state and **debounces** the search by 400 ms. The keyword search button calls `triggerSearch()` immediately.
3. `useListingsSearch.search()` validates params with `searchSchema`, checks an in-memory TTL cache, calls `searchWallapop`, normalizes items, and stores results. A version ref discards stale responses from out-of-order requests.
4. Infinite scroll uses an `IntersectionObserver` sentinel (`sentinelRef`) that calls `loadMore()` with the `next_page` token.

## Wallapop Integration

- **Never call Wallapop from the browser** — CORS + CloudFront block it. Always go through the proxy API routes, which add the required headers `x-deviceos: 0` and `x-appversion: 85000` (without them → 403).
- Search endpoint: `GET https://api.wallapop.com/api/v3/search/section` (proxied at `/api/wallapop/search`). Models endpoint: `.../search/filters/model` (proxied at `/api/wallapop/filters/models?brand=...`).
- The client (`lib/wallapop/client.ts`) builds the query: `category_id=100` (cars), `source=deep_link`, `section_type=organic_search_results`. **Coordinates are always sent** (explicit location > browser geolocation > Spain center) so Wallapop doesn't geo-filter by the Vercel server IP (US → US listings).
- Filter params map: `keywords`, `latitude`/`longitude`, `distance_in_km`, `min_sale_price`/`max_sale_price`, `min_km`/`max_km`, `min_year`/`max_year`, `min_horse_power`/`max_horse_power`, `brand`, `model`, `engine`, `gearbox`, `time_filter`, `next_page`.
- `normalize.ts` maps `WallapopItem[]` → `CarListing[]`: filters out `reserved.flag` items, reads car data from `type_attributes`, prefers `images[0].urls.big`, and falls back to `getCityCoordinates(city)` when an item lacks coordinates.
- `cache.ts` is a module-level `Map` with a 60 s TTL, keyed by the JSON-stringified search params.

### Known Wallapop behavior (from experience)

- Results are biased toward the search center lat/lng even with a large `distance_in_km`; a Madrid-centered search returns mostly Madrid-area listings.
- `distance_in_km > 2000` returns 400; values up to 2000 don't meaningfully widen results beyond the local area.
- The old `/api/v3/cars/search` endpoint returns randomized coords and wrong data — do not use it. Coordinates from `search/section` are accurate.
- Item shape is flat (no `.content` wrapper): `price.amount`, `images[].urls.big`, `location.latitude/longitude`, `type_attributes.{brand,model,year,km,engine,horsepower}`, and `reserved.flag`.

## Database Models

Current schema (`prisma/schema.prisma`) — only these exist:

- **User**: `id`, `email` (unique), `password?` (null for OAuth-only accounts), `name?`, `image?`, `emailVerified?`, `passwordChangedAt`, `twoFactorSecret?` (encrypted), `twoFactorEnabledAt?`, `twoFactorLastStep?`, timestamps.
- **Account** / **Session** / **VerificationToken**: the shapes `@next-auth/prisma-adapter` requires. `Session` is unused while the strategy is JWT, but the adapter's types need the model.
- **PasswordResetToken** / **EmailVerificationToken**: `tokenHash` (sha-256), `expiresAt`, `usedAt`. Single-use; the raw token is never stored. `EmailVerificationToken.newEmail` is null to confirm the current address and set to the target for an email change.
- **PendingRegistration**: a submitted-but-unconfirmed signup (`email`, bcrypt `password`, `tokenHash`). No `User` row exists until the link is confirmed — this is what makes registration enumeration-resistant.
- **TwoFactorRecoveryCode**: `codeHash` (sha-256), `usedAt`. Single-use; the plaintext code exists only in the response that created it.
- **RateLimit**: `key`, `count`, `expiresAt` — fixed-window counters for the auth limiter.
- **SearchHistory**: `userId`, `query`, `createdAt`.

Note: `User.avatarUrl` was renamed to `image` because the NextAuth adapter writes the OAuth profile picture to that exact field.

Planned (not yet modeled): normalized `Car` listings, `Source`, `SavedSearch`, `Favorite`, price history, notifications. If a task needs these, add the models — don't assume they're present.

## Data Sources

- **Integrated**: Wallapop, coches.net.
- **Planned**: Milanuncios, Autoscout24, other regional platforms.

### Adding / working with sources

Each source has a `lib/<source>/*` module (client, normalize, taxonomy/geo) and a `/api/<source>/*` proxy route, and normalizes into the shared `CarListing`. `useListingsSearch` fans out to all sources with `Promise.allSettled`, interleaves the results, and tracks pagination per source (Wallapop = `next_page` cursor, coches.net = page number). If one source fails, the others still render.

**coches.net specifics** (full contract in the `cochesnet-api` memory):
- `POST /api/cochesnet/search` → proxies `https://web.gw.coches.net/search/listing` with header `X-Schibsted-Tenant: coches`.
- **One shared filter set drives both sources.** The UI filters build a single `SearchInput`; each source's client translates it into that API's params — there is no separate coches.net filter UI. `lib/cochesnet/taxonomy.ts` maps brand name → `makeId` and Wallapop fuel/transmission tokens → coches.net IDs; `lib/cochesnet/models.ts` resolves the shared model name → coches.net `modelId` (via `GET /models?makeId=`, proxied at `/api/cochesnet/models`). The model dropdown stores the model *name* (Wallapop uses the name as its option id), so it is already source-agnostic.
- coches.net vehicle filter shape is flat: `vehicles: [{ makeId, modelId }]`.
- **Items carry no coordinates** — `lib/cochesnet/geo.ts` geocodes each listing to its city (via `lib/geo/cities.ts`) or province-capital centroid (INE code map), so coches.net pins are city/province-level approximate, not exact like Wallapop's.
- Images are on `**.ccdn.es` (allowed in `next.config.ts`).

Source origin is shown per card via `components/map/SourceBadge.tsx` (brand-coloured chip).

## i18n

- Locales: `en`, `es`. **Default is `es`.** Config in `lib/i18n/config.ts` (`LOCALES`, `DEFAULT_LOCALE`, `COOKIE_NAME = "locale"`).
- Server: `getLocale()` reads the `locale` cookie, then falls back to `Accept-Language`, then default. `getTranslations()` used in `layout.tsx` for metadata + SSR.
- Client: `I18nProvider` wraps the app; `useTranslation()` returns `{ locale, t, setLocale, isPending }`. `setLocale` writes the cookie and `router.refresh()`s within a transition.
- Strings live in `lib/i18n/locales/{en,es}.ts`, aggregated by `translations.ts`. **All user-facing text must use `t.*` keys** — no hardcoded English/Spanish in components. Add new keys to both locale files.

## Design System

### Theme: Cartographic Modern

Dark-first, inspired by night maps. Warm amber accents on deep ink. Defined in `app/globals.css` (`:root` = dark, `.light` = warm paper). Reference pages: `/palette`, `/typography`.

### Color Palette

| Token                | OKLCH                   | Hex     | Usage                                    |
| -------------------- | ----------------------- | ------- | ---------------------------------------- |
| `--background`       | `oklch(0.16 0.015 250)` | #0F1419 | Deep ink - app background                |
| `--card`             | `oklch(0.20 0.015 250)` | #1C2128 | Elevated surfaces                        |
| `--popover`          | `oklch(0.22 0.015 250)` | #262D36 | Panels, dropdowns                        |
| `--primary`          | `oklch(0.75 0.14 75)`   | #E8A849 | Amber gold - CTAs, highlights, markers   |
| `--accent`           | `oklch(0.62 0.12 160)`  | #3B9B6D | Eucalyptus - success, available listings |
| `--destructive`      | `oklch(0.58 0.18 25)`   | #D94F4F | Muted red - alerts, price drops          |
| `--border`           | `oklch(0.28 0.01 250)`  | #30363D | Structure, dividers                      |
| `--foreground`       | `oklch(0.92 0.01 250)`  | #E6EDF3 | Primary text (cream)                     |
| `--muted-foreground` | `oklch(0.62 0.01 250)`  | #8B949E | Secondary text, metadata                 |

Semantic aliases also exist: `--success`, `--warning`, `--info`, plus `--chart-1..5`.

### Typography

- **Plus Jakarta Sans** (`--font-sans`): all UI text; weight variations for hierarchy.
- **JetBrains Mono** (`--font-mono`): prices, mileage, IDs, numeric data.

```jsx
<h1 className="text-5xl font-extrabold tracking-tight">BuyCarMap</h1>
<h2 className="text-2xl font-bold">Available Nearby</h2>
<span className="font-mono text-xl text-primary">€14,500</span>
<span className="text-sm text-muted-foreground">45,230 km</span>
```

### Semantic Color Usage

- **Primary (Amber)**: CTAs, selected states, active markers, favorited/price highlights
- **Accent (Eucalyptus)**: "Available" badges, price decreases, success states
- **Destructive (Red)**: alerts, errors (sparingly)

### Map Tiles

- **Dark**: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- **Light**: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`
- `ListingsMap` switches tiles via `useTheme().resolvedTheme` (guarded by `useMounted`).

## Spec-Driven Development

Feature work starts with a spec, not with code. The spec is the agreement about
*what* the software does; the tests prove it; the implementation follows. Full
conventions in `docs/specs/README.md`; adoption status in
`docs/sdd-adoption-plan.md`.

**The loop.** Write the spec from `docs/specs/_template.md` (Status `Draft`) →
get it approved (`Approved`) → write one **failing** test per acceptance
criterion → implement until green → fill in "Verified by" and set
`Implemented`.

**Criteria are identified, not just numbered.** Each spec declares a unique
`Key` of 2–8 uppercase letters; criteria are `KEY-1`, `KEY-2`, … and are
**append-only** — never renumber, because test titles point at those ids:

```ts
it("FAV-3: removes a listing from favorites when the button is toggled off", …)
```

`pnpm spec:check` (in CI, before the suite) fails when an approved criterion is
named by no test, or when a test names a criterion no spec declares. It proves
an id is *mentioned*, not that the assertion is meaningful — the `/check-tests`
quality bar is still what makes a test worth having.

**When a spec is required:** any change to observable behaviour — a feature, a
data source, a changed flow, a new failure mode. **Not required:** behaviour-
preserving refactors, dependency bumps, styling that changes no interaction, or
fixing a bug an existing criterion already forbids (that is a missing test, not
a missing spec).

**Changing behaviour means editing the spec first**, then the tests, then the
code. A spec that disagrees with the code is worse than no spec, because it is
trusted.

### How this triggers — Claude runs it, the user does not

**Do not wait to be asked for a spec.** When a request would change observable
behaviour, invoke `/spec` yourself as the first action, before reading further
into implementation and before writing any code. The user asking for a feature
*is* the request for a spec.

| The user says | Do this first |
| --- | --- |
| "add X", "build X", "I want users to be able to X" | `/spec X` — draft it, then stop and get it approved |
| "change how X works", "X should also do Y" | Open the governing spec, amend it, re-approve; then `/spec-tests` |
| "X is broken" | Find the criterion that forbids it. **Exists** → write the failing test, fix, no spec change. **Missing** → the spec has a hole: add a criterion, then fix |
| "refactor X", "rename X", "bump X" | No spec. Say so in one line and proceed |
| "why does X do Y?" | No spec. Answer the question |

After a spec is approved, invoke `/spec-tests` yourself — do not implement
straight from the spec. The tests come first or the process is theatre.

**Two rules that override the urge to be helpful:**

1. **Stop after drafting a spec.** Approval is the user's decision, and it is
   the only checkpoint in the loop where the cost of being wrong is still low.
   Drafting a spec and immediately implementing it defeats the entire point.
2. **When it is genuinely ambiguous whether something needs a spec, say which
   way you are going and why, in one sentence, then proceed.** Do not stall the
   work on a process question — but do not silently skip the spec either.

**Commands:** `/spec <feature>` drafts one; `/spec-tests <spec>` turns an
approved spec's criteria into failing tests. Both live in `.claude/commands/`.
They are Claude-invoked; the user may also call them directly.

This section is an instruction, not documentation. `pnpm spec:check` in CI is
the backstop that catches what gets missed — it cannot catch a feature built
with no spec at all, only a criterion that lost its test.

> `docs/specs/auth-email-and-oauth.md` predates this template — no key, no
> criteria table — so `spec:check` skips it. It is converted in Wave C of the
> adoption plan. Do not copy its shape for new specs; copy `_template.md`.

## Testing

Stack: **Vitest** (unit/hook/integration/component), **React Testing Library**, **MSW** (network mocking), **vitest-axe** (a11y), **Playwright** (e2e + visual). No test runner existed before; this is the house setup — follow it, don't introduce Jest/Cypress.

### Layout & conventions

- **Colocate** tests next to source (`foo.ts` → `foo.test.ts`). No `__tests__/` folders.
- **Two Vitest projects** (`vitest.config.ts`), split by environment:
  - `unit` (jsdom) — everything by default: pure lib, source clients (need `window.location`), hooks, components. Files: `*.test.ts(x)`.
  - `node` — Next.js route handlers + server actions, which need real Node request globals. **Opt in by naming the file `*.node.test.ts`.**
- **MSW is the only way to fake network.** Shared handlers + typed fixtures live in `test/`; `onUnhandledRequest: "error"` so stray requests fail loudly. Override per-test with `server.use(...)`. Never hand-stub `global.fetch`.
  - `test/fixtures/*` — typed builders (`makeWallapopItem`, `makeCochesNetItem`, …). Override only the fields under test.
  - `test/msw/handlers.ts` — default happy-path handlers for both the local proxy routes (jsdom clients) and the upstream APIs (node route tests).
  - `test/mocks/intersection-observer.ts` — controllable IO; call `triggerIntersection()` to drive infinite scroll.
  - `test/utils/render.tsx` — `renderWithI18n(ui)` wraps in `I18nProvider locale="en"` so tests query stable English labels. (`useTranslation` falls back to Spanish without a provider.)
- **Contract tests** (`test/contract/*.contract.test.ts`, node project) — Zod schemas of the *external* Wallapop/coches.net shapes the normalizers read. Validate fixtures offline (CI on every push); `CONTRACT_LIVE=1` also hits the real APIs (nightly) to catch upstream drift.
- **Quality bar:** the `/check-tests` rules apply — no tautological/self-fulfilling/mock-the-SUT tests; hand-derive expected values; cover a negative path.

### Environment gotchas (baked into the setup — know them before writing tests)

- **Module-level caches persist across tests**: `lib/wallapop/cache.ts`, `lib/cochesnet/models.ts` (`modelsByMake`), `lib/geo/user-location.ts`. Use distinct keys/brands per test, or fake timers, to avoid cross-test bleed. MSW handlers + IO observers reset in `afterEach` (`test/setup.jsdom.ts`).
- **`Date.now()` / 400 ms debounces** → `vi.useFakeTimers()` + `advanceTimersByTimeAsync`. **But not together with `userEvent`**: Testing Library's async wrapper awaits a `setTimeout` it only advances when it detects *jest's* fake clock, which Vitest doesn't expose, so every interaction hangs until the test times out. Either drive the hook directly (`renderHook` + `act`), or keep real timers and let `findBy*` (1 s default) absorb the debounce — that is what `LocationSearch.test.tsx` does.
- **Radix Select needs pointer plumbing jsdom lacks**: `hasPointerCapture`/`setPointerCapture`/`releasePointerCapture` are stubbed in `test/setup.jsdom.ts`, and the trigger must be clicked with `userEvent.setup({ pointerEventsCheck: 0 })`. `SelectValue` renders nothing while the content is unmounted, so a closed trigger's accessible name is its label alone — query it as `getByRole("combobox", { name: /Brand/ })`, never by the selected value.
- **`useListingsSearch.loadMore` is not public** — it fires only via the sentinel. Test it by `sentinelRef(node)` + `triggerIntersection()`.
- **`<input type="email">` uses native browser validation**: a malformed value is blocked by the browser *before* react-hook-form runs, so RHF's "Invalid email address" message never renders. Assert "did not submit" for malformed input, and use empty/required cases to exercise RHF's own messages. (The forms don't set `noValidate`.)
- **Controlled inputs** (e.g. `RangeInput`): a value only accumulates if a parent holds state — render a stateful harness, don't pass a static `value`.
- **jsdom lacks** IntersectionObserver, geolocation (defaults to "denied" → Spain-center fallback), matchMedia, canvas — all stubbed in `test/setup.jsdom.ts`. Leaflet can't run in jsdom: mock `react-leaflet` in component tests; render it for real only in Playwright.

### E2E (Playwright, `e2e/`)

- Runs against a real `next dev` server (Playwright `webServer`). The two source proxies are mocked at the **browser** level via `page.route` (`e2e/fixtures/network.ts`) so e2e never hits live Wallapop/coches.net. Fixture image URLs must use an **allowed `next.config` host** (`**.wallapop.com`, `**.ccdn.es`) or `next/image` throws a client exception.
- **Three projects**, all run by `pnpm test:e2e`: `chromium` + `mobile` (functional) and `visual` (screenshots). `pnpm test:visual` runs the screenshots alone.
- **Visual baselines are platform-specific** (`*-win32.png` locally, CI is ubuntu). Each visual test **skips itself with an explanatory reason** when the current platform has no baseline, so a Linux CI stays green until Linux baselines are committed. Generate them by running `pnpm test:visual --update-snapshots` on that platform.
- **Screenshots must wait for the page to settle** (`waitForPageToSettle` in `e2e/visual.spec.ts`): the navbar swaps a placeholder for real links when `useSession()` resolves, and `next/font` loads asynchronously. Both raced the camera and made these tests look "inherently flaky" — they aren't.
- **`maxDiffPixels: 300`** is calibrated, not arbitrary: ~86px of antialiasing noise between identical renders, versus 1,310px for a one-step font-size change. Don't raise it to silence a failure — read the diff PNG in `test-results/`, which points straight at the culprit.
- `mockListingSources` also stubs `**/_next/image**`. The fixture image URLs use allowed hosts but don't exist, so `next/image` really fetched them and really 404'd, rendering differently by timing.
- **CI does not run the DB-gated e2e.** `pnpm test:e2e` runs without `E2E_DB`, so those 28 tests
  skip there and gate nothing. Wiring them needs `NEON_API_KEY` as a GitHub secret plus a job that
  forks a branch database per run and deletes it afterwards. Until that exists they are a local
  pre-merge check, not a guard — treat a green CI as saying nothing about persistence.
- **DB-gated e2e is real now.** `pnpm test:e2e:db` (`E2E_DB=1`) runs the auth, two-factor and
  favorites round-trips against an actual database — 27 tests. It needs the worktree to have its own
  Neon branch first (`pnpm db:branch`); without one it would write to whatever `DATABASE_URL` points
  at. Global teardown deletes every `@e2e.local` account, and `Favorite` rows go with them by cascade.
  Two traps found while wiring it up:
  - **The suite exhausts its own login rate limit.** Dozens of sign-ins from one address against a
    limit of 20 per IP per 15 minutes, so a second run inside that window failed every test with what
    looked like broken auth. Global setup now clears the `RateLimit` table when `E2E_DB` is set.
  - **`webServer.env` merges with `process.env`**, and `playwright.config.ts` loads `.env` at line 1.
    Registration behaves completely differently depending on whether email is configured, so the mode
    was decided by the developer's `.env` until `RESEND_API_KEY`/`EMAIL_FROM` were pinned to `""` there.
- **Never assert an optimistic UI toggle to prove a write landed.** The favorite control flips before
  the server answers and rolls back after a failure, so the assertion passes even when nothing was
  saved — and navigating away next cancels the request. `e2e/favorites.spec.ts` polls the row count
  in Postgres instead.
- Known findings the suite surfaced (unfixed, flagged): auth pages fail `color-contrast` (excluded from the a11y gate); malformed-email is caught by native browser validation, not RHF (forms lack `noValidate`).

## Rules for Claude

### Worktrees and the dev database

**Never run `prisma migrate reset`, `prisma db push --force-reset`, or any command that drops or
recreates the database.** The Neon database holds real accounts, there is no seed script, and
"reset" rebuilds the schema with zero rows. Prisma offers it for bookkeeping problems that do not
need it — treat the offer as a bug report, not an instruction.

**This is enforced, not just documented.** `scripts/require-branch-db.mjs` refuses to let a
database-touching command run from a worktree that has no branch database of its own, and a
`PreToolUse` hook wires it to every Bash/PowerShell call. If you see "Refusing to run", the fix is
`pnpm db:branch` -- never work around the guard. It deliberately ignores `prisma generate` (which
never opens a connection) and `pnpm db:branch` itself (blocking the remedy would deadlock). The
rule lives in the repository; only the hook wiring is local, so run `node
scripts/require-branch-db.mjs` by hand if you are working somewhere the hook is not configured.

**Before running any Prisma command or `pnpm dev` from a worktree, run `pnpm db:branch`.** It gives
the current git branch its own copy-on-write Neon branch and writes `DATABASE_URL` into that
worktree's `.env`, seeding the rest of the file from the main checkout. Do this first, unprompted,
whenever starting work on a new branch or worktree — the command is idempotent, so re-running it on
an already-provisioned branch just reuses it.

Why it is mandatory: `migrate dev` assumes the dev database matches the *current branch's* migration
history. While worktrees share one database, a migration applied from any one of them makes every
other worktree report "applied to the database but missing from the local migrations directory" and
demand a reset. This happened on 2026-08-02 and cost an investigation.

Two related traps, both seen in practice:

- **`prisma migrate status` does not catch this.** It reported "Database schema is up to date!"
  against a stale checksum and a migration missing locally. It validates neither. Only `migrate dev`
  does.
- **Checksums are SHA-256 of `migration.sql` with CRLF normalized to LF.** `core.autocrlf=true` is
  set with no `.gitattributes`, so every migration file is CRLF on disk and LF in git. That is *not*
  a source of drift. Do not chase it.

A stale checksum is repaired with `UPDATE _prisma_migrations SET checksum = … WHERE migration_name =
…` — never with a reset. Confirm the file is semantically correct first: if `migrate dev`'s drift
summary shows no differences attributable to that migration, Prisma already replayed it on a shadow
database and it matched.

Worktrees start with neither `.env` nor `node_modules`. `pnpm db:branch` handles the first — it is
dependency-free for exactly this reason, and reads the shared secrets from the main checkout via
`git rev-parse --git-common-dir`. The rest still needs doing:

```bash
pnpm install && pnpm exec prisma generate
```

`prisma generate` is easy to forget because nothing prompts for it: without `app/generated/prisma`,
four test files fail at *import* while every test that does run passes, which reads like an
unrelated breakage rather than a missing bootstrap step.

### TypeScript

- Never use `any` or `unknown`
- Use `interface` instead of `type` (unions/utility types excepted)
- Reusable typings go in `/interfaces`; small non-reusable typings stay in the component
- Do not over-type trivial values

### Data Fetching (this project's actual pattern)

- **No data-fetching library is installed.** Do not add one without asking.
- Never call `fetch` directly inside a component. Extract request logic into a hook in `lib/hooks/*` (like `useListingsSearch`, `useCarModels`, `useLocationSearch`). Components consume hooks only.
- Cross-cutting fetch helpers (Wallapop client, filters, geocoding) live in `lib/wallapop/*` and `lib/geo/*`. Hooks call those, not raw endpoints.
- Surface request errors with `toast.error(...)`, not inline error text.
- Guard against out-of-order responses (version ref / `cancelled` flag) as existing hooks do.

### Server Actions & API

- **Prefer server actions over API routes** for mutations; place them in `app/actions/`.
- Validate input with Zod (`schema.safeParse()`); return typed `{ success, error?, data? }`. Never trust client validation alone.
- API routes only for proxying/external integrations (like the Wallapop proxies) or webhooks. One folder per resource, one file per endpoint. Never create aggregated/global API files.

### Forms

- Always React Hook Form + Zod; schemas in `lib/validations/` with exported inferred types (`auth.ts` → `loginSchema`/`registerSchema`, `search.ts` → `searchSchema`).
- Use `zodResolver`, inline field errors, and `isSubmitting` for loading state.

### Authentication

- NextAuth 4, JWT sessions. **`authOptions` lives in `lib/auth/options.ts`**, not the route file — server components and actions import it for `getServerSession`, and pulling it from a route would drag the handler along.
- Providers: Credentials always; Google/GitHub only when both halves of their env pair are set (`lib/env.ts`). The Prisma adapter is attached only when OAuth is configured. Both providers use `allowDangerousEmailAccountLinking` — see the reasoning comment in `options.ts` before changing it.
- Passwords hashed with bcryptjs (12 rounds) via `lib/auth/hash.ts`.
- **Never call `getServerSession` directly** — use `getCurrentUser()` from `lib/auth/session.ts`. Every server action that touches user data must call it; `proxy.ts` only decodes the JWT and cannot see revocations, so it is UX, not authorization.

#### Password policy (NIST SP 800-63B)

Length and blocklists, not composition rules. Three layers, all of which must pass:

1. `lib/validations/auth.ts` — length only (12–72; 72 is bcrypt's truncation limit). Shared by register / reset / change so they cannot drift.
2. `lib/auth/password-strength.ts` — dependency-free scorer (0–4), also used by the client meter. Rejects below 2.
3. `lib/auth/pwned.ts` — Have I Been Pwned k-anonymity check. Only the first 5 hash characters leave the process. **Fails open** on outage.

`lib/auth/password-policy.ts` composes 2 and 3; call `validateNewPassword()` from any action that sets a password. The client meter is a hint — the server gate is what counts.

#### Error codes, not messages

Zod schemas and server actions return **codes** (`AUTH_ERROR` in `lib/validations/auth.ts`), never English prose — server code cannot read the client i18n context, and the default locale is Spanish. Forms resolve them with `translateAuthError(t, code)` from `lib/i18n/errors.ts`, backed by the `authErrors` namespace. When calling `setError`, pass the **raw code**; the field translates it once at render.

#### Two-factor authentication (TOTP)

`lib/auth/two-factor/*`, implemented on `node:crypto` — no dependency in the authentication path. RFC 6238: HMAC-SHA1, 6 digits, 30s step, ±1 step of drift tolerance. The parameters are fixed because they are what real authenticator apps assume.

- **Secrets are encrypted, not hashed** (`encryption.ts`, AES-256-GCM). Verifying a code means recomputing the HMAC, so the secret must be recoverable; `TWO_FACTOR_ENCRYPTION_KEY` is what the database alone lacks. Optional env — without it the feature is hidden rather than the app refusing to boot.
- **Enrolment is two-step**: `startTwoFactorSetup` stores the secret but leaves `twoFactorEnabledAt` null, so nothing is enforced until `confirmTwoFactorSetup` sees a working code. This is what stops users locking themselves out.
- **Replay protection**: `twoFactorLastStep` records the highest accepted counter step; anything at or below it is refused, so a code seen over a shoulder is not reusable inside its own 30s window. Consequence worth knowing: the code that *enabled* 2FA is itself consumed, so a user who enrols and immediately signs out and back in within the same 30 seconds must wait for the next code. Rare in practice, and the alternative — not recording the enrolment step — would leave that code usable by anyone who watched the setup screen.
- **Recovery codes**: 10 × ~73 bits, SHA-256 (not bcrypt — no dictionary to grind, and a unique index makes redemption one indexed lookup). Shown exactly once. Consumed via `updateMany` guarded on `usedAt` so concurrent requests cannot both spend one.
- **Disabling requires password *and* code**; regenerating codes requires the password only, since losing the codes is the usual reason to be there.
- **`totpRequired` is thrown only after a correct password**, so it is not an enumeration signal.
- **Password reset does not bypass 2FA.** If it did, control of the mailbox would defeat the second factor entirely.
- **OAuth sign-in does not ask for a TOTP code** — the provider runs its own second factor. That policy only holds while the link is one the owner established, so the `signIn` callback in `options.ts` refuses to auto-link a *new* provider to an account that has 2FA on. Without it, anyone who compromised the mailbox could mint a Google account on that address and sign in past the second factor. Adding a provider is still possible from `/account`, where the session has already cleared 2FA. A rejection surfaces as `?error=AccessDenied` on `/login`.

#### Session revocation

JWTs cannot be deleted server-side, so `User.passwordChangedAt` is the revocation clock. The `jwt` callback stamps `pwdAt` at sign-in and re-reads the row at most every 5 minutes; if the password changed after the stamp — or the account is gone — it **throws**, which NextAuth's session route catches, clearing the cookie and nulling the session. Any flow that changes a password must bump `passwordChangedAt`.

#### Email address changes

The confirmation link goes to the **new** address, never the current one, and the current password is required to start the change. Either alone is insufficient: a hijacked session can't move the account without the password, and knowing the password doesn't help without control of the target mailbox. The old address gets a notice afterwards so its owner can react. `confirmEmail` requires a POST for the same mail-scanner reason as signup confirmation.

#### Housekeeping

`lib/auth/cleanup.ts` prunes expired `PendingRegistration`, `PasswordResetToken` and `EmailVerificationToken` rows opportunistically (~2% of token-issuing requests), mirroring what `lib/rate-limit.ts` already does. There is no scheduler in this project — don't add one for this.

#### Rate limiting

`lib/rate-limit.ts`, backed by the `RateLimit` table — **not** in-memory, because Vercel's serverless instances would reset a Map constantly. Rules live in `RATE_LIMITS`. Applied to login (per IP + per account), register, reset request, reset redemption, and change-password. **Fails open** on database error.

#### Enumeration

Every auth surface is enumeration-resistant: identical responses, dummy-hash timing equalization on login, and bcrypt run *before* any existence check so response time cannot substitute for the message.

**Registration is verify-first when email is configured.** `register` writes a `PendingRegistration` row (never a `User`), emails a confirmation link, and returns `{ success: true, pending: true }` for a free address and a taken one alike — the taken address just gets a different email. The account is created only by `verifyRegistration` when the link is confirmed. That action requires a **POST** (a button on `/verify-email`, not the link click) because mail scanners follow every link in an inbox and would otherwise burn the token.

**When email is unconfigured, registration falls back** to immediate creation and does report `emailTaken` — otherwise nobody could sign up at all. That path logs a warning and is the only remaining leak; configuring `RESEND_API_KEY` closes it.

### Theming

- next-themes, `attribute="class"`, dark default, `.light` for light. Components using `useTheme` must wait for `mounted` (`lib/hooks/useMounted.ts`) to stay hydration-safe. Use CSS variables (`var(--...)`) for theme-aware styles.

### Toasts

- Sonner. `toast.success` / `toast.error`. Toaster is in the root layout; style via `classNames`, not inline styles.

### Icons

- Never raw SVGs. Lucide React for UI icons, React Icons for brand icons. Size with Tailwind (`h-4 w-4`).

### Animations

- Motion library (`import * as motion from "motion/react-client"`, `import { AnimatePresence } from "motion/react"`) over CSS animations for React components. Keep motion subtle, honor `prefers-reduced-motion`, animate only `transform`/`opacity`.
- Reuse the shared presets in `lib/animations.ts` (`fadeInUp`, `fadeInDown`, `scaleIn`, `fadeIn(delay)`, `slideInLeft(delay)`, `staggerContainer(delay)`, `buttonTap`) instead of re-declaring `initial`/`animate` inline.
- Theme switching uses the View Transitions API via `lib/hooks/useThemeTransition.ts` (expanding-circle clip-path from the click point) — use it rather than calling `setTheme` directly in the toggle.

### React & Components

- Avoid unnecessary `useEffect` (no effects purely to sync state). Prefer `.map` over `forEach`.
- Keep components single-responsibility; split beyond ~250 lines. Reuse only to remove real duplication, never preemptively.
- Do not refactor working code unless it improves correctness or clarity. No speculative abstractions.
- **Never use render functions that return JSX.** If logic produces markup, extract it into a proper React component with props — not a plain function called inside JSX.
- **Extract repeated JSX into private components:** when a pattern repeats within a component, extract it as a non-exported component in the same file.
- **Single code path over ternary branches:** prefer one JSX structure with conditional rendering (`{condition && …}`) over duplicating large blocks in a ternary.

### Code Style

- Readability over cleverness. No unused variables/hooks/imports. Never over-engineer.
- Use `await` — never `.then()` chains.
- **Guard clauses over nested ifs:** use early returns to flatten logic instead of deeply nested conditionals.
- **Only create what's asked for:** don't generate extra files, hooks, configs, or interfaces beyond what was explicitly requested.

### Styling & Layout

- Follow existing Tailwind patterns and the spacing system. Avoid absolute positioning unless necessary. All UI must be responsive.

### UX

- Prefer pages over modals unless a modal is clearly better UX.

### Communication

- Direct and concise. No emojis, filler, or motivational language. If something is a bad idea, say so.

## UI Quality Bar (MUST / SHOULD / NEVER)

### Interactions

- MUST: Full keyboard support ([WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)); visible focus rings (`:focus-visible`, group with `:focus-within`); manage focus (trap/move/return). NEVER `outline: none` without a replacement.
- MUST: Hit targets ≥24px (mobile ≥44px); expand hit area if visual is smaller. Mobile `<input>` font-size ≥16px. `touch-action: manipulation`. NEVER disable zoom (`user-scalable=no`, `maximum-scale=1`).

### Forms

- MUST: Hydration-safe inputs (no lost focus/value). NEVER block paste. Loading buttons show a spinner and keep their label. Enter submits; in `<textarea>` ⌘/Ctrl+Enter submits. Keep submit enabled until request starts. Accept free text, validate after. Errors inline; focus first error on submit. Correct `autocomplete`/`name`/`type`/`inputmode`. Trim values. Warn on unsaved changes. Compatible with password managers/2FA.

### State & Navigation

- MUST: URL reflects state (deep-link filters/tabs/pagination). Back/Forward restores scroll. Use `<a>`/`<Link>` for navigation (support Cmd/Ctrl/middle-click). NEVER `<div onClick>` for navigation.

### Feedback

- SHOULD: Optimistic UI, reconcile on response, rollback/Undo on failure. MUST: Confirm destructive actions or offer Undo. Polite `aria-live` for toasts/validation. Ellipsis `…` for follow-up options and loading states.

### Animation

- MUST: Honor `prefers-reduced-motion`. Animate compositor-friendly props (`transform`, `opacity`) only. NEVER animate layout props or use `transition: all`. Animations interruptible and input-driven. Correct `transform-origin`.

### Layout

- MUST: Deliberate alignment to grid/baseline/edges. Verify mobile, laptop, ultra-wide (test at 50% zoom). Respect safe areas (`env(safe-area-inset-*)`). Avoid unwanted scrollbars. Prefer flex/grid over JS measurement.

### Content & Accessibility

- MUST: Skeletons mirror final content (no layout shift). `<title>` matches context. No dead ends — always offer a next step. Design empty/sparse/dense/error states. `font-variant-numeric: tabular-nums` for compared numbers. Redundant status cues (not color-only). Icon-only buttons need descriptive `aria-label`. Prefer native semantics before ARIA. Use the `…` character (not `...`). Locale-aware dates/numbers (`Intl.*`). Non-breaking spaces for units/brands.

### Content Handling

- MUST: `truncate`/`line-clamp-*`/`break-words` for long content; flex children need `min-w-0` to truncate. Handle empty states (no broken UI for empty strings/arrays).

### Performance

- MUST: Track/minimize re-renders. Profile with throttling. Mutations target <500ms. Virtualize lists >50 items. Preload above-fold images, lazy-load the rest. Prevent CLS (explicit image dimensions). `preconnect` for CDN domains.

### Dark Mode & Theming

- MUST: `color-scheme: dark` on `<html>` for dark themes. `<meta name="theme-color">` matches page bg. Native `<select>`: explicit `background-color` and `color`.

### Design

- SHOULD: Layered shadows (ambient + direct); crisp edges via semi-transparent borders + shadows; nested radii (child ≤ parent); hue consistency (tint borders/shadows toward bg hue). MUST: Accessible/color-blind-friendly charts; meet contrast (prefer [APCA](https://apcacontrast.com/)); increase contrast on hover/active/focus.

## Scraping / Integration Guidelines

- Respect robots.txt and rate limits. Store raw data separately from normalized data. Handle deduplication across sources. Track listing freshness and availability. Cluster/limit markers and lazy-load detail where it helps performance.
