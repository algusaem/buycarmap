---
name: BuyCarMap
description: Cartographic Modern — a dark-first theme for map-based car discovery, inspired by night maps and discovery.
colors:
  background: "oklch(0.16 0.015 250)"
  foreground: "oklch(0.92 0.01 250)"
  card: "oklch(0.2 0.015 250)"
  popover: "oklch(0.22 0.015 250)"
  primary: "oklch(0.75 0.14 75)"
  primary-foreground: "oklch(0.16 0.015 250)"
  secondary: "oklch(0.22 0.015 250)"
  muted: "oklch(0.22 0.015 250)"
  muted-foreground: "oklch(0.62 0.01 250)"
  accent: "oklch(0.62 0.12 160)"
  accent-foreground: "oklch(0.98 0.01 250)"
  destructive: "oklch(0.58 0.18 25)"
  border: "oklch(0.28 0.01 250)"
  input: "oklch(0.28 0.01 250)"
  ring: "oklch(0.75 0.14 75)"
  success: "oklch(0.62 0.12 160)"
  warning: "oklch(0.75 0.14 75)"
  info: "oklch(0.55 0.08 200)"
  source-wallapop: "oklch(0.552 0.101 178.8)"
  source-cochesnet: "oklch(0.584 0.208 34.4)"
  source-milanuncios: "oklch(0.545 0.164 136.5)"
typography:
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontWeight: 400
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontWeight: 800
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontWeight: 500
  email:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  4xl: "26px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  chip-inactive:
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
---

# Design System: BuyCarMap

## Overview

**Creative North Star: "Cartographic Modern"**

The project's own style-guide page (`app/palette/page.tsx`) names and describes the system: "Cartographic Modern — color palette for BuyCarMap, inspired by night maps and discovery." It is dark-first: a deep-ink background with amber/gold for discovery and value, and eucalyptus green for success and availability, read against the metaphor of a night map with pins lighting up as you find something worth seeing. A light theme (`.light` class, `next-themes`, dark is the default) recolors every role onto a warm-paper palette rather than inverting it mechanically.

The system is otherwise restrained: flat surfaces layered by tone (background → card → popover) rather than by shadow, a single accent-driven interaction language (amber for primary actions and selection, green for positive/available states, muted red for alerts and price drops), and one typeface pairing used everywhere.

**Key Characteristics:**
- Dark-first, with a distinct (not inverted) light variant.
- Tonal layering over shadow for most surfaces; shadow is reserved for floating and overlay elements.
- One sans-serif for everything, one monospace reserved for numbers and identifiers.
- A two-color semantic system: amber (primary/discovery) and eucalyptus (accent/success), plus a muted destructive red.

## Colors

Dark is the default and normative theme (`:root`); `.light` restates every role on a warm-paper palette. Both are defined in OKLCH in `app/globals.css`; the hex values below are the project's own documented approximations for the dark theme, from `app/palette/page.tsx`.

### Primary
- **Amber / Gold** (`#E8A849`, `oklch(0.75 0.14 75)`): CTAs, highlights, selection, primary buttons, focus rings. Documented role: "discovery, value, selected." In `.light`, `--primary` (and `--sidebar-primary`, `--chart-1`, which track it) is restated as a darker amber, `oklch(0.54 0.16 75)`, so `primary`-colored text and the `bg-primary` CTA meet contrast against the light theme's paper background — `--ring` and `--sidebar-ring` keep the lighter `oklch(0.65 0.16 75)` value, since a focus ring has no text-contrast requirement.

### Secondary (optional; omit if the project has only one accent)
- **Eucalyptus** (`#3B9B6D`, `oklch(0.62 0.12 160)`): the accent color. Documented role: "success, available, positive" — availability badges, "Good Price" tags, the success semantic color.

### Neutral
- **Deep Ink** (`#0F1419`, background): app background.
- **Elevated Surface** (`#1C2128`, card): card and elevated-surface background.
- **Panel** (`#262D36`, popover / secondary / muted): dropdowns, popovers, panels, and muted backgrounds.
- **Structure** (`#30363D`, border / input): dividers and input borders.
- **Cream Text** (`#E6EDF3`, foreground): primary text.
- **Secondary Text** (`#8B949E`, muted-foreground): secondary text and metadata.

### Source Badges (map)
Each listing's origin marketplace gets its own brand color on `/map`, independent of the Two-Accent Rule — these identify a third-party source, not an app state, and are the only place besides Primary/Accent/Destructive that carries semantic color. Fixed white text on all three passes contrast in both themes, so none of the three is redefined in `.light`.
- **Wallapop** (`#008573`, `oklch(0.552 0.101 178.8)`): the `bg-source-wallapop` badge in `components/map/SourceBadge.tsx`.
- **coches.net** (`#db3500`, `oklch(0.584 0.208 34.4)`): the `bg-source-cochesnet` badge.
- **Milanuncios** (`#3c8400`, `oklch(0.545 0.164 136.5)`): the `bg-source-milanuncios` badge.

### Named Rules (optional, powerful)
**The Two-Accent Rule.** Only two hues carry meaning: amber for primary/discovery/value, eucalyptus for success/availability. A muted red (`#D94F4F`, destructive) is the only other color with semantic weight, reserved for alerts and price drops. Every other color on screen is a neutral, except the three Source Badge colors above, which encode a marketplace's identity rather than an app state.

## Typography

**Display Font:** Plus Jakarta Sans (system-ui, sans-serif fallback)
**Body Font:** Plus Jakarta Sans (same family — one typeface for everything)
**Label/Mono Font:** JetBrains Mono (monospace fallback)

**Character:** the project's own typography page describes Plus Jakarta Sans as "a professional, geometric sans-serif that conveys trust and confidence. Clean and modern without being cold." Weight alone (300–800) carries the hierarchy; JetBrains Mono is reserved for numbers and identifiers — prices, mileage, listing IDs — where "increased height improves readability of important figures."

Common ligatures are turned off project-wide (`font-variant-ligatures: no-common-ligatures contextual` in `app/globals.css`): Plus Jakarta Sans's `fi` ligature merges the dot of the "i" into the "f", which misreads as a missing dot at UI sizes in Spanish copy ("confirma", "perfil", "filtros").

### Hierarchy
- **Hero** (ExtraBold 800, `text-7xl`, tight tracking): the largest display size in the type-scale reference; not used in product UI today.
- **Page Title** (ExtraBold 800, `text-5xl`, tight tracking): page-level headings.
- **Section Heading** (Bold 700, `text-3xl`): section headings.
- **Card Title** (Semibold 600, `text-xl`): card and listing titles.
- **Body** (Regular 400, `text-base`): descriptions and content.
- **Secondary / Label** (Regular 400, `text-sm`): metadata and labels.
- **Caption** (Regular 400, `text-xs`): captions, timestamps, fine print.
- **Numeric label** (JetBrains Mono, Medium 500, size varies by context): prices (e.g. `€14,500`), mileage (e.g. `45,230 km`), and listing IDs.

### Named Rules (optional)
**The Numbers-Are-Mono Rule.** Any price, mileage figure, or listing identifier is set in JetBrains Mono, never in the body sans. `lib/format.ts`'s formatters (`formatPrice`, `formatNumber`, `formatMileage`) are the only place these values are produced; components never format them inline.

## Layout

Pages that showcase the design system (`app/palette/page.tsx`, `app/typography/page.tsx`) use a centered `max-w-4xl` column with generous padding (`p-8`, `md:p-12`) and vertical rhythm in multiples of Tailwind's default spacing scale (`space-y-4`, `space-y-6`, `space-y-12`, `space-y-16`). Grids respond by breakpoint (`sm:grid-cols-2`, `lg:grid-cols-4`). No custom spacing or breakpoint scale is defined; both pages and components use Tailwind's default scale and breakpoints throughout.

## Elevation & Depth

Mostly flat, layered by tone rather than shadow: background → card → popover is a lightness progression, not a shadow progression. Shadow is reserved for elements that float above the layout rather than sit within it.

### Shadow Vocabulary (if applicable)
- **xs** (`shadow-xs`): resting state of inputs, the select trigger, and the `outline` button variant — a hint of lift on otherwise flat controls.
- **sm** (`shadow-sm`): cards.
- **lg** (`shadow-lg`): content that floats above the page — the select dropdown, the dropdown menu, and the slide-out sheet.
- **Leaflet zoom control** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2)`): the one hand-written (non-utility) shadow, on the map's own zoom control.

### Named Rules (optional)
**The Floats-Get-Shadow Rule.** Shadow marks content that overlays the page (dropdowns, popovers, sheets) or sits one step above resting (cards, inputs). Nothing else carries one.

## Shapes

A graduated radius scale drives every corner in the system, derived from one base (`--radius: 0.625rem` / 10px): `sm` (6px), `md` (8px), `lg` (10px), `xl` (14px), `2xl` (18px), `3xl` (22px), `4xl` (26px). Buttons, inputs, selects, and menu items use `md` (8px); cards and palette/usage swatches use `xl` (14px); chips and pill-shaped toggles use `full` (9999px). Borders are hairline and semi-transparent in places (`border-border/50`), softening dividers without removing them.

**Exception:** the custom scrollbar thumb (`app/globals.css`, `*::-webkit-scrollbar-thumb`) uses a hand-written `border-radius: 4px`, smaller than any step on the scale (`sm` is the nearest, at 6px). A scrollbar thumb is thin enough that the smallest scale step reads as a full pill rather than a rounded corner, so it keeps its own literal value instead of borrowing a token that doesn't fit.

## Components

### Buttons
- **Shape:** `rounded-md` (8px).
- **Primary:** `bg-primary` with `primary-foreground` text, `h-9 px-4 py-2` at default size (`sm`: `h-8 px-3`; `lg`: `h-10 px-6`; icon sizes are square).
- **Hover / Focus:** primary/secondary/destructive darken 10% on hover (`hover:bg-primary/90`, etc.); every variant gets a 3px focus-visible ring in the `ring` color on `:focus-visible`, never on mouse click alone.
- **Outline / Ghost / Link / Destructive / Secondary:** outline is a bordered, background-colored button with an `xs` shadow; ghost has no border or background until hover; link renders as underlined primary-colored text; destructive uses the destructive color with white text; secondary uses the secondary surface color.

### Chips (if used)
- **Style:** pill-shaped (`rounded-full`), bordered, `px-3 py-1.5`, `text-sm`.
- **State:** active uses a tinted primary background (`bg-primary/15`) with primary-colored border and text; inactive is a muted-foreground label with a faint border that strengthens on hover.

### Cards / Containers
- **Corner Style:** `rounded-xl` (14px).
- **Background:** `bg-card`.
- **Shadow Strategy:** `shadow-sm` (see Elevation & Depth).
- **Border:** hairline, full-opacity `border-border` (palette/usage examples) or `border-border/50` (many product components) depending on context.
- **Internal Padding:** `py-6` on the card shell, `px-6` on header/content/footer (a 24px rhythm).

### Inputs / Fields
- **Style:** `rounded-md` (8px), hairline border (`border-input`), transparent background, `h-9`, `shadow-xs` at rest.
- **Focus:** border switches to the `ring` color plus a 3px ring (`focus-visible:ring-ring/50 focus-visible:ring-[3px]`).
- **Error / Disabled:** invalid state rings the destructive color (`aria-invalid:ring-destructive/20`) and borders it; disabled drops opacity to 50% and blocks pointer events.

### Navigation
Not documented here: no distinct navigation visual spec was found beyond the shared card/button/input language already described above (no consultado beyond that).

### Brand marks
**Google Sign-In** (`components/auth/GoogleSignInButton.tsx`): Google's own branding guidelines (developers.google.com/identity/branding-guidelines) fix this button's colors and override the app's tokens — light `#FFFFFF` fill / `#747775` 1px stroke / `#1F1F1F` text, dark `#131314` fill / `#8E918F` 1px stroke / `#E3E3E3` text — plus the unmodified `FcGoogle` full-color "G" mark. This is the one place in the codebase where raw hex is correct rather than a smell: the values are mandated by a third party, not a design decision this system makes.

## Email

Transactional emails (`lib/email/templates/`) render outside the app's own CSS and theme entirely, so they do not — and cannot — follow the tokens above.

- **Font stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`, not Plus Jakarta Sans / JetBrains Mono. Mail clients cannot load a web font, so the templates fall back to each platform's own system sans, with Helvetica/Arial as the final fallback.
- **Colors:** `#F5F5F4` (body background) and `#FFFFFF` (card background), not `--background` / `--card`. Mail clients strip `<style>` blocks and ignore CSS custom properties, so `lib/email/templates/layout.ts` hardcodes hex equivalents and always renders light, regardless of the app's dark-first theme — most clients do not honour `prefers-color-scheme` reliably. `PRIMARY` (`#E8A849`) and `INK` (`#1C2128`) in that file are the dark-theme amber and ink hex values restated literally for the same reason.
- **Radius:** the email card uses a hardcoded `border-radius: 12px`, between the app's `xl` (14px) and `lg` (10px) tokens rather than equal to either — chosen directly in the hex-only email context, not derived from `--radius`.

### Named Rules (optional)
**The Email-Is-Its-Own-World Rule.** Nothing under `lib/email/templates/` references an app token or Tailwind class. Every value there is a literal, chosen to read correctly in a mail client that has none of the app's CSS.

## Do's and Don'ts

### Do:
- **Do** keep JetBrains Mono for prices, mileage, and listing IDs, and nowhere else.
- **Do** use amber (primary) for discovery/value/selection and eucalyptus (accent) for success/availability — the only two colors that carry meaning besides the muted destructive red.
- **Do** reserve shadow (`shadow-lg`) for content that floats above the page (dropdowns, popovers, sheets); keep resting surfaces flat or `shadow-xs`/`shadow-sm`.
- **Do** keep `font-variant-ligatures: no-common-ligatures contextual` on the body — removing it reintroduces the `fi`-ligature misread in Spanish copy.

### Don't:
- **Don't** invert the light theme mechanically from the dark one — `.light` restates each role with its own warm-paper values (`app/globals.css`), it does not just flip lightness.
- **Don't** introduce a third semantic hue; the system is deliberately amber + eucalyptus (+ muted red for alerts).
- **Don't** format a price, mileage, or date inline in a component — `lib/format.ts` is the only place that happens (`RULES.md` / FRONT-11).
