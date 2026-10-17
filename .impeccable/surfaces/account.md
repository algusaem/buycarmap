# Surface brief: /account

The account page of BuyCarMap 2.0. Behaviour is specified in
[`docs/specs/redesign-pages.md`](../../docs/specs/redesign-pages.md) (PAGES-25 to PAGES-60,
PAGES-71 to PAGES-73, PAGES-76) and the auth specs it amends (AUTH, BAUTH, EXPORT, DATA); the visual
source of truth is the design in [`docs/design/`](../../docs/design/README.md) (boards `F0-cuenta`,
`F7-cuenta-editar`, `F7-cuenta-dos-pasos`, `F7-cuenta-sesiones-google`,
`F7-cuenta-eliminar-y-mas`, the AccountCard README, the UI Kit). Where this brief and the design
disagree, the design wins and this brief is corrected.

## 1. Job and audience

- A signed-in buyer, on a phone or a desktop, checking what the account holds or changing one thing:
  the name, the email, the password, two-factor, a session, Google, the data export, the account
  itself.
- Mode: Review, then Operate — read the summary at a glance, act on one card at a time.

## 2. Outcome and proof

- The page reads as a summary: each card says what it holds in one line and offers one action
  (Decisions › `/account` stays a summary).
- Each action opens its form in a dialog on desktop and a bottom sheet on the phone; the card
  follows the change without a reload (PAGES-38 to PAGES-55).
- Evidence on screen: «Cuenta», the own card's «<N> guardados · <N> alertas · en BuyCarMap desde
  <mes>» (PAGES-31), the sessions line «Chrome en Windows, esta. Safari en iOS, hace 2 días.»
  (PAGES-35).

## 3. Selected direction

- Visual authority: the approved BuyCarMap 2.0 world (`DESIGN.md`): `surface` cards with a `line`
  border on `bg`, Unbounded capitals for the titles, the violet badge for what is on, lime only for
  a dialog's primary action, `danger` for «Eliminar cuenta».
- Structural thesis: from 1024px three columns 20px apart inside 32px sides, «Eliminar cuenta»
  across two; under it one column 12px apart, «Cerrar sesión» after the last card, and the tab bar
  (PAGES-25, PAGES-26, PAGES-28).
- Focal moment: the own card, its avatar and name.

## 4. Scope and boundaries

- In scope: the cards, every dialog and sheet, the Google-only variant, the loading and error
  states (PAGES-56, PAGES-57), the copy.
- Untouched here: what the actions check (authorization, rate limits, the password policy, TOTP).
- Anti-goals: no form open on the page itself; no Google account email (PAGES-34); no linking
  Google or setting a first password (Out of scope); no «password changed» date; no toast for a
  failure inside a form (PAGES-71).

## 5. States and ranges

- With no password: no «Contraseña» or «Dos pasos» card, «Correo» with no button, six cards
  (PAGES-27, PAGES-28).
- Two-factor off («Desactivada», «Activar») or on («Activada», «Gestionar») (PAGES-33).
- Google linked, the only way in («Desconectar» `aria-disabled`, described by its line), or none
  (PAGES-34).
- Sessions: one or many, «y N más» past two, expired ones left out (PAGES-35, PAGES-60).
- Dialogs: busy while a request runs and impossible to close then (PAGES-72); field errors under
  their field; a failure with no field a form alert above the primary button (PAGES-71); the
  sessions sheet's loading, its load error with «Reintentar» (PAGES-50).
- A long email or name cut to one line with «…».

## 6. Interaction and layout

- Focus starts on the dialog's first field, on «Copiar códigos» in the codes dialog, on «Cerrar» in
  «Sesiones» (PAGES-73), and follows a state swap inside a dialog (PAGES-76); it returns to the
  card's button on close.
- The codes dialog is an `alertdialog` with no «Cancelar»; «Ya los he guardado» unlocks after
  «Copiar códigos» (PAGES-45).
- The phone sheets close with a drag down past 100px and spring back from a slow 40px drag (PAGES-39).
- A dirty dialog closes with no warning
  ([ADR 0022](../../docs/decisions/0022-access-forms-no-unsaved-guard.md)).

## 7. Constraints and open decisions

- WCAG 2.2 AA; axe passes at 1440×900 and 390×844 with the dialogs open (PAGES-58); every control
  has a 44 × 44px hit area on a phone (PAGES-59).
- All copy through next-intl keys; Spanish is the default locale.
- Reuse `AccountCard`, `AccountDialog` (`DialogActions`, `DialogCancel`), `PasswordInput`,
  `PasswordStrengthMeter`, `FieldMessage`, `BusyButton`, `PhoneBottomSheet` and the theme tokens.
- Not for the builder to invent: any copy, value or state the design and the PAGES spec do not give.
