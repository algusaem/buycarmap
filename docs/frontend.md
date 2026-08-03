# Frontend

The map feature's structure, the design system, internationalisation and
theming.

Search *behaviour* — the fan-out, debounce and pagination — is in
[architecture.md](architecture.md#path-1--a-search) and specified in
[`specs/map-and-search.md`](specs/map-and-search.md). This page is about the
components and the visual system.

## The map feature

Everything lives under `/map` and is orchestrated by
[`components/map/MapView.tsx`](../components/map/MapView.tsx), which composes two
hooks — `useListingsSearch()` for results and `useSearchFilters()` for filter
state — and renders a listings panel beside the map.

```
MapView
├─ ListingsHeader          keyword input + filters toggle
│  └─ SearchFilters        motion.div expand/collapse
│     ├─ LocationSearch    Nominatim autocomplete
│     ├─ ToggleChip ×n     fuel, transmission
│     ├─ RangeInput ×4     price, mileage, year, horsepower
│     └─ Select ×2         brand, model
├─ CarListingCard ×n       + SourceBadge, favorite toggle
├─ ListingsMap             dynamic, ssr: false
└─ MobileMapOverlay        the map, full-screen, on small viewports
```

**`ListingsMap` is loaded via `next/dynamic` with `ssr: false`.** Leaflet needs
the DOM and will not survive server rendering. It switches CARTO tiles by theme,
drops amber `divIcon` markers, and auto-fits bounds to the current listings via a
`FitBounds` child using `useMap()`.

Consequences for tests: mock `react-leaflet` in component tests and render it for
real only in Playwright — see [testing.md](testing.md).

**Filter option constants** live in `components/map/search-filter-options.ts`.
Labels are resolved through i18n keys, never from the raw constant strings.

**`SearchFiltersProps` is exported** from `SearchFilters.tsx` and threaded
through `MapView`. Adding a filter means updating both — keep the prop names in
sync.

## UI primitives

`components/ui/` wraps Radix primitives: `button`, `card`, `input`, `label`,
`select`, `separator`, plus two with real behaviour of their own —
`range-input` and `toggle-chip`.

Composition uses `class-variance-authority` with `clsx` and `tailwind-merge`; the
`cn` helper is in `lib/utils.ts`.

**`RangeInput` is controlled.** A value only accumulates if a parent holds state.

**Icons are never raw SVG.** Lucide React for UI icons, React Icons for brand
icons. Size with Tailwind (`h-4 w-4`). Icon-only buttons need a descriptive
`aria-label`.

## Design system — Cartographic Modern

Dark-first, inspired by night maps: warm amber on deep ink. Defined in
[`app/globals.css`](../app/globals.css), where `:root` is the **dark** theme and
`.light` is warm paper. Live references at `/palette` and `/typography`.

| Token | OKLCH (dark) | Hex | Used for |
| --- | --- | --- | --- |
| `--background` | `oklch(0.16 0.015 250)` | #0F1419 | Deep ink — app background |
| `--card` | `oklch(0.20 0.015 250)` | #1C2128 | Elevated surfaces |
| `--popover` | `oklch(0.22 0.015 250)` | #262D36 | Panels, dropdowns |
| `--primary` | `oklch(0.75 0.14 75)` | #E8A849 | Amber — CTAs, highlights, markers |
| `--accent` | `oklch(0.62 0.12 160)` | #3B9B6D | Eucalyptus — success, available |
| `--destructive` | `oklch(0.58 0.18 25)` | #D94F4F | Muted red — alerts, price drops |
| `--border` | `oklch(0.28 0.01 250)` | #30363D | Structure, dividers |
| `--foreground` | `oklch(0.92 0.01 250)` | #E6EDF3 | Primary text (cream) |
| `--muted-foreground` | `oklch(0.62 0.01 250)` | #8B949E | Secondary text, metadata |

Semantic aliases also exist: `--success`, `--warning`, `--info`, and
`--chart-1..5`.

The light theme is **not** a mechanical inversion — `--primary` darkens to
`oklch(0.65 0.16 75)` for contrast on paper. Adding a token means adding both.

**Semantic usage.** Primary (amber) for CTAs, selected states, active markers and
favorited highlights. Accent (eucalyptus) for available badges, price decreases
and success. Destructive for errors, sparingly.

### Typography

Two fonts, loaded via `next/font/google` in `app/layout.tsx` and exposed as CSS
variables:

- **Plus Jakarta Sans** (`--font-sans`) — all UI text
- **JetBrains Mono** (`--font-mono`) — prices, mileage, ids, any compared number

```jsx
<h1 className="text-5xl font-extrabold tracking-tight">BuyCarMap</h1>
<span className="font-mono text-xl text-primary">€14,500</span>
<span className="text-sm text-muted-foreground">45,230 km</span>
```

Use `font-variant-numeric: tabular-nums` for numbers that are compared down a
column.

## Theming

`next-themes` with `attribute="class"`, dark by default, `.light` for light.

**Any component calling `useTheme` must wait for `mounted`**
(`lib/hooks/useMounted.ts`) or it will hydrate mismatched. Use CSS variables
(`var(--…)`) for theme-aware styles rather than branching in JS.

**The theme toggle goes through `lib/hooks/useThemeTransition.ts`**, not
`setTheme` directly. It drives the View Transitions API — an expanding-circle
`clip-path` from the click point. jsdom does not implement View Transitions, so
this is Playwright territory if anywhere.

Map tiles switch with `useTheme().resolvedTheme`:

- Dark — `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Light — `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`

## Animation

Motion (`motion/react-client`, with `AnimatePresence` from `motion/react`) rather
than CSS animations for React components.

**Reuse the presets in [`lib/animations.ts`](../lib/animations.ts)** —
`fadeInUp`, `fadeInDown`, `scaleIn`, `fadeIn(delay)`, `slideInLeft(delay)`,
`staggerContainer(delay)`, `buttonTap` — instead of re-declaring
`initial`/`animate` inline.

Animate only `transform` and `opacity`. Never animate layout properties, and
never `transition: all`. Honour `prefers-reduced-motion`.

## Internationalisation

Two locales, `en` and `es`. **The default is `es`** — a detail that has caused
real bugs, because hardcoded English strings reach most users.

Config in [`lib/i18n/config.ts`](../lib/i18n/config.ts): `LOCALES`,
`DEFAULT_LOCALE`, `COOKIE_NAME = "locale"`.

**Server.** `getLocale()` reads the `locale` cookie, then falls back to
`Accept-Language`, then the default. `getTranslations()` is used in `layout.tsx`
for metadata and SSR.

**Client.** `I18nProvider` wraps the app; `useTranslation()` returns
`{ locale, t, setLocale, isPending }`. `setLocale` writes a one-year cookie and
`router.refresh()`es inside a transition, so switching language does not blank
the page.

**All user-facing text must use `t.*` keys.** No hardcoded English or Spanish in
components. New keys go in `lib/i18n/locales/en.ts`, `es.ts` **and**
`lib/i18n/types.ts`.

Key parity is enforced by the compiler, not by a test: both locale files are
typed `: Translations`, so a missing key fails the build.

### Errors are codes, not messages

Server code cannot read the client i18n context, so Zod schemas and server
actions return **codes** (`AUTH_ERROR`, `FAVORITE_ERROR`). Forms resolve them
with `translateAuthError(t, code)` from [`lib/i18n/errors.ts`](../lib/i18n/errors.ts).

When calling `setError`, pass the **raw code** — the field translates it once at
render.

## UI quality bar

The full MUST/SHOULD/NEVER list is in [`CLAUDE.md`](../CLAUDE.md). The ones most
often missed here:

- Visible focus rings; never `outline: none` without a replacement.
- Hit targets ≥24 px, ≥44 px on mobile. Mobile `<input>` font-size ≥16 px.
- URL reflects state — filters, tabs and pagination should be deep-linkable.
- `<a>`/`<Link>` for navigation, never `<div onClick>`.
- Skeletons mirror the final content so nothing shifts.
- Long content needs `truncate`/`line-clamp-*`/`break-words`, and flex children
  need `min-w-0` before they will truncate at all.
- Redundant status cues — never colour alone.

## See also

- [architecture.md](architecture.md) — how the search actually runs
- [`specs/map-and-search.md`](specs/map-and-search.md) — the guaranteed behaviour
- [`specs/cross-cutting.md`](specs/cross-cutting.md) — locale, geography, theme
- [testing.md](testing.md) — Radix and Leaflet in jsdom
