# Redesign F1 — visual foundation

Key: LOOK
Status: Implemented
Last updated: 2026-10-13

---

## Problem

The approved BuyCarMap 2.0 design (`docs/design/`, owner-approved 2026-10-11/12) replaces the whole
look of the app: a single near-black theme, two complementary accents with fixed jobs (lime for what
you are doing now, violet for what is yours), Unbounded for display and Rethink Sans for text, pill
controls and a minimal dark map. Today every screen still draws the old "Cartographic Modern" world:
an amber and eucalyptus palette in OKLCH, a light theme behind a toggle, Plus Jakarta Sans with
JetBrains Mono for numbers, `rounded-md` controls and source badges painted in each marketplace's
brand colour. Until the shared layer changes, every later phase (navigation, map, landing, saved cars,
alerts) would have to restyle the same primitives again and would ship screens that clash with the
ones next to them.

The design also has no light variant. A user who picked the light theme keeps a choice the product
no longer offers, and the toggle, the stored choice and every "both themes" check are cost with no
design behind them.

In scope: the theme tokens and their aliases, dark only (no theme choice anywhere), the two font
families, the shared primitives (button, input, select, toggle chip, card, skeleton, toast), the
source badge, the site footer with the Storyset credit, `DESIGN.md` and its sidecar regenerated from
the design system, and the internal style-guide pages. No screen changes its structure in this phase.

## Acceptance criteria

- [x] LOOK-1 · node — `app/globals.css` defines the design tokens with exactly the values of
  `docs/design/system/tokens.json` (colour, radius, shadow) as CSS variables on `:root`, and contains
  no `.light` block and no OKLCH value.
- [x] LOOK-2 · node — The utility tokens the existing components use (`background`, `foreground`,
  `card`, `popover`, `border`, `input`, `muted`, `muted-foreground`, `primary`, `primary-foreground`,
  `secondary`, `accent`, `destructive`, `ring`) resolve to the design tokens listed in the worked
  example, so every existing class takes the new palette without a component edit.
- [x] LOOK-3 · e2e — Every page renders in the dark theme: the `html` element carries the `dark`
  class and a computed `color-scheme` of `dark`, the `body` background computes to `rgb(15, 15, 16)`,
  and `<meta name="theme-color">` is `#0F0F10`. Checked on `/`, `/login` and `/map`.
- [x] LOOK-4 · e2e — A stored `theme=light` from an earlier version is ignored: with that value in
  `localStorage` before load, `/` still renders as LOOK-3 describes.
- [x] LOOK-5 · component — No theme control is rendered anywhere: the navbar on desktop and its phone
  menu contain no button whose name matches the old theme labels ("Dark", "Light", "Oscuro",
  "Claro").
- [x] LOOK-6 · node — The root layout loads Rethink Sans as `--font-sans` and Unbounded as
  `--font-display` through `next/font/local` from committed `woff2` files, each family folder under
  `app/fonts/` ships its `OFL.txt`, no file imports `next/font/google`, and the Plus Jakarta Sans and
  JetBrains Mono files are gone.
- [x] LOOK-7 · e2e — The fonts are the ones in use: on `/` the first family in `body`'s computed `font-family` is the
  Rethink Sans face that `next/font/local` registers (it names the face after its loader, e.g.
  `rethinkSans`) and that face is loaded, and the registered Unbounded face loads when requested.
- [x] LOOK-8 · node — Classes still using `font-mono` (in components outside this phase) resolve to
  the sans family, so no text falls back to the browser's monospace before its phase restyles it.
- [x] LOOK-9 · e2e — On the style guide (`/palette`), each button variant computes to the design:
  primary is `lime` with `on-lime` text, secondary has a 1px `line` border, ghost has no border or
  fill, danger has `danger` text and a `danger` border at 60 %, all pill-shaped (`border-radius` ≥
  height / 2), at the heights the design uses (56 full-width display, 54, 52, 48, 44 and 42px); the
  icon button is 42px square and round; no button wraps its label onto a second line. Every button
  drawn under 44px (the 42px buttons and the 40px close button) has a hit area of at least 44 × 44px
  at phone width (RULES §19), without changing its drawn size.
- [x] LOOK-10 · e2e — The ghost button marked as an undo action ("Quitar filtros") turns its text to
  `danger` on hover and on keyboard focus, and back to `text` when neither applies.
- [x] LOOK-11 · e2e — Keyboard focus is visible on every primitive: a focused button, chip, input and
  select trigger shows a 2px `lime` outline offset by 3px. — the select trigger is the checkbox
  select's trigger on `/palette`, the Radix select trigger being deleted (MAPUI-48)
  (amended 2026-10-13, MAPUI — redesign-map.md)
- [x] LOOK-12 · e2e — A pressed toggle chip differs from an unpressed one in fill (`violet` with
  `on-violet` text) and in weight (800 against 600), not in colour alone.
- [x] LOOK-13 · e2e — Inputs and the select trigger are at least 52px tall with a 16px font size
  (no iOS zoom), a `line` border at rest and a `lime` border when focused. — the select trigger is
  the checkbox select's trigger on `/palette`, the Radix select trigger being deleted (MAPUI-48)
  (amended 2026-10-13, MAPUI — redesign-map.md)
- [x] LOOK-14 · e2e — A toast renders on `surface` with a `line` border, `radius-card`,
  `shadow-float` and `text` colour; its optional action is `lime` text and its close button has an
  accessible name (amends FRONT-23 to the single theme).
- [x] LOOK-15 · component — The source badge looks the same for all three sources: Wallapop,
  coches.net and Milanuncios render with an identical class list, and the source name is the badge's
  text.
- [x] LOOK-16 · component — The footer shows «Privacidad» linking to `/privacy`, «Términos» linking
  to `/terms` and «Ilustraciones de Storyset» whose «Storyset» links to `https://storyset.com` in a
  new tab with `rel="noopener noreferrer"`; in English it reads "Privacy", "Terms" and "Illustrations
  by Storyset".
- [x] LOOK-17 · e2e — At desktop width the footer is present on `/`, `/login`, `/register`,
  `/privacy` and `/terms`, and absent on `/map`, `/favorites` and `/alerts`; at phone width there is no
  footer (the design draws none on mobile).
- [x] LOOK-18 · e2e — axe reports no violation, colour contrast included, on the FRONT-19 flows in
  the single dark theme (amends FRONT-19).
- [x] LOOK-19 · node — `DESIGN.md` follows the canonical section order (Overview, Colors, Typography,
  Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts, plus Email), its frontmatter colours
  equal the colour tokens of `tokens.json`, it names Unbounded and Rethink Sans, it says nothing of a
  light theme, its Email section still names react-email (INT-15), and `.impeccable/design.json`
  exists and parses as JSON.
- [x] LOOK-20 · node — The style-guide pages show the current system: `/palette` lists every colour
  token of `app/globals.css` with its value, and neither `/palette` nor `/typography` mentions
  "Cartographic Modern", Plus Jakarta Sans or JetBrains Mono.
- [x] LOOK-21 · component — The select has one style, always with checkboxes: every option renders a
  checkbox whose checked state follows `aria-selected`, a chosen option is weight 700 with a `violet`
  box, several options can be chosen at once, and the trigger lists the chosen values separated by
  commas (truncated with «…» when they do not fit), with no counter.

## Worked examples

**LOOK-1 — tokens** (from `docs/design/system/tokens.json`, 35 colours, 10 radii, 4 shadows). Colours: `bg #0F0F10` · `surface #18181B` · `surface-strong #1E1E22` · `line #2A2A2E` · `line-soft #232326` · `text #F4F2F0` · `text-muted #A3A0A6` · `text-legal #D6D3D8` · `lime #C6FF3D` · `on-lime #0F0F10` · `violet #7C4DFF` · `on-violet #FAF9F8` · `danger #FF5C5C` · `lime-glow rgba(198, 255, 61, 0.2)` · `map-ground #141416` · `map-road #232327` · `map-road-major #2B2B30` · `map-road-minor #1C1C20` · `map-water #111A22` · `photo-placeholder #2A2B30` · `photo-tint-1 #2A2D33` · `photo-tint-2 #302C2A` · `photo-tint-3 #29302C` · `photo-tint-4 #2D2A33` · `photo-tint-5 #2A2F33` · `photo-tint-6 #322E2A` · `photo-tint-7 #2B2E34` · `photo-tint-8 #2E2B30` · `photo-icon rgba(244, 242, 240, 0.2)` · `scrim rgba(15, 15, 16, 0.85)` · `handle #3A3A40` · `google-bg #131314` · `google-line #8E918F` · `google-text #E3E3E3` · `google-badge #FFFFFF`. Radii: `radius-pill 999px` · `radius-card 22px` · `radius-field 16px` · `radius-sheet 26px` · `radius-panel 28px` · `radius-preview 24px` · `radius-thumb 18px` · `radius-option 12px` · `radius-skeleton 8px` · `radius-skeleton-sm 6px`. Shadows: `shadow-float 0 24px 50px rgba(0, 0, 0, 0.55)` · `shadow-pin-active 0 0 0 7px rgba(198, 255, 61, 0.2)` · `shadow-current 0 0 0 3px #0F0F10, 0 0 0 5px #F4F2F0` · `shadow-current-sm 0 0 0 2px #0F0F10, 0 0 0 4px #F4F2F0`.

**LOOK-2 — aliases**

| Utility token | Resolves to |
| --- | --- |
| `background` | `bg` |
| `foreground` | `text` |
| `card`, `popover`, `muted`, `secondary`, `accent` | `surface` |
| `border`, `input` | `line` |
| `muted-foreground` | `text-muted` |
| `primary` / `primary-foreground` | `lime` / `on-lime` |
| `destructive` | `danger` |
| `ring` | `lime` |

**LOOK-3** — `/map` on load: `document.documentElement.classList.contains("dark") === true`,
`getComputedStyle(document.documentElement).colorScheme === "dark"`,
`getComputedStyle(document.body).backgroundColor === "rgb(15, 15, 16)"`,
`document.querySelector('meta[name="theme-color"]').content === "#0F0F10"`.

**LOOK-4** — `localStorage.setItem("theme", "light")`, reload `/`: the four values of LOOK-3 hold.

**LOOK-21** — Combustible with Gasolina, Diésel and Híbrido chosen: three options with
`aria-selected="true"` and a checked `violet` box, Eléctrico and GLP unchecked; trigger text
«Gasolina, Diésel, Híbrido».

**LOOK-12** — chip «Todos» pressed: `aria-pressed="true"`, background `rgb(124, 77, 255)`, colour
`rgb(250, 249, 248)`, `font-weight: 800`; chip «Diésel» unpressed: `aria-pressed="false"`, 1px
border `rgb(42, 42, 46)`, `font-weight: 600`.

**LOOK-16** — `es`: «Privacidad» → `/privacy`, «Términos» → `/terms`, «Ilustraciones de Storyset».
`en`: "Privacy" → `/privacy`, "Terms" → `/terms`, "Illustrations by Storyset". The English copy is
owner-approved (2026-10-12).

No criterion is on the critical list (no permission boundary, no bug fix); the values above come
from the approved design.

## Data model

None. The phase reads no model and changes no schema.

## Permissions

The phase touches no user data and no authorization: it changes how every page looks, not what any
user may see or do.

## Edge cases

- A visitor with `theme=light` stored by the old app (LOOK-4) gets the dark theme; the stale key is
  left in place and harmless.
- A font file fails to load: the `next/font/local` declarations carry fallback stacks
  (`system-ui, -apple-system, "Segoe UI", sans-serif` for sans; `"Arial Black", system-ui,
  sans-serif` for display, as in `tokens.json`), so text stays readable (LOOK-6).
- Components outside this phase that still use `font-mono` (LOOK-8) or old utility names (LOOK-2)
  keep rendering in the new palette and family until their own phase rewrites them.
- Reduced motion: the primitives' hover and focus changes are colour and outline transitions only
  (no `transition: all`), and Motion's `reducedMotion="user"` stays in the root provider (FRONT-29).
- Contrast: lime and violet pairs meet AA (`on-lime` on `lime` > 15:1, `on-violet` on `violet`
  4.6:1, `text-muted` on `bg` 7.6:1); LOOK-18 proves it on the real pages.

## Out of scope

- The navbar and the phone bottom nav (F2). Only the theme control leaves the navbar now (LOOK-5).
- The map: price pins, preview card, list–map sync, search pill, filters sheet, bottom sheet, tile
  style (F3). The tiles drop to the dark CARTO style only, because the light URL has no theme left
  to serve (MAP-23 amended).
- Landing and sign-in layouts, headlines, illustrations and arrows (F4). They get the footer now.
- Saved cars (F5), alerts (F6), register, account, password and legal page layouts (F7).
- Emails, which keep their palette (issue #123).
- New illustrations or icons; the Google sign-in button keeps Google's mandated dark colours.

## Contracts

New i18n keys, both locales (`messages/es.json`, `messages/en.json`, `lib/i18n/types.ts`):
`footer.privacy` («Privacidad» / "Privacy"), `footer.terms` («Términos» / "Terms"),
`footer.illustrations` («Ilustraciones de {storyset}» / "Illustrations by {storyset}"). Removed:
`theme.dark`, `theme.light`.

Font files: `app/fonts/rethink-sans/rethink-sans-latin-wght-normal.woff2`,
`app/fonts/rethink-sans/OFL.txt`, `app/fonts/unbounded/unbounded-latin-wght-normal.woff2`,
`app/fonts/unbounded/OFL.txt` (latin subset — U+0000-00FF, which covers Spanish — variable weight axis).

**Criteria in other specs this phase changes** (each amended in the same PR, statement kept and
marked):

- CORE-10 (`cross-cutting.md`) — withdrawn: there is no theme to switch. Its Contracts line on
  next-themes is removed.
- FRONT-19 — "in both themes" becomes "in the dark theme"; the per-theme edge case goes.
- FRONT-23 — the toast takes `surface` / `line` / `text`, one theme (LOOK-14).
- FRONT-26 — families become Rethink Sans and Unbounded with the paths above; `--font-mono` is no
  longer required (LOOK-6, LOOK-8).
- FRONT-27 — the privacy copy drops the sentence about the theme kept in `localStorage`.
- FRONT-29 — `MotionConfig reducedMotion="user"` moves to `components/MotionProvider.tsx`.
- MAP-23 — only the dark tile URL remains and carries the key.
- NAV-14 — the phone menu still reaches the language control; the theme control is gone.
- PLAT-23 — the nonce no longer feeds a theme script; the CSP keeps working for the map, login and
  favorites.

## Decisions and rationale

**Aliases rather than a rename.** About 600 class usages across 60 files name the shadcn tokens
(`bg-card`, `text-muted-foreground`, `border-border`…). Remapping those names to the design tokens
(LOOK-2) moves the whole app to the new palette in one place and leaves each screen's markup to its
own phase, where it is rewritten anyway. The design tokens are also exposed under their own names
(`--bg`, `--surface`, `--lime`…) so new code writes the design's vocabulary. `accent` maps to
`surface`, not `violet`, because today it paints hover backgrounds: violet there would turn every
hover into a "this is yours" state.

**Remove next-themes instead of forcing it dark.** With one theme, next-themes only adds an inline
script (which is why it needs the CSP nonce), a stored preference and a hydration guard. A static
`class="dark"` on `<html>` plus `color-scheme: dark` and the `theme-color` meta give the same page
with less code; `useThemeTransition`, `ThemeSwitcher` and their `useMounted` callers go with it, and
the Toaster, the map tiles and the Google button read a constant. The `dark` class stays because the
`dark:` variants in `button.tsx` and `input.tsx` key off it until those primitives are rewritten.

**`font-mono` aliased to sans.** The old "numbers are mono" rule is replaced by Unbounded for prices
and `tabular-nums` for figures that line up. Eleven out-of-phase files still say `font-mono`; mapping
it to the sans family keeps them coherent until their phase, instead of falling back to a system
monospace.

**The footer now, on the pages the design names.** The Storyset licence requires the credit wherever
the illustrations appear, and the legal links have no home outside the sign-in form today. The
design restricts the footer to the landing, sign in, register and legal pages, and keeps the map
screens edge to edge, so LOOK-17 tests both sides.

**The checkbox select is a new primitive.** `components/ui/select.tsx` wraps Radix Select, which picks
one value; the radius picker and the search filters use it today, and both are F3 screens. LOOK-21
builds the checkbox select as `components/ui/checkbox-select.tsx` and shows it on `/palette`; the Radix
select only takes the new trigger look (LOOK-13) until F3 replaces its uses with the design's controls
and removes it, so no filter changes behaviour before its phase.

**A style guide as the e2e harness.** jsdom does not compute styles from `globals.css`, so primitive
looks are proven in a browser. `/palette` already exists as an internal page; rendering every
primitive and token there gives one stable page to measure (LOOK-9 to LOOK-13) instead of hunting for
each variant across screens that later phases will rebuild.

**Owner decisions on the draft (2026-10-12).** The variable `woff2` files and their OFL licences are
downloaded once from Google Fonts and committed — no new dependency. The skeleton's price bar shade
becomes its own token, `surface-strong` (`#1E1E22`), also used for the hovered option of a select,
rather than borrowing `line-soft`. Placeholders and the empty checkbox border use `text-muted`: the register screen's `#6E6B72`
gives 3.7:1 on `bg`, under the 4.5:1 that placeholder text needs, so it does not become a token.
The English footer reads "Privacy · Terms · Illustrations by
Storyset". `next-themes` leaves `package.json` and the lockfile, and FRONT-27 drops the sentence
about the stored theme. The toast and the select dropdown got their own design in the UI Kit and the
design system (`docs/design/system/components/Toast`, `Select`), derived from the map preview card,
accepted by the owner and published (2026-10-12). The select keeps a single style — checkboxes —
even where one value is the usual choice, so the control never changes shape between fields. The card container needs no new piece: `components/ui/card.tsx` holds the account
blocks and the sign-in forms, which the design already draws as AccountCard and the auth panels, so
the primitive takes that look (`surface`, `line`, `radius-card`). The sign-in panels use the
larger `radius-panel` (28px); they get it with their layout in F4 and F7.

**The design system was aligned with the screens before this phase.** The screens are the source of
truth; where two screens disagreed on a detail, the majority value won and the other screen was
aligned (owner rule, 2026-10-12). That pass added the tokens LOOK-1 now lists (radii, the photo tints,
`handle`, `text-legal`, `map-road-minor`, the Google colours, the avatar ring shadows) and moved
`scrim` to 0.85. The design is viewed in the Claude Design project named in `docs/design/README.md`.

**Visual baselines and docs move with the look.** Changing every screen's palette and type breaks
`e2e/visual.spec.ts`'s login and map baselines on purpose; this PR regenerates both from the new
look (owner-approved, RULES §1), because a baseline of the old look would only prove the old look.
Every doc that describes the theme, the fonts, the palette or the toggle is updated in the same PR:
`DESIGN.md` and `.impeccable/design.json`, `docs/ARCHITECTURE.md` › Frontend (design system,
typography, theming) and its testing and CSP notes, `CLAUDE.md` › UI specifics (the theming bullet
naming `useThemeTransition` and `useMounted`), the specs listed under Contracts
(`cross-cutting.md`, `core-frontend.md`, `map-and-search.md`, `navbar.md`, `core-platform.md`), and
any ADR that still describes next-themes or the light theme gets a superseding note.
