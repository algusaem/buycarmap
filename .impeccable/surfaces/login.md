# Surface brief: /login

The sign-in screen of BuyCarMap 2.0. Behaviour is specified in
[`docs/specs/redesign-entry.md`](../../docs/specs/redesign-entry.md) (ENTRY) and
[`docs/specs/auth-email-and-oauth.md`](../../docs/specs/auth-email-and-oauth.md); the visual source of
truth is the design in [`docs/design/`](../../docs/design/README.md) (board `R3-login`, the UI Kit).
Where this brief and the design disagree, the design wins and this brief is corrected.

## 1. Job and audience

- The same buyer persona as `/map` and `/`: a private buyer in Spain, mostly on a phone
  (`PRODUCT.md` › Users).
- Arrives signed out, either to sign in to an existing account or redirected here from a
  signed-out action (a heart, «Crear alerta») with a `callbackUrl` to return to (ENTRY-17).
- Mode: Operate — get past one form, fast, with no dead end — recovery and registration are both
  reachable from here, including on a phone (ENTRY-9).

## 2. Outcome and proof

- Primary task: enter email and password (and, with two-factor on, a code) and reach
  `callbackUrl`, or `/` when it is not a path on this site (ENTRY-17).
- Success: «Entrar» succeeds and the visitor is on their way; a failure stays on the page with an
  inline reason, never a toast (ENTRY-11, ENTRY-12).
- Evidence on screen: the headline «¿Te mola un coche? Guárdalo», the line «Recibir alertas es
  gratis, regístrate y nos encargamos del resto.», the form titled «Entrar» (ENTRY-9).
- No GitHub button, ever, on `/login` or `/register` (ENTRY-16, ENTRY-18).

## 3. Selected direction

- Visual authority: the approved BuyCarMap 2.0 world, "one light in the night" (`DESIGN.md`):
  near-black `bg` and `surface`, lime for the primary action, Unbounded uppercase for the headline,
  Rethink Sans for the rest.
- Structural thesis: desktop pairs the headline with a self-contained form panel, the Storyset
  illustration and its arrow pointing at the form; the phone drops the panel and puts the form
  directly on the page background, with the illustration under the buttons (ENTRY-19).
- Focal moment: «Entrar», the one lime action on the page, with every other control (recovery,
  Google, register) secondary to it.

## 4. Scope and boundaries

- In scope: `/login`'s copy, its states (errors, two-factor, loading, OAuth error), its phone
  layout, the `callbackUrl` fix, and the GitHub button's removal.
- Untouched here: the landing's own surface is [`landing.md`](landing.md); `/register`,
  `/forgot-password`, `/reset-password`, `/verify-email`, `/confirm-email`, `/account` and the
  legal pages (F7) — F4 only restyles the pieces they share with `/login`: the Google button and
  the password field's show/hide button.
- Anti-goals: no GitHub button under any configuration; no toast for a sign-in failure or rate
  limit; no signed-in redirect to `callbackUrl` from `/login` itself (the proxy keeps sending
  signed-in visitors to `/`).

## 5. States and ranges

- Default, wrong credentials (ENTRY-11), rate-limited (ENTRY-12), two-factor step with a wrong app
  code (ENTRY-13), loading (ENTRY-14), and an OAuth error, known or unknown code (ENTRY-15), fields
  keeping what was typed. Credential and rate-limit alerts sit above the «Entrar» button; the OAuth
  alert sits at the top of the form, before the «Entrar» title. Only one alert shows at a time,
  because the OAuth alert clears when an attempt starts.
- Password field: hidden or shown text, toggled by the show/hide button at its right end
  («Mostrar contraseña» / «Ocultar contraseña»), keeping what was typed (ENTRY-10).
- Empty or invalid fields on submit: each error under its own field (circle-alert in `danger`,
  14px weight 600 in `text`), the border unchanged, the eye still centred.
- Google configured or not: «o» and the Google button show only when Google is configured
  (ENTRY-16).
- Desktop vs phone: from 1440 wide the illustration sits beside the form, with the arrow; from
  1024 to 1439 wide the page takes the phone composition in one centred 440px column, with the
  desktop header and footer (ENTRY-25); the phone and that column show no panel, no «o», and the
  Google button with no «G» mark, and the illustration whole under the buttons (ENTRY-19,
  ENTRY-27).

## 6. Interaction and layout

- The two-factor code field gets focus when it appears, with the recovery-code hint under it; six
  digits are checked as an app code, anything else as a recovery code (ENTRY-13).
- While signing in, «Entrar» is disabled, `aria-busy`, and shows a spinner beside its unchanged
  label (ENTRY-14).
- `callbackUrl` is resolved against this site's own origin, not pattern-matched, so a backslash
  path (`/\evil.example`) can no longer reach another site — it goes to `/`, like any other
  off-site target (ENTRY-17, security fix).
- Everything that appears or disappears (the alert, the two-factor field) animates with Motion,
  honouring reduced motion.

## 7. Constraints and open decisions

- WCAG 2.2 AA, full keyboard support and screen reader support; `/login` passes axe at desktop and
  phone width (ENTRY-21).
- All copy through next-intl keys; Spanish is the default locale and the design gives Spanish only.
- Reuse the design system's Google button and password field (restyled once, shared with
  `/register`) and theme tokens from `app/globals.css`; no new colour, token or pattern without
  approval.
- Not for the builder to invent: any copy, value or state the design and the ENTRY spec do not
  give.
