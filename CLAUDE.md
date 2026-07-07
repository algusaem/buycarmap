# CLAUDE.md - BuyCarMap

## Project Overview

BuyCarMap aggregates second-hand car listings and displays them on an interactive map. Users search and filter by location, price, make/model, year, mileage, horsepower, fuel, transmission, and recency, then browse results as a synchronized card list + map.

**Current state**: The live data sources are **Wallapop** and **coches.net**, both proxied through Next.js API routes and merged into one result set. Other sources listed below are planned, not yet integrated. Auth (register/login) works but listing persistence, saved searches, and favorites are not built yet — the schema only has `User`, `Session`, and `SearchHistory`. Keep this in mind: do not assume `Car`/`Favorite`/`SavedSearch` models exist.

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
npm run dev    # Start dev server (next dev)
npm run build  # prisma generate && next build
npm run start  # next start
npm run lint   # eslint
```

## Project Structure

```
app/
  actions/                      # Server actions (register.ts)
  api/
    auth/[...nextauth]/route.ts # NextAuth handler (exports authOptions)
    wallapop/search/route.ts    # Proxy → Wallapop search/section
    wallapop/filters/models/    # Proxy → Wallapop model list for a brand
    cochesnet/search/route.ts   # Proxy → coches.net search/listing (POST)
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
  hooks/                        # useListingsSearch, useSearchFilters, useCarModels, useLocationSearch, useMounted, useThemeTransition
  wallapop/                     # client, filters, normalize, cache
  cochesnet/                    # client, normalize, taxonomy (ID maps), geo (geocoding)
  geo/                          # cities (static), nominatim (geocode), user-location (browser geolocation)
  i18n/                         # config, client (provider + useTranslation), server, translations, locales/{en,es}
  validations/                  # auth.ts, search.ts (Zod schemas)
  auth/hash.ts                  # bcrypt hashing
  prisma.ts  utils.ts  animations.ts
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

- **User**: `id`, `email` (unique), `password`, `name?`, `avatarUrl?`, timestamps. Relations: `sessions`, `searchHistories`.
- **Session**: token-based session rows (`token` unique, `expiresAt`), cascade-deleted with the user.
- **SearchHistory**: `userId`, `query`, `createdAt`.

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

## Rules for Claude

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

- NextAuth 4, Credentials provider, JWT sessions. Config (`authOptions`) exported from `app/api/auth/[...nextauth]/route.ts`.
- Passwords hashed with bcryptjs (12 rounds) via `lib/auth/hash.ts`. Session type extended in `types/next-auth.d.ts`.
- Registration = server action (`app/actions/register.ts`) creates the user, then the client calls `signIn("credentials", ...)`.

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

### Code Style

- Readability over cleverness. No unused variables/hooks/imports. Never over-engineer.

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
