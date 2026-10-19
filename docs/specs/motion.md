# Motion — one timing system, hover and press, and where nothing moves

Key: MOTION
Status: Implemented
Last updated: 2026-10-18

---

## Problem

Motion in BuyCarMap was added one component at a time, so the app moves without a system:

- **No shared timing.** Every Motion preset in `lib/animations.ts` runs at 300ms, the legal article at 500ms, and every CSS transition at Tailwind's default 150ms with its own curve. Nothing ties the two together, and the owner finds the filters dropdown «demasiado lenta».
- **Many controls give no feedback.** No button variant has a hover or a press state, and neither do the toggle chips, the inputs, «Filtros», the search pill segments or the tab bar. Some controls change state instantly (the input's focus border, the map zoom's hover) while their neighbours fade in 150ms.
- **The app moves where it shouldn't.** The results list, the saved list and their hover fade or ease on every search and every pointer move, though they are the surfaces a buyer sees most. Popovers, dialogs, the map preview and sheets also fade when they are opened or closed from the keyboard, so a keyboard user waits for an animation they never asked for.

The core rules adopted on 2026-10-17 (algusaem-claude, «Animation») settle what good looks like:

- every animation has a purpose;
- UI animations stay under 300ms, with a dropdown at about 180ms;
- elements leave the way they entered;
- surfaces used many times a day are never animated, and neither is anything a keyboard action opens, moves or closes.

The owner approved the timing scale, the hover and press proposal, the keyboard rule and the list rule on 2026-10-18, and extended the list rule to the alerts list.

In scope:

- the timing tokens that every CSS transition and every Motion preset read;
- hover and press states on every interactive element;
- the surfaces that stop animating (the results list, the saved list, the alerts list, their hover, the pins);
- instant open and close for anything a keyboard action triggers;
- the core's animation rules copied into `RULES.md`, `STACK.md` and `.claude/commands/check-front.md`.

## Acceptance criteria

Timing

- [x] MOTION-1 · node — `app/globals.css` sets Tailwind's default transition to 120ms with the curve `cubic-bezier(0.23, 1, 0.32, 1)`, so every `transition-*` class in the app runs at that timing unless it names its own. It also defines the named durations `fast` (120ms), `base` (180ms) and `sheet` (240ms) and the named ease `out` with that same curve.
- [x] MOTION-2 · unit — Every Motion preset in `lib/animations.ts` takes its duration and ease from those tokens. Popovers, dropdowns and fades run at 0.18s. Sheets and dialogs that slide run at 0.24s. The legal article's entrance runs at 0.24s, where it ran at 0.5s. No preset runs at 0.3s or longer. Every preset with an exit leaves with the same property and direction it entered with. The drag spring (`sheetSpring`) keeps its physics.
- [x] MOTION-3 · e2e — On `/palette` at 1440 × 900, a button and an input have a computed `transition-duration` of `0.12s` and a `transition-timing-function` of `cubic-bezier(0.23, 1, 0.32, 1)`.

Hover and press

- [x] MOTION-4 · component — Hover and press states, all moving in the 120ms state transition (MOTION-1):
  - Primary buttons brighten slightly on hover.
  - Secondary and outline buttons turn their border to `text-muted` and fill with `surface` on hover.
  - Ghost and icon buttons fill with `surface-strong` on hover.
  - Every button scales to 0.97 while pressed.
  - The undo variant keeps its instant colour change (LOOK-10).
- [x] MOTION-5 · component — Chips and fields:
  - An unpressed toggle chip and an unchecked radio chip turn their border to `text-muted` on hover.
  - Chips scale to 0.97 while pressed.
  - An input, the select trigger, the type-ahead field and the number box turn their border to `text-muted` on hover while they are not focused.
  - All of them move to the `lime` focus border in the 120ms state transition (amends LOOK-13).
- [x] MOTION-6 · component — The remaining interactive elements gain a hover state on pointer devices and a press state, all in the state transition: the map's zoom buttons, the header's icon and text links, the tab bar's tabs, the avatar, the language control, the heart button, «Filtros», the search pill's segments and its search button, and the phone search summary.
- [x] MOTION-7 · e2e — On `/palette` at 1440 × 900, hovering a secondary button turns its border from `rgb(42, 42, 46)` to `rgb(163, 160, 166)` within 200ms. Holding the mouse down on it gives a computed `scale` of 0.97 on both axes (the CSS `scale` property, which Tailwind 4 uses for `scale-*`). Under `prefers-reduced-motion: reduce`, the press leaves `scale` at `none`.

Surfaces that never animate

- [x] MOTION-8 · component — The map's results list never animates:
  - result cards appear and leave with no fade, after a search, on «Cargar más», at every sheet position and in the desktop column;
  - the switch between a results state (loading, empty, error) and the cards is immediate;
  - «Cargando…» under the list and the desktop status pill over the map appear and leave with no fade.
- [x] MOTION-9 · component — The saved list and the alerts list never animate. On the saved list, a removed card leaves and an undone card comes back with no fade (amends SAVED-14, SAVED-15). On `/alerts`, the card that opens, a deleted card and the switch from placeholders to matches happen with no fade (amends ALERTUI-11, ALERTUI-35). The active ring on a card in the map's list, in Guardados and in an alert's matches turns on and off with no transition. So do the hover rows of the saved phone list and a price pin's active state.

Keyboard opens and closes at once

- [x] MOTION-10 · component — The search pill's popovers, the desktop «Filtros» dropdown and the desktop «Crear alerta» popover appear at once when opened with Enter or Space and disappear at once when closed with Escape. Opened or closed with a pointer, they fade and move 4px over 180ms and leave the way they came.
- [x] MOTION-11 · component — The map's car preview opens at once when a pin is activated with Enter or Space, and closes at once with Escape. Opened or closed with a pointer, it fades over 180ms (amends MAPUI-27).
- [x] MOTION-12 · component — Dialogs and phone sheets appear at once when opened from the keyboard. They disappear at once when closed with Escape or with a close control activated by Enter or Space. The surfaces covered: the desktop account dialogs, the delete-alert confirmation, «Crear alerta» on the phone, the «BUSCAR» sheet, the full-screen filters, the saved car sheet and the phone account sheets. Opened or closed with a pointer, a desktop dialog fades over 180ms, and a phone sheet slides over 240ms or fades over 180ms and leaves the way it came (amends SAVED-21, ALERTUI-33, PAGES-38).
- [x] MOTION-13 · component — The place and car type-ahead lists are driven by typing and the arrow keys, so they never animate: their options, groups, «no match» line and clear button appear and disappear at once (amends MAP-20).
- [x] MOTION-14 · component — Enter or Space on the phone results sheet's handle moves the sheet to its next position at once. A pointer press still springs it.
- [x] MOTION-15 · component — The legal pages' «En esta página» index folds at once when a section is chosen with Enter (its entries are links, which Space does not activate), and the page still jumps to that section (PAGES-63). Chosen with a pointer, it folds over 180ms, and then the page jumps.
- [x] MOTION-16 · e2e — On `/map` at 1440 × 900, with the «Filtros» dropdown open:
  - Escape removes it within two animation frames;
  - when it is reopened with a click and closed with a click outside, it is still on screen with an opacity below 1 on the next frame, and gone within 300ms.

Added after review (owner, 2026-10-18)

- [x] MOTION-17 · component — The remaining controls gain hover and press states in the state transition. The danger button turns its border to full `danger` on hover. The map preview's close button and «Ver anuncio», the type-ahead's clear «×», the brand chip's «Quitar» button and the legal pages' «En esta página» toggle gain a hover and a press state.
- [x] MOTION-18 · component — More keyboard surfaces open and close at once. The select dropdown appears at once when opened with Enter, Space or an arrow key, and disappears at once with Escape. The brand chip in «Coche» appears and leaves with no fade, as the rest of the type-ahead does (MOTION-13). In an open grouped preview on Guardados, a car that leaves does so with no fade. (A car cannot come back into an open preview: «Deshacer» is outside it and closes it — owner, 2026-10-18.)
- [x] MOTION-19 · component — More list pieces never animate. An alert card's hover and press change with no transition. Switching between a list and its empty state on Guardados and on `/alerts` happens at once, and so do Guardados' sort chips appearing and leaving.

Added after the second review (owner, 2026-10-18)

- [x] MOTION-20 · unit + e2e — Every phone sheet that closes with a drag (the saved car sheet, the account sheets, «Crear alerta» and «BUSCAR»; the full-screen filters do not drag) measures its release speed from the pointer events with the rule of the MAPUI-60 worked examples, so a fast flick down on an idle page closes the sheet (SAVED-39, PAGES-39, ALERTUI-32).
- [x] MOTION-21 · component — The last controls gain hover and press states in the state transition: the landing's phone search card (like the map's phone summary, MOTION-6), the wordmark link, the «Créala» link on the sign-in page and the password field's show or hide button.
- [x] MOTION-22 · component — Moving the highlight through the select dropdown with the arrow keys changes it at once, with no transition, as the type-ahead options do (MOTION-13).
- [x] MOTION-23 · component — What a key causes appears at once. When the results sheet moves to full or away from it by Enter or Space on its handle, the phone tab bar hides or comes back at once. The «Filtros» count badge and the validation notices appear and leave with no fade when a key caused the change, and keep their fade when a pointer did.

## Worked examples

**Tokens (MOTION-1, MOTION-2).**

| Token | Value | Used by |
| --- | --- | --- |
| state | 120ms, `cubic-bezier(0.23, 1, 0.32, 1)` | every CSS transition: hover, focus, press, pressed chips |
| base | 180ms, same curve | popovers, dropdowns, the map preview, fades, the legal index |
| sheet | 240ms, same curve | phone sheets and desktop dialogs that slide, the legal article's entrance (a phone sheet that fades uses `base`) |

**Hover and press on a secondary button (MOTION-4, MOTION-7).** At rest: border `rgb(42, 42, 46)` (`line`), transparent fill. On hover: border `rgb(163, 160, 166)` (`text-muted`) and fill `rgb(24, 24, 27)` (`surface`). While pressed: `scale` 0.97 on both axes. With reduced motion: `scale: none`.

**Keyboard against pointer, «Filtros» (MOTION-10, MOTION-16).**

| How it opens | How it closes | On screen |
| --- | --- | --- |
| Enter on «Filtros» | Escape | appears and disappears in the same frame |
| click on «Filtros» | click outside | fades in over 180ms; fades out over 180ms, still visible on the next frame |
| click on «Filtros» | Escape | fades in over 180ms; disappears in the same frame |

**Saved list (MOTION-9).** At `/favorites` with cars A, B and C, removing A takes its card off the list in the same frame, and B and C move up. «Deshacer» puts A back in the same frame, with no fade.

## Data model

None. The change adds no table or column and reads no data.

## Permissions

None: the change is presentational. It touches no user data and no authorization.

## Edge cases

- **Reduced motion.** `MotionConfig reducedMotion="user"` (FRONT-29) keeps every Motion animation off. The press scale is also off under `prefers-reduced-motion: reduce` (MOTION-7). Colour, border and outline transitions stay: they move nothing.
- **Touch devices.** Hover styles apply only where the device can hover (Tailwind's `hover:` is wrapped in `@media (hover: hover)`), so a tap never leaves a stuck hover. The press state still shows while a finger is down (MOTION-4, MOTION-5, MOTION-6).
- **A close nobody triggered.** A sheet that closes because a search moved the page on follows the last input the person used: instant after a key, animated after a pointer (MOTION-10, MOTION-12). The map preview whose car left the results goes at once whatever the last input, because it leaves with its pin, and pins never animate (MOTION-9, MOTION-11; owner, 2026-10-18).
- **Mixed input.** Opening with a click and closing with Escape animates the open and not the close (worked example «Filtros», third row).
- **A spring interrupted by a key.** Enter on the handle mid-spring stops the spring and puts the sheet at its next position at once (MOTION-14).
- **The legal index jump.** An instant fold still triggers the jump to the chosen section, which today waits for the fold's exit to finish (MOTION-15, PAGES-63).

## Out of scope

- Toasts: Sonner animates them, and the core exempts them.
- Leaflet's own zoom animation (250ms) and its panning. The map library draws them, and they explain where the map went.
- The loading skeleton's pulse and the spinners. They are feedback that something is still loading.
- The drag physics of the phone sheets and the results sheet. A pointer release still springs (SAVED-37, SAVED-38, ALERTUI-32, PAGES-39, MAPUI-58). The one exception: the results sheet and the phone sheets now measure their release speed from the pointer events, because the animation library reads 0px/s on a fast flick when the page is idle (owner, 2026-10-18; worked examples in `docs/specs/redesign-map.md`, MAPUI-60; MOTION-20).
- New decorative animations, page transitions and a light theme.

## Contracts

Theme tokens in `app/globals.css`, mirrored in `docs/design/system/tokens.json`:

- `--default-transition-duration: 120ms`
- `--default-transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1)`
- `--transition-duration-fast: 120ms`, `--transition-duration-base: 180ms`, `--transition-duration-sheet: 240ms`
- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`

`lib/animations.ts` exports the same three durations in seconds and the curve, and every preset reads them. CLAUDE.md › UI specifics and `docs/ARCHITECTURE.md` list the presets and change with them.

## Decisions and rationale

**One curve, three durations.** A buyer reads timing as one personality only if hover, a dropdown and a sheet share a curve and differ only in length. 120ms is the shortest a colour change still reads as a transition rather than a flicker. 180ms is the core's example for a dropdown. 240ms gives a sheet, which travels a whole screen, time to read as sliding without crossing the core's 300ms limit. The curve is a strong ease-out: it reaches most of the distance early, so the interface feels as fast as an instant change while still showing where things came from. Tailwind's default curve is an ease-in-out, which spends its first frames barely moving.

**Retime Tailwind's default instead of adding a class to every component.** In Tailwind 4, every `transition-*` class reads `--default-transition-duration` and `--default-transition-timing-function`. Overriding those two variables moves all 40-odd existing transitions to the new timing in one place, and a new component gets it for free. Named durations exist for the few elements that need the longer ones.

**Keyboard opens and closes at once, pointer keeps the motion.** A pointer user's eye follows the hand, and a short fade explains where a popover came from. A keyboard user has already decided and is waiting on the next keystroke, so an animation only delays them; on a key held to repeat, it stacks. That is the core's rule, and the owner chose it over animating both. The app knows which input came last from one place: the last key or pointer press on the page, read when something opens or closes.

**The lists stop moving rather than move faster.** The results list changes on every search, every «Cargar más» and every sheet move, and its hover follows the pointer across the grid. At 180ms, a fade there is still shown dozens of times a session and explains nothing the buyer doesn't already know. The core names frequently used lists and their hover as the surfaces where the best animation is none. The owner chose that over keeping shorter fades. The saved list is the same kind of surface, and the owner put the alerts list with it.

**Press scale only where pressing means something.** 0.97 confirms a press without moving the layout: it is a transform, which costs no reflow, and it is small enough not to read as a bounce. It is off under reduced motion because it is a movement, even a small one. It is not applied to cards, whose «press» opens a listing in a new tab and would only flash.

**What this changes in other specs.** When this spec is approved, these criteria are amended inline in the same change, each citing MOTION:

- LOOK-13: the focus border reaches `lime` within 120ms, where before it changed at once.
- The LOOK edge case on reduced motion: the press scale is the one transform, and it is off under reduced motion.
- MAPUI-27: the preview fades only when a pointer opens or closes it.
- MAP-20: the type-ahead options leave at once, so there are no fading options to guard.
- SAVED-14 and SAVED-15: with no fade.
- ALERTUI-11 and ALERTUI-35: with no fade.
- SAVED-21, ALERTUI-33 and PAGES-38: they fade or slide only when a pointer opens or closes them.
- The MAPUI handle criteria: Enter or Space moves at once.

The tests that assert a fade after Escape (MAPUI-2, MAP-20, MAPUI-27) or a saved or alert card's fade (SAVED-14, SAVED-15, ALERTUI-11, ALERTUI-35) are rewritten to the new behaviour. Their pointer twins stay.

**The core's text, copied.** `RULES.md` §17 and §19 «Animation», the motion line in `STACK.md` and §3 of `.claude/commands/check-front.md` take the core's 2026-10-17 wording word for word. The reviews then enforce this spec's rules on every later change.

