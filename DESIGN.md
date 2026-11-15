---
name: BuyCarMap
description: BuyCarMap 2.0 — every second-hand car on one dark map, lit by a single lime light.
colors:
  bg: "#0F0F10"
  surface: "#18181B"
  surface-strong: "#1E1E22"
  line: "#2A2A2E"
  line-soft: "#232326"
  text: "#F4F2F0"
  text-muted: "#A3A0A6"
  text-legal: "#D6D3D8"
  lime: "#C6FF3D"
  on-lime: "#0F0F10"
  violet: "#7C4DFF"
  on-violet: "#FAF9F8"
  danger: "#FF5C5C"
  lime-glow: "rgba(198, 255, 61, 0.2)"
  map-ground: "#141416"
  map-road: "#232327"
  map-road-major: "#2B2B30"
  map-road-minor: "#1C1C20"
  map-water: "#111A22"
  photo-placeholder: "#2A2B30"
  photo-tint-1: "#2A2D33"
  photo-tint-2: "#302C2A"
  photo-tint-3: "#29302C"
  photo-tint-4: "#2D2A33"
  photo-tint-5: "#2A2F33"
  photo-tint-6: "#322E2A"
  photo-tint-7: "#2B2E34"
  photo-tint-8: "#2E2B30"
  photo-icon: "rgba(244, 242, 240, 0.2)"
  scrim: "rgba(15, 15, 16, 0.85)"
  handle: "#3A3A40"
  google-bg: "#131314"
  google-line: "#8E918F"
  google-text: "#E3E3E3"
  google-badge: "#FFFFFF"
typography:
  hero:
    fontFamily: "Unbounded, \"Arial Black\", system-ui, sans-serif"
    fontSize: "72px"
    fontWeight: 900
    lineHeight: 1.04
    letterSpacing: "-0.01em"
  hero-mobile:
    fontFamily: "Unbounded, \"Arial Black\", system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 900
    lineHeight: 1.06
    letterSpacing: "-0.01em"
  page-title:
    fontFamily: "Unbounded, \"Arial Black\", system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.015em"
  price:
    fontFamily: "Unbounded, \"Arial Black\", system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0"
  wordmark:
    fontFamily: "Unbounded, \"Arial Black\", system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0"
  button-display:
    fontFamily: "Unbounded, \"Arial Black\", system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0"
  lead:
    fontFamily: "\"Rethink Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "\"Rethink Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  card-title:
    fontFamily: "\"Rethink Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
  label:
    fontFamily: "\"Rethink Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.3
  meta:
    fontFamily: "\"Rethink Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "\"Rethink Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.3
  overline:
    fontFamily: "\"Rethink Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  radius-pill: "999px"
  radius-card: "22px"
  radius-field: "16px"
  radius-sheet: "26px"
  radius-panel: "28px"
  radius-preview: "24px"
  radius-thumb: "18px"
  radius-option: "12px"
  radius-skeleton: "8px"
  radius-skeleton-sm: "6px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-8: "32px"
  space-12: "48px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.on-lime}"
    rounded: "{rounded.radius-pill}"
    height: "48px"
    padding: "0 22px"
  button-primary-display:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.on-lime}"
    typography: "{typography.button-display}"
    rounded: "{rounded.radius-pill}"
    height: "56px"
    width: "100%"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.radius-pill}"
    height: "44px"
    padding: "0 18px"
  button-secondary-hover:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.text-muted}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.radius-pill}"
    padding: "10px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-strong}"
  button-ghost-undo-hover:
    textColor: "{colors.danger}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.radius-pill}"
    height: "44px"
    padding: "0 18px"
  button-danger-hover:
    borderColor: "{colors.danger}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.radius-pill}"
    size: "42px"
  button-icon-hover:
    backgroundColor: "{colors.surface-strong}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.radius-pill}"
    padding: "9px 16px"
  chip-hover:
    borderColor: "{colors.text-muted}"
  chip-pressed:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.on-violet}"
    rounded: "{rounded.radius-pill}"
    padding: "9px 16px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.radius-field}"
    height: "52px"
  input-hover:
    borderColor: "{colors.text-muted}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.radius-card}"
    padding: "24px"
  toast:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.radius-card}"
    width: "380px"
  source-badge:
    backgroundColor: "{colors.scrim}"
    textColor: "{colors.text}"
    typography: "{typography.caption}"
    rounded: "{rounded.radius-pill}"
---

# Design System: BuyCarMap

## Overview

**Creative North Star: "One light in the night"**

BuyCarMap 2.0 is black, cheeky and clean: almost everything on screen is near-black `bg` and `surface`,
two complementary inks carry every meaning (lime for what you are doing or looking at now, violet for
what is yours), and the headlines shout in uppercase like a mate who knows cars. The visual source of
truth is [`docs/design/`](docs/design/README.md) — the screens and the UI Kit in `docs/design/canvas/`,
the brand book and tokens in [`docs/design/system/`](docs/design/system/README.md) — viewed in the
Claude Design project [BuyCarMap 2.0](https://claude.ai/design/p/838f9ee3-0bcc-4990-8c5a-5a685806db48).
This file summarises that system for whoever builds a screen; where the two disagree, the design wins
and this file is corrected.

There is one theme, dark, and no theme choice anywhere. The tokens in the frontmatter are exactly
`docs/design/system/tokens.json`, and `app/globals.css` defines them under the same names (`--bg`,
`--surface`, `--lime`, `--radius-pill`, `--shadow-float`…). The map is dark and minimal, controls are
pills, and depth comes from tone and 1px lines rather than shadows.

**Key Characteristics:**
- Dark only: `bg` and `surface` make up about 95 % of any screen.
- Two accents with fixed jobs — lime is "now", violet is "yours" — plus `danger` for the irreversible.
- Unbounded in uppercase for display, Rethink Sans for everything else.
- Everything you press is a pill (`radius-pill`).
- Flat by default: three shadow roles, each for one job.

## Colors

A night with a single light: neutrals do the work, lime is the light, violet marks what belongs to you.

### Primary
- **Lime** (`lime`): the one accent — what you are doing or looking at now. Prices, the «MAP» of the
  wordmark, the punchline of a headline, primary buttons, the active pin and its card, the open
  alert's border, the legal index bar, the «Créala» / «Entra» links, link hover, the search pill
  segment value hover, the unsaved heart hover, the focus ring and a toast's action. Content on lime
  is always `on-lime`. On hover, «Créala» turns `text` instead, since it already renders in lime; it
  scales to 0.97 while pressed, off under reduced motion.
- **Lime glow** (`lime-glow`): the 7px halo around the active pin only.

### Secondary
- **Violet** (`violet`): lime's complement — what is yours and states. The saved heart, the pressed
  chip, the filter count, the account avatar, the current tab of the phone tab bar, a chosen select
  option's box, and the Descripción field's applied border. Content on violet is always `on-violet`
  (4.6:1); `on-violet` at 15 % is the hover wash of the brand chip's «Quitar».

### Tertiary
- **Danger** (`danger`): only what cannot be undone (delete account), with one reversible exception,
  «Desactivar dos pasos», a security downgrade that asks for the password and a code (amended
  2026-10-16, PAGES); the hover or focus of an undo action («Quitar filtros»); and the danger
  button's hover border. Never a large fill.

### Neutral
- **Night** (`bg`): the whole app's background. Never pure black inside the app.
- **Surface** (`surface`): raised pieces — the search pill, map preview, bottom sheet, forms, alert and
  account cards, toasts, and the headers — the map's two-row band and the phone map's top band among
  them — which stand apart from `bg` by this tone; on those bands the search pill and the phone
  summary are told apart by their 1px `line` border. It is also the secondary button's hover fill.
- **Surface strong** (`surface-strong`): one step above surface — the hovered select option, the
  skeleton's price bar, and the hover fill of ghost and icon buttons, the tab bar's tabs, the
  map's zoom buttons, the phone legal index's toggle and the map preview's close button.
- **Line** (`line`) and **soft line** (`line-soft`): 1px borders of controls, and section dividers.
  Headers draw no divider: they stand apart from the page by the `surface` tone.
- **Text** (`text`): off-white main text, never pure white. **Muted text** (`text-muted`): subtitles,
  car metadata, labels, placeholders and the empty checkbox border (7.6:1 on `bg`), and the hover
  border of secondary buttons, chips, fields, «Filtros», the phone search summary and the landing's
  phone search card. **Legal text**
  (`text-legal`): the body of the legal pages.
- **Map inks** (`map-ground`, `map-road`, `map-road-major`, `map-road-minor`, `map-water`): the dark
  minimal map.
- **Photo inks** (`photo-placeholder`, `photo-tint-1` to `photo-tint-8`, `photo-icon`): a car with no
  photo gets its own tint with the Lucide car icon, so two neighbours never look the same.
- **Single-use** (`scrim`, `handle`): badges and buttons over a photo; the bottom sheet's handle.
- **Google** (`google-bg`, `google-line`, `google-text`, `google-badge`): mandated by Google for its
  sign-in button; not brand colours.

### Named Rules
**The Lime-Is-Now Rule.** Lime marks only what you are doing or looking at now. Never running text,
never decorative borders, never large backgrounds.

**The Violet-Is-Yours Rule.** Violet marks what belongs to the user and selected states. Quick test:
lime = what you do or see now; violet = yours.

**The No-Brand-Colours Rule.** Wallapop, coches.net and Milanuncios get no colour of their own: the
source is a dark badge with its name as text.

## Typography

**Display Font:** Unbounded (with "Arial Black", system-ui, sans-serif)
**Body Font:** Rethink Sans (with system-ui, -apple-system, "Segoe UI", sans-serif)

**Character:** Unbounded is wide and heavy and always uppercase — the voice that shouts; Rethink Sans
is plain and readable — the voice that explains. Both are self-hosted (see `docs/ARCHITECTURE.md` ›
Frontend › Typography); there is no monospace face.

### Hierarchy
- **Hero** (Unbounded 900, 72px desktop / 34px phone, line-height 1.04 / 1.06, -0.01em): the punchline
  of the landing and sign-in headline, in lime. The question above it (`hero-setup`, 40px) is 0.56 of
  its size, in `text`, on one line.
- **Empty title** (Unbounded 900, 48px desktop / 28px phone): the question-and-punchline of an
  EmptyState.
- **Page title** (Unbounded 900, 40px desktop / 34px phone, line-height 0.9): one-line page titles
  (Guardados, Alertas, Cuenta), with no counter. An alert's name as its page title may take two
  lines: `alert-title`, 40px / 1.04 on desktop, `hero-mobile` 34px / 1.06 on the phone.
- **Form and legal titles** (Unbounded 800–900, `form-title` 26px, `legal-h1` 48px, `legal-h2` 20px).
- **Count and price** (Unbounded 800, 30px and 22px): the results title, which counts the cars
  («MÁS DE 40 COCHES» while more pages remain, «24 COCHES» or «1 COCHE» once the sources run out;
  «BUSCANDO COCHES…», «NINGÚN COCHE» or «COCHES» with no count, never the place under it), and every
  price, always lime, Spanish format with a thousands point (`14.500 €`, `9.500 €`), no letter-spacing.
- **Wordmark** (Unbounded 900, 20px desktop / 16px phone): «BUYCAR» in `text`, «MAP» in `lime`.
- **Button display** (Unbounded 800, 15px): the 56px full-width primary button.
- **Lead** (Rethink Sans 400, 19px / 16px phone, line-height 1.5): the subtitle under a headline, in
  `text-muted`, at most 560px wide.
- **Body** (Rethink Sans 400, 16px, line-height 1.5): running text and fields (16px so iOS does not
  zoom). **Legal body** is 17px, line-height 1.65, in `text-legal`.
- **Card title** (Rethink Sans 700, 16px): a car's name on cards.
- **Label** (Rethink Sans 700, 14px): buttons, chips, navigation links; the map's quick filters and
  its band «Filtros» are 13px. **Field label** 13px 700.
- **Meta and small** (Rethink Sans 400, 14px and 13px): car metadata separated by « · », in
  `text-muted`.
- **Caption** (Rethink Sans 700, 12px): the source badge and small badges.
- **Overline and section label** (Rethink Sans 700, 11px and 12px, 0.08em, uppercase): search pill
  segment labels and filter-sheet sections, in `text-muted`.

The full scale, with every screen-specific style, is in `docs/design/system/tokens.json` › `type`.

### Named Rules
**The Tall-Caps Rule.** Multi-line Unbounded headlines never go below line-height 1.04 (1.06 on a
phone) and never below -0.01em: the accents of Á, Í, Ó collide otherwise. A single line may use 0.9.
Break lines with sense — never one word alone on a line (`text-wrap: balance`).

**The Figures-Line-Up Rule.** Prices are Unbounded; figures compared down a column use
`font-variant-numeric: tabular-nums` in Rethink Sans. Any leftover `font-mono` class resolves to the
sans family.

## Layout

Two frames are drawn for every screen: desktop at 1440 × 900 and phone at 390 × 844.

- **Margins.** Content and headers sit 20px (`space-5`) from the phone's sides; the phone map's top
  band (the search summary, «Filtros» and the quick filters) keeps 16px (`space-4`) from the
  edges; the tab bar runs full width along the bottom. On desktop the pages' header and content take
  32px (`space-8`) side padding; the map's band and body, the landing and sign in 48px (`space-12`).
- **Rhythm.** 4, 8, 12, 16, 20, 24, 32 and 48px (`space-1` to `space-12`); 20px between columns of the
  saved and alerts grids; the desktop map's grid 24px between columns and 40px between rows
  (MAPUI-65), 24px for block padding and between groups.
- **Map screens.** Desktop: a 151px two-row `surface` band — the search pill with «Crear alerta»,
  then, in the second row, «Filtros», the quick filters and, left-aligned at 1440px and wider, the
  Descripción field — and under it the list and the map in two halves 48px apart,
  the map a rounded card aligned with the list's heading; the list in two columns, three from 1920px.
  Phone: a solid `surface` band with the search summary, the round «Filtros» and the quick filters,
  the map under it, the results in a bottom sheet over the tab bar. List and map stay in sync on every screen
  with a map (Mapa, Guardados, Alertas).
- **Pages.** Saved cars and alerts are never without a map on desktop (a list beside it, 546px wide
  from 1024px and 830px from 1280px);
  account is a three-column grid of cards with no map; legal pages are a 720px reading column with an
  index; sign-in screens put the headline left and the form right.
- **Hit targets.** At least 44px on a phone; fields at 16px.

The per-screen structure is in `docs/design/system/README.md`.

## Elevation & Depth

Flat by default. Depth comes from tone (`bg` → `surface` → `surface-strong`) and 1px `line` borders,
not from shadows. Only three roles carry one.

### Shadow Vocabulary
- **Float** (`shadow-float`, `0 24px 50px rgba(0, 0, 0, 0.55)`): what floats over content — the map
  preview, the toast and an open select list.
- **Active pin** (`shadow-pin-active`, `0 0 0 7px rgba(198, 255, 61, 0.2)`): the halo of the active
  price pin; no other pin has a shadow.
- **Current** (`shadow-current`, `0 0 0 3px #0F0F10, 0 0 0 5px #F4F2F0`; `shadow-current-sm`,
  `0 0 0 2px #0F0F10, 0 0 0 4px #F4F2F0` on a phone): the ring around the header avatar while on
  Cuenta.

### Named Rules
**The Only-What-Floats Rule.** A shadow means the piece floats above the page or is the active pin.
Nothing at rest carries one.

## Shapes

Round and soft. Everything you press is a full pill (`radius-pill`, 999px): buttons, chips, the
search pill, pins, badges. Containers step down by size: forms and the landing map
`radius-panel` (28px), the bottom sheet `radius-sheet` (26px), the map preview `radius-preview`
(24px), cards and car photos `radius-card` (22px), the phone thumbnail `radius-thumb` (18px), fields
and small photos `radius-field` (16px), select options `radius-option` (12px), skeleton bars
`radius-skeleton` / `radius-skeleton-sm` (8 / 6px). Borders are 1px `line`; dividers `line-soft`;
a divider inside a control (the pill's segments, the band's divider before the quick filters) is
`line`.

Focus is drawn the same way everywhere: a 2px `lime` outline offset by 3px — except the car cards
(the map's list, Guardados, an alert's matches), where the photo's lime ring is the focus
indicator while the card's link has focus (MAPUI-66).

## Components

Each component's full guidelines and preview live in
`docs/design/system/components/<Name>/README.md`; the summaries below are the parts every screen
shares. The roadmap (`docs/design/roadmap.md`) says which phase builds each one.

### Motion
- **Timing:** one curve, `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`), and three durations:
  `fast` 120ms for every state change (hover, focus, press, a pressed chip), `base` 180ms for
  popovers, dropdowns, the map preview, fades and the legal index fold, `sheet` 240ms for phone sheets and dialogs that
  slide, and the legal article's entrance (a sheet that fades uses `base`). No CSS transition or
  Motion preset runs at 300ms or longer; the loading pulse, the spinners and MapLibre's own zoom are
  outside this scale ([motion spec](docs/specs/motion.md)).
- **Press:** buttons, chips and the other pressable controls scale to 0.97 while pressed; never
  under reduced motion, and never on listing cards.
- **Never animated:** the results list, the saved list, the alerts list, the type-ahead lists, the
  card rings and the price pins; and anything a key opens or closes, which appears and leaves at
  once.

### Buttons
- **Shape:** full pill; the label never wraps onto a second line.
- **Primary:** `lime` with `on-lime`, weight 800; one per task, two per view at most when the tasks
  differ. Heights 56 (full width, `button-display`), 54, 52, 48 and 42px.
- **Secondary:** 1px `line` border, `text`, weight 700 (48, 44 or 40px — «Crear alerta» in the map's
  band is 40px; «Filtros» in the band is 34px at 13px). **Ghost:** text only; the undo
  ghost («Quitar filtros») turns `danger` on hover and focus. **Danger:** `danger` text and a `danger`
  border at 60 %, always with confirmation. **Icon:** 42px round with a `line` border and a required
  `aria-label`; saved turns it `violet`. Anything drawn under 44px keeps a 44 × 44px hit area on a
  phone.
- **Hover and press:** primary brightens slightly; secondary turns its border `text-muted` and fills
  with `surface`; ghost and icon fill with `surface-strong`; every button scales to 0.97 while
  pressed. The undo ghost's colour still changes at once.
- Guidelines: [Button](docs/design/system/components/Button/README.md).

### Chips
- **Style:** a button with `aria-pressed`; unpressed is a 1px `line` border at weight 600, pressed is
  a `violet` fill with `on-violet` text at weight 800 — fill and weight change, not colour alone.
  On hover an unpressed chip turns its border `text-muted`; every chip scales to 0.97 while pressed.
- **Quick-filter chip:** on the map, «Gasolina», «Diésel», «Manual», «Automático» and «Hasta
  100.000 km», 34px and 13px, with the same weights, 600 unpressed and 800 pressed; they apply at
  once.
- **Removable chip:** only for the brand chosen in «Coche», a 36px `violet` chip with `on-violet`
  text at weight 800 and a 14px `x` in a 44 × 44 icon button named «Quitar <marca>»; the map has no
  removable filter chips.
- **Single-choice radio chip groups:** the radius chips, the price shortcuts and «Cambio» are native
  radios in a `radiogroup`, drawn as chips (chosen: `violet` fill, `on-violet` text, weight 800;
  otherwise a `line` border at weight 600) or, for «Cambio», as a segmented `surface` pill whose
  chosen option is inverted. Every option keeps a 44px-tall hit area.
- «Filtros» is a secondary button, not a chip. [Chip](docs/design/system/components/Chip/README.md).

### Cards / Containers
- `surface`, 1px `line` border, `radius-card`. AccountCard takes 24px of padding; AlertCard 18px
  20px (16px on the phone), 12px between blocks, and the open alert takes a `lime` border. Sign-in
  panels use `radius-panel`.
  [AccountCard](docs/design/system/components/AccountCard/README.md),
  [AlertCard](docs/design/system/components/AlertCard/README.md).
- **The account edit dialog:** each AccountCard's button opens its form in Crear alerta's centred
  380px dialog over the page dimmed to 72 % on desktop, and in a bottom sheet on the phone; the
  48px primary over a 44px ghost «Cancelar»; it cannot close while its request runs.
  [AccountCard › Editar](docs/design/system/components/AccountCard/README.md).

### Inputs / Fields
- **Style:** 52px, `radius-field`, `bg` fill, 1px `line` border, 16px text, placeholders in
  `text-muted`. **Hover:** while not focused, the border turns `text-muted`. **Focus:** the border
  turns `lime`, both in the 120ms state transition. The password field adds a four-step meter in
  `lime` and `line`. The password field has a show/hide `eye` / `eye-off` button at its right end,
  44px target; on hover it turns `text` over the ghost `surface-strong` fill and presses to 0.97.
  **Error:** the message sits 8px under the field, an 18px `circle-alert` in `danger`
  and 14px weight 600 `text`; the border does not change.
  [PasswordField](docs/design/system/components/PasswordField/README.md).
- **Descripción field exception:** the map's filter-row field, 240 × 34px, `radius-pill` instead of
  `radius-field`, 13px text at weight 600, placeholders in `text-muted`. Applied text: `violet`
  border and weight 800. Focus: `lime` border, weight unchanged. The LOOK-13 exception: on a coarse
  pointer the text is 16px, at the same height.

### Select
- One style, always with checkboxes: the trigger is a field with a `chevron-down`; the list is
  `surface`, `line`, `radius-field`, `shadow-float`. Options are 44px, the hovered one in
  `surface-strong`, the chosen one weight 700 with a `violet` box; the trigger lists the chosen values
  separated by commas and truncates with «…», with no counter.
  [Select](docs/design/system/components/Select/README.md).

### Toast
- `surface`, 1px `line`, `radius-card`, `shadow-float`, 380px at most, 12px under the header (under
  the header band on the desktop map), centred over the list column where a map sits beside a list and
  on the viewport elsewhere; each page sets it with `data-toast-anchor`. A 18px icon
  (`lime` success, `danger` failure), 15px text, an optional `lime` ghost action and a 32px close button
  with an `aria-label`. Never for a form error. [Toast](docs/design/system/components/Toast/README.md).

### Navigation
- **Header:** the wordmark left, navigation right; 80px on desktop (the map's band 151px), 64px on a
  phone; the current page
  is an inverted pill (`text` fill, `bg` text) with `aria-current="page"`; links, icon links,
  «Volver» and the wordmark turn `lime` on hover, the avatar darkens slightly (brightness 92%), so
  its on-violet content keeps its contrast, and each scales to 0.97 while pressed.
  One header per kind of page: the map (the search group in the centre; on the right the language,
  heart and bell icon links and the avatar, or «Entrar» signed out), the pages — Guardados, Alertas,
  Cuenta and the signed-in landing (Mapa · Guardados · Alertas and the avatar), the signed-out
  landing («Entrar», «Crear cuenta») and the sign-in and legal pages («Volver al mapa»). The not-found page takes the sign-in header
  signed out and the pages header with nothing current signed in. The phone map has no header.
  [HeaderNav](docs/design/system/components/HeaderNav/README.md),
  [Wordmark](docs/design/system/components/Wordmark/README.md).
- **Avatar:** desktop only, a 42px `violet` circle with the user's initial in Unbounded, linking to
  Cuenta, in the map and page headers and on the signed-in landing; on Cuenta it is the current item,
  marked by the `shadow-current` ring. A phone header has no avatar: «Cuenta» is a tab of the tab bar.
  On the signed-in landing the phone header shows only the wordmark and the language; «Cuenta» is
  in the tab bar.
- **Language «ES · EN»:** in every header, a group of two 44 × 44 buttons in 13px Rethink Sans, the
  active one `text` weight 800 and pressed, the other `text-muted` weight 600; no accent, fill or
  border. On hover a button turns `text`, and it scales to 0.97 while pressed. [HeaderNav](docs/design/system/components/HeaderNav/README.md).
- **Tab bar:** on a phone, a full-width `surface` bar along the bottom with a 1px `line` top border:
  64px tabs plus the safe area. Signed in, four tabs — Mapa · Guardados · Alertas · Cuenta — each an
  icon over an 11px label; the current one has a `violet` icon and its label in `text` at weight 800
  (violet text on `surface` fails 4.5:1), with `aria-current="page"`, and «Cuenta» shows the user's initial. Signed out, on the map, two tabs: Mapa
  and Entrar. It is on the map, Guardados, Alertas, an alert's page and Cuenta, and the signed-in
  landing and the signed-in not-found page, with no tab marked, never at desktop width.
  On the map it hides only while the results sheet is full; on the pages it hides while scrolling down
  and comes back on scrolling up. A tab fills with `surface-strong` on hover and scales to 0.97
  while pressed. [BottomNav](docs/design/system/components/BottomNav/README.md).
- **Legal index:** the legal pages' «En esta página»: from `lg` a sticky 260px column beside the
  text, the section on screen in `text` with a 2px `lime` bar and `aria-current="location"`; on a
  phone a `surface` field after the date that opens the same list inside it.
  [LegalToc](docs/design/system/components/LegalToc/README.md).
- **Footer:** one discreet 12px `text-muted` line — «Privacidad · Términos · Ilustraciones de
  Storyset» — on the landing, sign-in, register, the confirm, password-recovery and new-password pages, and the
  legal pages only; never on the map screens, saved cars, alerts, account or the not-found page. The Storyset credit is required by its licence.
  [Footer](docs/design/system/components/Footer/README.md).

### Map
- **Price pin:** a `surface` pill with the price; the active one turns `lime` / `on-lime`, weight 800,
  with the `lime-glow` halo. [PricePin](docs/design/system/components/PricePin/README.md).
- **Map preview:** the quick card over the map, `surface`, `radius-preview`, `shadow-float`, 340px.
  On hover its close fills with `surface-strong`, «Ver anuncio» brightens and the heart turns
  `lime` (once saved, darkens slightly instead, brightness 92%, so its on-violet content keeps its
  contrast).
  [MapPreview](docs/design/system/components/MapPreview/README.md).
- **Search pill:** Dónde · Coche · Precio segments with a `lime` button. On hover a segment's
  value turns `lime` and «Buscar» brightens.
  [SearchPill](docs/design/system/components/SearchPill/README.md).
- Also [BottomSheet](docs/design/system/components/BottomSheet/README.md),
  [FilterSheet](docs/design/system/components/FilterSheet/README.md),
  [StatusPill](docs/design/system/components/StatusPill/README.md),
  [MapZoom](docs/design/system/components/MapZoom/README.md) and
  [AlertZone](docs/design/system/components/AlertZone/README.md) (a 2px `lime` ring at 80 % with a
  10 % `lime` veil, never dashed).

### Listings
- **Listing card:** the photo is the hero (`radius-card`, a tint when missing), name, city, metadata
  and the price in Unbounded `lime`; the active card gets a 2px `lime` outline.
  [ListingCard](docs/design/system/components/ListingCard/README.md).
- **Source badge:** identical for every source — `scrim` background, the source's name as `text` in
  `caption`; no marketplace colour.

### Headlines and empty states
- **Headline:** a question in `text` and a punchline in `lime`, no full stop.
  [Headline](docs/design/system/components/Headline/README.md).
- **Empty state:** inside the real screen, a headline, one `text-muted` line and the actions, no icon
  on top; loading draws skeletons shaped like the cards (`surface` bars, the price bar in
  `surface-strong`). [EmptyState](docs/design/system/components/EmptyState/README.md).

### Brand marks
- **Google sign-in:** 52px full width, `radius-pill`, `google-bg` fill, 1px `google-line` border,
  `google-text` label, Google's official «G» on desktop; on a phone it goes without the «G». The
  only colours that are not the brand's, because Google mandates them.
  [GoogleButton](docs/design/system/components/GoogleButton/README.md).

## Do's and Don'ts

### Do:
- **Do** keep `bg` and `surface` as the bulk of every screen, and use `text` and `text-muted` for text.
- **Do** use lime only for what is happening now, with `on-lime` on top, and violet only for what is
  yours, with `on-violet` on top.
- **Do** mark state with more than colour: a pressed chip changes fill and weight (the quick
  filters too, 600 to 800); the active pin changes fill, size and halo.
- **Do** set display type in Unbounded uppercase and everything else in Rethink Sans.
- **Do** make every pressable thing a pill and keep a 44px minimum target on a phone.
- **Do** use Lucide icons at 2px stroke in the colour of the surrounding text.
- **Do** format prices, mileage and dates through `lib/format.ts` (FRONT-11): `14.500 €`, `9.500 €`,
  `95.000 km`.

### Don't:
- **Don't** put lime on running text, decorative borders or large backgrounds.
- **Don't** use pure white or pure black inside the app.
- **Don't** colour a source by its marketplace brand.
- **Don't** add a shadow outside the three roles in Elevation & Depth.
- **Don't** add a theme switch: the product has one dark theme.
- **Don't** add a navigation menu sheet, a hamburger or an account dropdown: every destination has a
  place in a header, the tab bar or the account page.
- **Don't** put an icon above an empty-state headline, or use emoji.
- **Don't** write «Bienvenido a…», «Descubre…» or invented figures; the voice rules are in
  `docs/design/system/README.md`.

## Email
Transactional emails (`emails/*.tsx`) are built with **react-email** (INT-15).

They use `@react-email/components` and are rendered to HTML and plain text with
`@react-email/render`. They render outside the app's CSS entirely, so they do not — and cannot —
follow the tokens above. They keep their own palette until issue
#123 brings them into BuyCarMap 2.0.

- **Font stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`, not
  Unbounded or Rethink Sans. Mail clients cannot load a web font, so the templates fall back to each
  platform's own system sans, with Helvetica/Arial last.
- **Colours:** `#F5F5F4` (body background) and `#FFFFFF` (card background). Mail clients strip
  `<style>` blocks and ignore CSS custom properties, so `emails/components.tsx`'s shared `EmailLayout`
  hardcodes hex values as inline styles on each react-email component and always renders on a white
  card — most clients do not honour `prefers-color-scheme` reliably. `PRIMARY` (`#E8A849`) and `INK`
  (`#1C2128`) in that file are the previous palette's amber and ink, kept until issue #123.
- **Radius:** the email card uses a hardcoded `border-radius: 12px`, chosen directly in the hex-only
  email context, not derived from an app token.

### Named Rules
**The Email-Is-Its-Own-World Rule.** Nothing under `emails/` references an app token or Tailwind
class. Every value there is a literal, chosen to read correctly in a mail client that has none of the
app's CSS.
