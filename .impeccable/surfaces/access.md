# Surface brief: the access pages

`/register`, `/verify-email`, `/confirm-email`, `/forgot-password` and `/reset-password` of
BuyCarMap 2.0. Behaviour is specified in
[`docs/specs/redesign-pages.md`](../../docs/specs/redesign-pages.md) (PAGES-1 to PAGES-24, PAGES-69,
PAGES-70, PAGES-75, PAGES-76) and [`docs/specs/auth-email-and-oauth.md`](../../docs/specs/auth-email-and-oauth.md);
the visual source of truth is the design in [`docs/design/`](../../docs/design/README.md) (boards
`F0-registro`, `F0-confirmar`, `F0-contrasena`, `F0-nueva-contrasena`, `F7-registro-estados`,
`F7-confirmar-estados`, `F7-contrasena-estados`, the UI Kit). Where this brief and the design
disagree, the design wins and this brief is corrected. `/login` has its own brief, [`login.md`](login.md).

## 1. Job and audience

- The same buyer persona as `/map` and `/login`: a private buyer in Spain, mostly on a phone
  (`PRODUCT.md` › Users).
- Arrives signed out to create an account, from a link in an email (confirm an account or a new
  address, reset a password), or to ask for a reset link.
- Mode: Operate — one short form or one button per page, a clear next step after it, and no dead
  end: every expired link offers the way to a new one (PAGES-16, PAGES-19, PAGES-24).

## 2. Outcome and proof

- `/register`: email, password and its repeat, then the neutral «check your inbox» state, the same
  for a free and a taken address (PAGES-9 to PAGES-12, AUTH-1).
- `/verify-email` and `/confirm-email`: one button redeems the token; then the confirmed state or the
  expired-link state, never a toast (PAGES-13 to PAGES-19).
- `/forgot-password`: an email, then «check your inbox», the same for every address (PAGES-20,
  PAGES-21). `/reset-password`: the new password and its repeat, then `/login` with the toast
  (PAGES-22 to PAGES-24).
- Evidence on screen: each state's headline over its lime punchline («¿Aún sin cuenta? / Hazte
  una», «¿Ya está? / Mira tu correo», «¿Enlace caducado? / Pide otro»…), its line, and its actions.

## 3. Selected direction

- Visual authority: the approved BuyCarMap 2.0 world, "one light in the night" (`DESIGN.md`):
  near-black `bg` and `surface`, lime for the one primary action, Unbounded uppercase for the
  headline, Rethink Sans for the rest.
- Structural thesis: `/login`'s composition (`components/auth/AccessLayout.tsx`): from 1440px the
  headline and its line on the left and the panel on the right; from 1024px to 1439px one centred
  440px column with the desktop header and the footer; under 1024px the form directly on the page
  background, no panel, no panel title, no «o», no footer (PAGES-1, PAGES-7, PAGES-75).
- Focal moment: the state's one lime button; `/register` at 1440px keeps the illustration whole and
  the arrow to the «o».

## 4. Scope and boundaries

- In scope: the five pages' copy, their states, their layout at every width, the strength meter,
  the browser titles (PAGES-69).
- Untouched here: `/login` ([`login.md`](login.md)), what the auth actions check (token lifetimes,
  rate limits, the password policy), the emails.
- Anti-goals: no name field on `/register`; no email address shown on the confirm pages (no token is
  read at render, PAGES-14); no toast for a rejected password or a failure with no field; no grid,
  orbs, pulsing icons or brand block; no «Volver» link of the page's own.

## 5. States and ranges

- Field errors under their field (circle-alert in `danger`, `role="alert"`), the border unchanged,
  the eye centred; a password the server rejects under the password field, before the meter
  (PAGES-3, worked example "Server rejections").
- A failure with no field (`rateLimited`, `generic`) a form alert above the primary button (PAGES-4).
- Busy: disabled, `aria-busy`, the spinner left of the unchanged label (PAGES-2).
- The meter: nothing while empty, «Seguridad: <nivel>», one line per issue, the hint only with no
  issue under «buena» (PAGES-5).
- Google configured or not: «o» and «Continuar con Google» only when it is (PAGES-9).
- A link with no token and a refused token take the same expired-link state.

## 6. Interaction and layout

- A form or a button that gives way to another state cross-fades into it, and the focus moves to the
  new state's headline (PAGES-76); a state the page opens with takes no focus.
- Every control has a 44 × 44px hit area on a phone, the inline links included (PAGES-8).
- Leaving a form with something typed shows no warning
  ([ADR 0022](../../docs/decisions/0022-access-forms-no-unsaved-guard.md)).

## 7. Constraints and open decisions

- WCAG 2.2 AA, keyboard and screen reader support; every page passes axe at 1440×900 and 390×844
  (PAGES-70).
- All copy through next-intl keys; Spanish is the default locale and the design gives Spanish only.
- Reuse `AccessLayout`, `PasswordInput`, `PasswordStrengthMeter`, `OAuthButtons`, `FieldMessage`,
  `BusyButton` and the theme tokens; no new colour, token or pattern without approval.
- Not for the builder to invent: any copy, value or state the design and the PAGES spec do not give.
