# CLAUDE.md - BuyCarMap

## Project Overview

BuyCarMap is a web application that aggregates second-hand car listings from multiple websites and displays them on an interactive map. Users can search, filter, and discover cars for sale based on location, price, and vehicle specifications.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL via Neon (serverless) with Prisma 7 ORM
- **Auth**: NextAuth 4 (Credentials provider, JWT sessions)
- **Forms**: React Hook Form + Zod validation
- **Styling**: Tailwind CSS 4
- **Animations**: Motion (formerly Framer Motion)
- **Toasts**: Sonner
- **Theming**: next-themes
- **Maps**: Leaflet + react-leaflet with CARTO tiles
- **Icons**: Lucide React (UI icons), React Icons (brand/specialized icons)
- **Language**: TypeScript

## Design System

### Theme: Cartographic Modern

A dark-first theme inspired by night maps and the feeling of discovery. Warm amber accents against deep ink backgrounds.

### Color Palette

| Token                | OKLCH                   | Hex     | Usage                                    |
| -------------------- | ----------------------- | ------- | ---------------------------------------- |
| `--background`       | `oklch(0.16 0.015 250)` | #0F1419 | Deep ink - app background                |
| `--card`             | `oklch(0.20 0.015 250)` | #1C2128 | Elevated surfaces                        |
| `--popover`          | `oklch(0.22 0.015 250)` | #262D36 | Panels, dropdowns                        |
| `--primary`          | `oklch(0.75 0.14 75)`   | #E8A849 | Amber gold - CTAs, highlights, discovery |
| `--accent`           | `oklch(0.62 0.12 160)`  | #3B9B6D | Eucalyptus - success, available listings |
| `--destructive`      | `oklch(0.58 0.18 25)`   | #D94F4F | Muted red - alerts, price drops          |
| `--border`           | `oklch(0.28 0.01 250)`  | #30363D | Structure, dividers                      |
| `--foreground`       | `oklch(0.92 0.01 250)`  | #E6EDF3 | Primary text (cream)                     |
| `--muted-foreground` | `oklch(0.62 0.01 250)`  | #8B949E | Secondary text, metadata                 |

### Typography

| Font                  | Variable      | Role      | Character                                                                                                                 |
| --------------------- | ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Plus Jakarta Sans** | `--font-sans` | Primary   | Professional geometric sans-serif. Clean, trustworthy, confident. Used for all text with weight variations for hierarchy. |
| **JetBrains Mono**    | `--font-mono` | Monospace | Developer-focused mono. For prices, mileage, listing IDs.                                                                 |

### Typography Usage

```jsx
// Hero headings (extrabold)
<h1 className="text-5xl font-extrabold tracking-tight">BuyCarMap</h1>

// Page/Card titles (bold)
<h2 className="text-2xl font-bold">Available Nearby</h2>

// Subtitles (semibold)
<h3 className="text-xl font-semibold">Card Title</h3>

// Body text (regular)
<p className="text-base">Description text...</p>

// Prices and numeric data (mono)
<span className="font-mono text-xl text-primary">€14,500</span>

// Metadata
<span className="text-sm text-muted-foreground">45,230 km</span>
```

### Semantic Color Usage

- **Primary (Amber)**: CTAs, selected states, active map markers, favorited listings, price highlights
- **Accent (Eucalyptus)**: "Available" badges, price decrease indicators, success states
- **Destructive (Red)**: Alerts, listing removed, error states (use sparingly)

### Reference Pages

- `/palette` - Visual color palette display
- `/typography` - Full type scale and usage examples

## Commands

```bash
npm run dev    # Start development server
npm run build  # Production build
npm run lint   # Run ESLint
```

## Project Structure

```
app/
  actions/              # Server actions (mutations)
  api/auth/             # NextAuth route handler
  generated/prisma/     # Generated Prisma client
  [routes]/             # Page routes
components/
  auth/                 # Auth components (LoginForm, RegisterForm, etc.)
  ui/                   # Reusable UI primitives
lib/
  auth/                 # Auth utilities (password hashing)
  i18n/                 # Internationalization
  validations/          # Zod schemas
  prisma.ts             # Prisma client instance
types/                  # TypeScript type extensions
prisma/
  schema.prisma         # Database schema
```

## Core Features

- Aggregate car listings from multiple second-hand car websites
- Display listings on an interactive map
- Search and filter by location, price, make, model, year, mileage
- Save searches and favorite listings
- Price history tracking
- Notifications for new matches

## Data Sources

Second-hand car websites to scrape/integrate:

- Wallapop
- Milanuncios
- Coches.net
- Autoscout24
- Other regional platforms

## Database Models

Key entities:

- **User**: Authentication and preferences
- **Car**: Normalized car listing data
- **Source**: Origin website metadata
- **SavedSearch**: User's saved filter configurations
- **Favorite**: User's bookmarked listings

## Development Guidelines

### Scraping

- Respect robots.txt and rate limits
- Store raw data separately from normalized data
- Handle deduplication across sources
- Track listing freshness and availability

### Map Integration

- Use a performant map library (Mapbox, Leaflet, or Google Maps)
- Cluster markers at low zoom levels
- Lazy load listing details on marker click

### API Design

- **Prefer Server Actions over API routes** for all mutations
- API routes only for webhooks, external integrations, or complex streaming
- Cache aggregated data appropriately
- Paginate large result sets

## Rules for Claude

### TypeScript

- Never use `any` or `unknown`
- Use `interface` instead of `type`
- Reusable typings go in `/interfaces`
- Small, non-reusable typings stay in the component
- Do not over-type trivial values

### Code Style

- Prefer readability over cleverness
- No unused variables, hooks, or imports
- Avoid speculative abstractions
- Never introduce patterns "just in case"
- Never over-engineer

### Icons

- **Never use raw SVGs** - always use icon libraries
- **Lucide React** (`lucide-react`): UI icons (arrows, menus, actions, etc.)
- **React Icons** (`react-icons`): Brand icons (Google, GitHub, social media) and specialized icons
- React Icons usage: `import { FaGithub } from "react-icons/fa"` (Font Awesome), `import { FcGoogle } from "react-icons/fc"` (Flat Color)
- Apply sizing with Tailwind classes: `className="h-4 w-4"`

### Animations

- **Use Motion library** instead of CSS animations for React components
- Import: `import * as motion from "motion/react-client"`
- Use `motion.div`, `motion.p`, etc. with `initial`, `animate`, `transition` props
- Stagger animations with `delay` in transition for orchestrated reveals
- Add `whileHover` and `whileTap` for interactive micro-animations
- Keep animations subtle and purposeful - avoid gratuitous motion

### Theming

- **Use next-themes** for dark/light mode switching
- `ThemeProvider` wraps the app in `layout.tsx` with `attribute="class"`
- Use `useTheme()` hook to access `resolvedTheme` and `setTheme`
- **Hydration safety**: components using `useTheme` must wait until mounted

```tsx
const { resolvedTheme, setTheme } = useTheme();
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <Placeholder />;
```

- Use CSS variables (e.g., `var(--background)`) for theme-aware styles
- Light theme activates via `.light` class on `<html>` (defined in `globals.css`)

### Map Tiles

- **Dark mode**: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- **Light mode**: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`
- Map component uses `useTheme` to switch tiles based on theme

### Forms

- **Always use React Hook Form** for form state management
- **Always use Zod** for validation schemas
- Define schemas in `lib/validations/` with exported types
- Use `zodResolver` to connect Zod schemas to React Hook Form
- Display field errors inline below inputs
- Use `isSubmitting` from `formState` for loading states

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mySchema, MyInput } from "@/lib/validations/my-schema";

const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm<MyInput>({
  resolver: zodResolver(mySchema),
});
```

### Server Actions

- **Prefer server actions over API routes** for mutations
- Place server actions in `app/actions/` directory
- Always validate input with Zod using `schema.safeParse()`
- Return typed result objects: `{ success: boolean; error?: string; data?: T }`
- Never trust client-side validation alone - always validate server-side

```tsx
"use server";
import { mySchema } from "@/lib/validations/my-schema";

export async function myAction(formData: FormData) {
  const parsed = mySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  // ... perform action
  return { success: true };
}
```

### Authentication

- Uses NextAuth 4 with Credentials provider and JWT sessions
- Auth configuration in `app/api/auth/[...nextauth]/route.ts`
- Password hashing with bcryptjs (12 salt rounds) via `lib/auth/hash.ts`
- Extended session types in `types/next-auth.d.ts`
- Use `signIn("credentials", { ... })` from `next-auth/react` for login
- Registration flow: server action creates user, then client calls `signIn`

### Toasts & Notifications

- **Use Sonner** for toast notifications
- Import: `import { toast } from "sonner"`
- Use `toast.success()` for success messages
- Use `toast.error()` for error messages
- Toaster configured in root layout - style with `classNames`, not inline styles:

```tsx
<Toaster
  toastOptions={{
    classNames: {
      toast: "bg-card border-border text-foreground",
    },
  }}
/>
```

- Prefer toasts over inline error messages for server/API errors

### React

- Avoid unnecessary `useEffect`
- Never add effects just to sync state unless required
- Prefer `.map` over `forEach`
- Do not refactor working code unless it improves correctness or clarity

### Components

- Keep components focused on a single responsibility
- Split components for readability, especially when they go beyond 250 lines.
- Reuse components **only when it reduces duplication**, not preemptively

### Styling & Layout

- Follow the existing visual design patterns
- Respect the current styling solution (Tailwind, Chakra, CSS, etc.)
- Never use absolute positioning unless strictly necessary
- Do not add arbitrary paddings or margins
- Maintain a logical and consistent spacing system
- All web apps must be responsive

### UX

- Prefer pages over modals unless a modal is clearly the better UX

### Communication

- Be direct and concise
- No emojis, filler, or motivational language
- If something is a bad idea, say it clearly

### Data Fetching

- Prefer established tools for data fetching and caching (e.g. TanStack Query)
- When such a tool is available, use it instead of manual `fetch` + `useEffect`
- Avoid duplicating API logic across components

- If not using a data-fetching library:
  - Never call `fetch` directly inside components
  - Extract API logic into reusable hooks
  - Components should only consume hooks, not manage request lifecycle

### API

- **Prefer server actions over API routes** - use actions in `app/actions/`
- API routes only when absolutely necessary (webhooks, external APIs)
- If API routes are needed: one folder per resource, one file per endpoint
- Never create aggregated or global API files (e.g. `brands.ts`, `index.ts`)

### Concise rules for building accessible, fast, delightful UIs. Use MUST/SHOULD/NEVER to guide decisions.

## Interactions

### Keyboard

- MUST: Full keyboard support per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
- MUST: Visible focus rings (`:focus-visible`; group with `:focus-within`)
- MUST: Manage focus (trap, move, return) per APG patterns
- NEVER: `outline: none` without visible focus replacement

### Targets & Input

- MUST: Hit target ≥24px (mobile ≥44px); if visual <24px, expand hit area
- MUST: Mobile `<input>` font-size ≥16px to prevent iOS zoom
- NEVER: Disable browser zoom (`user-scalable=no`, `maximum-scale=1`)
- MUST: `touch-action: manipulation` to prevent double-tap zoom
- SHOULD: Set `-webkit-tap-highlight-color` to match design

### Forms

- MUST: Hydration-safe inputs (no lost focus/value)
- NEVER: Block paste in `<input>`/`<textarea>`
- MUST: Loading buttons show spinner and keep original label
- MUST: Enter submits focused input; in `<textarea>`, ⌘/Ctrl+Enter submits
- MUST: Keep submit enabled until request starts; then disable with spinner
- MUST: Accept free text, validate after—don't block typing
- MUST: Allow incomplete form submission to surface validation
- MUST: Errors inline next to fields; on submit, focus first error
- MUST: `autocomplete` + meaningful `name`; correct `type` and `inputmode`
- SHOULD: Disable spellcheck for emails/codes/usernames
- SHOULD: Placeholders end with `…` and show example pattern
- MUST: Warn on unsaved changes before navigation
- MUST: Compatible with password managers & 2FA; allow pasting codes
- MUST: Trim values to handle text expansion trailing spaces
- MUST: No dead zones on checkboxes/radios; label+control share one hit target

### State & Navigation

- MUST: URL reflects state (deep-link filters/tabs/pagination/expanded panels)
- MUST: Back/Forward restores scroll position
- MUST: Links use `<a>`/`<Link>` for navigation (support Cmd/Ctrl/middle-click)
- NEVER: Use `<div onClick>` for navigation

### Feedback

- SHOULD: Optimistic UI; reconcile on response; on failure rollback or offer Undo
- MUST: Confirm destructive actions or provide Undo window
- MUST: Use polite `aria-live` for toasts/inline validation
- SHOULD: Ellipsis (`…`) for options opening follow-ups ("Rename…") and loading states ("Loading…")

### Touch & Drag

- MUST: Generous targets, clear affordances; avoid finicky interactions
- MUST: Delay first tooltip; subsequent peers instant
- MUST: `overscroll-behavior: contain` in modals/drawers
- MUST: During drag, disable text selection and set `inert` on dragged elements
- MUST: If it looks clickable, it must be clickable

### Autofocus

- SHOULD: Autofocus on desktop with single primary input; rarely on mobile

## Animation

- MUST: Honor `prefers-reduced-motion` (provide reduced variant or disable)
- SHOULD: Prefer CSS > Web Animations API > JS libraries
- MUST: Animate compositor-friendly props (`transform`, `opacity`) only
- NEVER: Animate layout props (`top`, `left`, `width`, `height`)
- NEVER: `transition: all`—list properties explicitly
- SHOULD: Animate only to clarify cause/effect or add deliberate delight
- SHOULD: Choose easing to match the change (size/distance/trigger)
- MUST: Animations interruptible and input-driven (no autoplay)
- MUST: Correct `transform-origin` (motion starts where it "physically" should)
- MUST: SVG transforms on `<g>` wrapper with `transform-box: fill-box`

## Layout

- SHOULD: Optical alignment; adjust ±1px when perception beats geometry
- MUST: Deliberate alignment to grid/baseline/edges—no accidental placement
- SHOULD: Balance icon/text lockups (weight/size/spacing/color)
- MUST: Verify mobile, laptop, ultra-wide (simulate ultra-wide at 50% zoom)
- MUST: Respect safe areas (`env(safe-area-inset-*)`)
- MUST: Avoid unwanted scrollbars; fix overflows
- SHOULD: Flex/grid over JS measurement for layout

## Content & Accessibility

- SHOULD: Inline help first; tooltips last resort
- MUST: Skeletons mirror final content to avoid layout shift
- MUST: `<title>` matches current context
- MUST: No dead ends; always offer next step/recovery
- MUST: Design empty/sparse/dense/error states
- SHOULD: Curly quotes (" "); avoid widows/orphans (`text-wrap: balance`)
- MUST: `font-variant-numeric: tabular-nums` for number comparisons
- MUST: Redundant status cues (not color-only); icons have text labels
- MUST: Accessible names exist even when visuals omit labels
- MUST: Use `…` character (not `...`)
- MUST: `scroll-margin-top` on headings; "Skip to content" link; hierarchical `<h1>`–`<h6>`
- MUST: Resilient to user-generated content (short/avg/very long)
- MUST: Locale-aware dates/times/numbers (`Intl.DateTimeFormat`, `Intl.NumberFormat`)
- MUST: Accurate `aria-label`; decorative elements `aria-hidden`
- MUST: Icon-only buttons have descriptive `aria-label`
- MUST: Prefer native semantics (`button`, `a`, `label`, `table`) before ARIA
- MUST: Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names

## Content Handling

- MUST: Text containers handle long content (`truncate`, `line-clamp-*`, `break-words`)
- MUST: Flex children need `min-w-0` to allow truncation
- MUST: Handle empty states—no broken UI for empty strings/arrays

## Performance

- SHOULD: Test iOS Low Power Mode and macOS Safari
- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid reflows/repaints
- MUST: Mutations (`POST`/`PATCH`/`DELETE`) target <500ms
- SHOULD: Prefer uncontrolled inputs; controlled inputs cheap per keystroke
- MUST: Virtualize large lists (>50 items)
- MUST: Preload above-fold images; lazy-load the rest
- MUST: Prevent CLS (explicit image dimensions)
- SHOULD: `<link rel="preconnect">` for CDN domains
- SHOULD: Critical fonts: `<link rel="preload" as="font">` with `font-display: swap`

## Dark Mode & Theming

- MUST: `color-scheme: dark` on `<html>` for dark themes
- SHOULD: `<meta name="theme-color">` matches page background
- MUST: Native `<select>`: explicit `background-color` and `color` (Windows fix)

## Hydration

- MUST: Inputs with `value` need `onChange` (or use `defaultValue`)
- SHOULD: Guard date/time rendering against hydration mismatch

## Design

- SHOULD: Layered shadows (ambient + direct)
- SHOULD: Crisp edges via semi-transparent borders + shadows
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: tint borders/shadows/text toward bg hue
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrast.com/) over WCAG 2
- MUST: Increase contrast on `:hover`/`:active`/`:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid dark color gradient banding (use background images when needed)
