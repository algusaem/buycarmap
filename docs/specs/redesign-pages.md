# Redesign F7 — remaining pages

Key: PAGES
Status: Implemented
Last updated: 2026-10-17

---

## Problem

Registering, confirming an account or a new address, recovering a password, managing the account and
reading the legal pages are the last screens that still wear the pre-redesign look, and none of them
behaves the way the approved design draws it. The design is `docs/design/canvas/F0-registro.dc.html`,
`F0-confirmar.dc.html`, `F0-contrasena.dc.html`, `F0-nueva-contrasena.dc.html`, `F0-cuenta.dc.html`,
`F0-legal.dc.html` and `F0-estado-error-pagina.dc.html`, with the state boards
`F7-registro-estados.dc.html`, `F7-confirmar-estados.dc.html`, `F7-contrasena-estados.dc.html`,
`F7-cuenta-editar.dc.html`, `F7-cuenta-dos-pasos.dc.html`, `F7-cuenta-sesiones-google.dc.html`,
`F7-cuenta-eliminar-y-mas.dc.html`, `F7-legal-estados.dc.html` and `F7-no-existe.dc.html`, and the
AccountCard, PasswordField, LegalToc, EmptyState, Button, BottomSheet and Toast READMEs, accepted by the
owner on 2026-10-16 («aprobado»).

- **A rejected password vanishes.** On `/register` a breached or too-guessable password is a toast
  that disappears after a few seconds, while the form looks untouched.
- **An expired link says nothing on the page.** On `/verify-email`, `/confirm-email` and
  `/reset-password`, a link that is expired or already used is only a toast when its button is
  pressed; the page keeps offering the same button. The «link no longer valid» page exists only for a
  link with no token at all.
- **The account page is one long column of open forms.** Name, email, password, two-factor, linked
  accounts, sessions, export and deletion are all expanded at once. Nothing says what the account
  holds (saved cars, alerts, since when), and the sessions read «Chrome · Windows».
- **The legal pages are a wall of text.** No table of contents, and no section can be linked to.
- **A wrong address shows Next's default page, in English.** There is no not-found page, so an
  unknown address and another user's alert (`/alerts/[id]` calls `notFound()`) show a screen that
  ignores the locale, the header rules and the tab bar.
- **A failure on these pages has no designed state.** `/account` has no loading or error state, and
  no root error boundary exists, so a failure on any access or legal page shows Next's default error.
- **The copy is the old copy.** «Registrarse», «Volver a iniciar sesión», «Política de privacidad»,
  «Creando cuenta...» with three ASCII dots, and a name field the design does not have.

In scope:
- `/register`, `/verify-email`, `/confirm-email`, `/forgot-password` and `/reset-password` at every
  width, with every state the boards draw: forms, inline errors, the strength meter, busy buttons,
  «check your inbox», ready, confirmed and expired-link states;
- `/account` at desktop and phone width: the summary cards, each card's dialog (desktop) or sheet
  (phone), the Google-only variant, its loading and error states, and the counts it shows;
- `/privacy` and `/terms`: the table of contents, section anchors, the current section, the phone
  folded and open index;
- a not-found page, signed in and signed out, and a root error state, signed out;
- the copy of all of the above, in both locales.

## Acceptance criteria

Here, for the access pages (`/register`, `/verify-email`, `/confirm-email`, `/forgot-password`,
`/reset-password`), "phone width" is under 1024px, "laptop width" is 1024px to 1439px and "desktop
width" is 1440px and up, the breakpoints `/login` uses (ENTRY-19, ENTRY-25). For `/account`, the
legal pages and the not-found page, "desktop width" is 1024px and up and "phone width" under 1024px,
the boundary `useIsPhone` uses (`lib/hooks/useIsPhone.ts`). "The headline" is the question over the
lime punchline (`Headline`, the page's `h1`). "The panel" is the access form panel of `/login`
(`radius-panel`, at desktop width only). "Busy" means `aria-disabled="true"` and `aria-busy="true"`, a press
ignored while it runs, a spinner to the left of the label, and the label unchanged; the button is not
natively disabled, so a focused one keeps the focus through its request and after a refusal (amended
2026-10-16: decided by the owner after the build's third review; it read "disabled"). "A field error" is ENTRY-22's pattern: under its field,
with the circle-alert icon, `role="alert"`, tied by `aria-describedby` and `aria-invalid`, the border
unchanged, the eye still centred on its field, and what was typed kept. "A form alert" is ENTRY-12's
pattern: inside the form, above its primary button, as an alert.

The access pages, shared

- [x] PAGES-1 · component — At desktop width each access page shows the access header (HEAD-6), then
  the headline and its line on the left and the panel on the right, holding the state's title, its
  form or actions, and its links; the footer below. At phone width it shows the headline, its line
  when the board draws one, and the form or actions directly on the page background, with no panel,
  no panel title, no «o», Google without its mark, and no footer. It shows no grid, no gradient orbs,
  no pulsing icons, no «BuyCarMap» brand block and no «Volver» link of its own.
- [x] PAGES-2 · component — Every pending action on these pages is busy while it runs: «Crear
  cuenta», «Reenviar el correo», «Confirmar mi cuenta», «Confirmar esta dirección», «Enviar enlace»
  and «Guardar contraseña». A second press starts no second request.
- [x] PAGES-3 · component — An empty or invalid field shows a field error on submit, and the request
  is not sent. A password the server rejects (`passwordBreached`, `passwordWeak`, or on
  `/reset-password` `passwordReused`) is a field error under the password field, placed before the
  strength meter, with no toast (worked example "Server rejections"; decided 2026-10-16, owner).
- [x] PAGES-4 · component — A failure that belongs to no field (`rateLimited`, `generic`) on a form of
  these pages is a form alert with its `authErrors.*` copy, above the primary button, and no toast
  (decided 2026-10-16, owner; the account dialogs: PAGES-71).
- [x] PAGES-5 · component — The strength meter, under «Contraseña» on `/register` and «Nueva
  contraseña» on `/reset-password` and in «Cambiar contraseña» (PAGES-42):
  - shows nothing while the field is empty;
  - reads «Seguridad: <nivel>», the level in lower case: «muy débil», «débil», «aceptable», «buena»,
    «muy buena» for scores 0 to 4;
  - lists under it what fails, one line per issue (`passwordStrength.issues.*`);
  - shows the hint «Tres o cuatro palabras sin relación entre sí forman una contraseña segura y fácil
    de recordar.» only when nothing fails and the score is under 3 («buena»);
  - never disables submit: it is a hint, and the server's policy decides (AUTH-3, kept).
- [x] PAGES-6 · component — Every password field on these pages has the show/hide button of ENTRY-10.
- [x] PAGES-7 · e2e — `/register` follows the layout table under Worked examples: at 1440×900 two
  columns, the illustration `by-my-car-lime.svg` whole in the left block at most 620px wide, the arrow
  from the headline to the «o», and the left block centred as one group on the panel, as ENTRY-28
  states for `/login`; at 1024×900 one centred column 440px wide (±1px) with the desktop header and
  the footer, no panel, no arrow and no illustration; at 390×844 the phone composition of PAGES-1 with
  no illustration. The illustration is never cropped (ENTRY-26's conditions, at 1440×900).
- [x] PAGES-8 · e2e — At 390×844 every control of the access pages has a hit area of at least
  44 × 44px: the fields' eye buttons, every button, «Entra», «Volver a entrar», «Entrar» and the
  legal notice's links.
- [x] PAGES-75 · e2e — At 1024×900 `/verify-email` and `/reset-password` with a token, `/confirm-email`
  with a token and `/forgot-password` take the composition of `/register` at 1024×900 (PAGES-7): one
  centred column 440px wide (±1px) with the headline, its line, the form or actions and the links,
  under the desktop header and over the footer, with no panel and no illustration. The same holds
  from 1024px to 1439px (decided 2026-10-16, owner).

`/register`

- [x] PAGES-9 · component — `/register` shows the headline «¿Aún sin cuenta?» over «Hazte una», the
  line «Recibir alertas es gratis, regístrate y nos encargamos del resto.» at desktop and laptop
  width, and a form titled «Crear cuenta» (desktop) with, in order:
  - «Email», placeholder «tu@email.com»;
  - «Contraseña», with the eye and the meter (PAGES-5);
  - «Repite la contraseña», placeholder «Otra vez, por si acaso», with the eye;
  - «Crear cuenta», the primary button;
  - «o» and «Continuar con Google» when Google is configured (ENTRY-16, kept);
  - «Al crear tu cuenta aceptas los Términos y la Privacidad.», «Términos» linking to `/terms` and
    «Privacidad» to `/privacy`, at every width, phone included (decided 2026-10-16, owner);
  - «¿Ya tienes cuenta? Entra», «Entra» linking to `/login`.

  It has no name field (decided 2026-10-16, owner).
- [x] PAGES-10 · component — Submitting sends `register` the email, the password and the repeated
  password, and no name. The meter scores the password against the email alone.
- [x] PAGES-11 · component — When `register` answers `pending`, the form gives way to the «check your
  inbox» state: the headline «¿Ya está?» over «Mira tu correo», the line «Si ese correo puede usarse
  para una cuenta nueva, te llega un enlace para confirmarla. Caduca en 24 horas. Mira también en
  spam.», and (in the panel at desktop width, titled «Revisa tu correo») «Reenviar el correo», a
  secondary button, and «Entrar», the primary, linking to `/login`. The state is identical for a free
  and a taken address, and names neither (AUTH-1, kept). At desktop width the illustration stays and
  the arrow goes.
- [x] PAGES-12 · component — «Reenviar el correo» calls `resendConfirmation` once with the address
  submitted, is busy while it runs, and then shows the toast «Enviado. Revisa tu bandeja dentro de un
  minuto», the same whatever the address (AUTH-1). A refusal (`rateLimited`, `generic`) is the error
  toast with its `authErrors.*` copy (FRONT-15: an action with no form).

`/verify-email` (confirming a registration)

- [x] PAGES-13 · component — With a token, `/verify-email` shows the headline «¿Eres tú?» over
  «Confírmalo», the line «Un último paso: confirma que este correo es tuyo y tu cuenta queda lista.»,
  and (in the panel at desktop width, titled «Confirma tu cuenta», with «Pulsa el botón para terminar
  de crear tu cuenta.») «Confirmar mi cuenta». It shows no email address (decided 2026-10-16, owner).
- [x] PAGES-14 · component — Rendering `/verify-email`, `/confirm-email` and `/reset-password` with a
  token reads only whether the token is present: no server action, query or token lookup runs until
  the button is pressed, so a mail scanner fetching the link redeems nothing and no render answers
  whether a token is real (kept from `app/verify-email/page.tsx` and `app/reset-password/page.tsx`).
- [x] PAGES-15 · component — When `verifyRegistration` succeeds, the page shows the headline «¿Listo?»
  over «A buscar coche», the line «Tu cuenta ya está creada. Entra y guarda el primero que te mole.»,
  and (in the panel at desktop width, titled «Todo listo») «Entrar», the primary, linking to `/login`.
  No toast shows: the page says it (decided 2026-10-16, owner; «Cuenta creada. Ya puedes iniciar
  sesión.» is no longer shown).
- [x] PAGES-16 · component — With no token, or when `verifyRegistration` answers `tokenInvalid`, the
  page shows the headline «¿Enlace caducado?» over «Regístrate otra vez», the line «Los enlaces de
  confirmación duran 24 horas y solo valen una vez. Vuelve a registrarte y te mandamos otro.», and
  (in the panel at desktop width, titled «Este enlace ya no es válido») «Volver al registro», the
  primary, linking to `/register`, and «Entrar», a link to `/login`. After `tokenInvalid` the form gives
  way to this state with no toast (decided 2026-10-16, owner).

`/confirm-email` (confirming a new address)

- [x] PAGES-17 · component — With a token, `/confirm-email` shows the headline «¿Es tu correo nuevo?»
  over «Confírmalo», the line «Un último paso: confirma que este correo es tuyo y el cambio queda
  hecho.», and (in the panel at desktop width, titled «Confirma tu correo», with «Confirma esta
  dirección para completar el cambio.») «Confirmar esta dirección». It shows no email address.
- [x] PAGES-18 · component — When `confirmEmail` succeeds, the page shows the headline «¿Hecho?» over
  «Correo cambiado», the line «Tu dirección de correo está verificada y actualizada.», and (in the
  panel at desktop width, titled «Correo confirmado») «Volver a tu cuenta», linking to `/account`.
- [x] PAGES-19 · component — With no token, or when `confirmEmail` answers `tokenInvalid`, the page
  shows the headline «¿Enlace caducado?» over «Pide otro», the line «Los enlaces duran 24 horas y solo
  valen una vez. Pide otro desde tu cuenta.», and (in the panel at desktop width, titled «Este enlace
  ya no es válido») «Volver a tu cuenta», linking to `/account`. After `tokenInvalid` the form gives
  way to this state with no toast (decided 2026-10-16, owner).

`/forgot-password` and `/reset-password`

- [x] PAGES-20 · component — `/forgot-password` shows the headline «¿Se te ha olvidado?» over «Nos pasa
  a todos», the line «Pon tu correo y te mandamos un enlace para elegir otra contraseña.» at desktop
  width, and a form titled «Recuperar contraseña» (desktop) with «Email», «Enviar enlace» and «Volver
  a entrar», a link to `/login`.
- [x] PAGES-21 · component — When `requestPasswordReset` succeeds, the form gives way to the headline
  «¿Ya está?» over «Mira tu correo», the line «Si hay una cuenta con ese correo, te llega un enlace en
  unos minutos. Mira también en spam.», and (in the panel at desktop width, titled «Revisa tu correo»)
  «Volver a entrar». It is the same for an unknown address, an OAuth-only account and a password
  account (kept: the action answers the same for all three).
- [x] PAGES-22 · component — With a token, `/reset-password` shows the headline «¿Contraseña nueva?»
  over «Que no se repita», the line «Una que no uses en ningún otro sitio. El medidor te dice si
  aguanta.» at desktop width, and a form titled «Nueva contraseña» (desktop) with «Nueva contraseña»
  and the meter, «Repite la contraseña», «Guardar contraseña» and «Volver a entrar».
- [x] PAGES-23 · component — When `resetPassword` succeeds, the user is sent to `/login` with the toast
  «Contraseña actualizada. Ya puedes iniciar sesión.», signed in nowhere (kept: the reset ends every
  session and keeps two-factor, AUTH-11).
- [x] PAGES-24 · component — With no token, or when `resetPassword` answers `tokenInvalid`, the page
  shows the headline «¿Enlace caducado?» over «Pide otro», the line «Los enlaces duran una hora y solo
  valen una vez. Pide uno nuevo y listo.», and (in the panel at desktop width, titled «Este enlace ya
  no es válido») «Pedir otro enlace», the primary, linking to `/forgot-password`, and «Volver a
  entrar». After `tokenInvalid` the form gives way to this state with no toast (decided 2026-10-16,
  owner).

`/account`, the page

- [x] PAGES-25 · component — At desktop width `/account` shows the pages header with the avatar
  current (HEAD-4), the heading «Cuenta» (`h1`, drawn in capitals), the line «Tus datos, tus reglas.
  Cambia lo que quieras cuando quieras.», «Cerrar sesión» on the heading's row (HEAD-13, kept), and
  the cards in this order: the user's own card, «Correo», «Contraseña», «Dos pasos», «Google»,
  «Sesiones», «Tus datos», «Eliminar cuenta». It shows no «Volver al mapa» link of its own.
- [x] PAGES-26 · component — At phone width `/account` shows the phone header, the heading «Cuenta»,
  the line «Tus datos, tus reglas.», the same cards in one column, «Cerrar sesión» after the last card
  (HEAD-18, kept), and the tab bar with «Cuenta» current (MAPUI-52).
- [x] PAGES-27 · component — For an account with no password (OAuth only), there is no «Contraseña»
  card and no «Dos pasos» card, and the «Correo» card has no button (PAGES-30).
- [x] PAGES-28 · e2e — The grid follows the layout table under Worked examples: at 1440×900 and
  1024×900, three columns with 20px between them inside 32px side padding, the cards of one row equally
  tall, and «Eliminar cuenta» across two columns; with no password, six cards, «Eliminar cuenta» in
  the one column left so the grid closes in two rows; at 390×844 one column with 12px between cards
  (database run; corrected 2026-10-16, confirmed by the owner: six cards, not five — own, «Correo»,
  «Google», «Sesiones», «Tus datos», «Eliminar cuenta», the eight cards minus «Contraseña» and «Dos
  pasos», matching F7-cuenta-eliminar-y-mas frame 04).

The cards

- [x] PAGES-29 · component — The user's own card shows the avatar with the initial of HEAD-9, the name
  as its heading, the email, the summary line of PAGES-31, and «Cambiar nombre». With no name, the
  email is the card's heading (decided 2026-10-16, owner), as the avatar takes the email's initial.
- [x] PAGES-30 · component — The «Correo» card shows the badge «Verificado» when the address is
  confirmed and «Sin verificar» when it is not, and the line «<email>. Con él entras y te llegan las
  alertas.». Confirmed, its button is «Cambiar correo». Unconfirmed, its button is «Enviar correo de
  verificación» and «Cambiar correo» follows it as a text button. With no password, the line is
  «<email>. Tu dirección de correo no se puede cambiar.» and the card has no button.
- [x] PAGES-31 · unit — The summary line reads «<N> guardados · <N> alertas · en BuyCarMap desde
  <mes>»: the user's saved cars and alerts, soft-deleted ones left out, and the month of
  `User.createdAt` in the page's locale and next-intl's time zone. Each count takes the plural form for
  0 and for 2 and up and the singular for 1 («0 guardados», «1 guardado», «8 guardados»; «0 alertas»,
  «1 alerta», «3 alertas»), and the year follows the month only when `createdAt` is not in the current
  year, both read in that time zone («desde marzo de 2025») (decided 2026-10-16, owner). It gives
  exactly the worked example "Summary line".
- [x] PAGES-32 · component — The «Contraseña» card shows the line «La que usas para entrar con tu
  correo.» and «Cambiar contraseña», and no date (decided 2026-10-16, owner).
- [x] PAGES-33 · component — The «Dos pasos» card shows the line «Un código del móvil además de la
  contraseña, con Google Authenticator o similar.», and with two-factor off the outlined badge
  «Desactivada» and «Activar»; with it on, the violet badge «Activada» and «Gestionar».
- [x] PAGES-34 · component — The «Google» card, with Google linked, shows the badge «Conectada», the
  line «También puedes entrar con Google.» and «Desconectar». It never shows the Google account's email
  (decided 2026-10-16, owner). With nothing linked it shows no badge, the line «No hay cuentas
  conectadas.» and no button. When Google is the only way to sign in, «Desconectar» is
  `aria-disabled` and the line is «Es tu única forma de iniciar sesión.», with no instruction to set a
  password, which no screen offers (AUTH-14, BAUTH-10, kept; the copy decided 2026-10-16, owner). It
  lists Google only: never the `credential` row, never GitHub (ENTRY-16, kept).
- [x] PAGES-35 · component — The «Sesiones» card shows the outlined badge «<N> abiertas» («1 abierta»
  with one), a line naming the sessions, and «Cerrar las demás», which shows with any number of
  sessions, one included. The line names the two most recently used sessions, newest first, each as
  its device (PAGES-52) and when it was last used, this device's as «<device>, esta.»; past two it
  adds «y N más» for the rest. It gives exactly the worked example "Sessions line" (decided 2026-10-16,
  owner). The count and the line leave out an expired session (amended 2026-10-16: decided by the
  owner after the build's first review, PAGES-60).
- [x] PAGES-36 · component — The «Tus datos» card shows the line «Tu perfil, tus sesiones, tus coches
  guardados y tus alertas, en un archivo JSON.» and «Descargar mis datos», which behaves as EXPORT-14
  to EXPORT-17 say (kept).
- [x] PAGES-37 · component — The «Eliminar cuenta» card shows its title and «Eliminar mi cuenta» in
  danger, and the line «Borra tu cuenta, tus guardados y tus alertas para siempre. No hay vuelta
  atrás.».

The dialogs and sheets

- [x] PAGES-38 · component — At desktop width each card's button opens its form in a centred dialog
  over the dimmed page, named by its title; at phone width, in a phone bottom sheet (SAVED-41's
  definition: the handle, the centred title, no «×»). It fades in and out with Motion. «Cancelar» (or
  «Cerrar»), Escape and a press outside close it with nothing sent, and focus returns to the button
  that opened it (decided 2026-10-16, owner: a dialog on desktop and a sheet on the phone). The codes
  dialog (PAGES-45) and a dialog whose request is running (PAGES-72) are the exceptions.
- [x] PAGES-39 · e2e — At 390×844 the account sheets close with a drag down from the handle of more
  than 100px and spring back from a slow 40px drag, as SAVED-37 and SAVED-38 say (database run).
- [x] PAGES-40 · component — «Cambiar nombre» opens «Cambiar nombre» with «Nombre», holding the current
  name, «Guardar cambios» and «Cancelar». Saving calls `updateProfile` with the name and the version
  the page rendered, once, busy while it runs; on success the dialog closes, the toast «Perfil
  actualizado» shows, and the card's heading and the header's avatar show the new name. A `conflict`
  is a form alert in the dialog with `authErrors.conflict` (DATA-16, kept; amended here: it was a
  toast). «Guardar cambios» is enabled from the moment the dialog opens (`RULES.md` §19); saving a name
  equal to the current one closes the dialog with no request and no toast (decided 2026-10-16, owner).
- [x] PAGES-41 · component — «Cambiar correo» opens «Cambiar correo» with the line «Enviaremos un enlace
  a la nueva dirección. Tu correo solo cambiará cuando lo confirmes allí.», «Nueva dirección de
  correo», «Contraseña actual» with the eye, «Cambiar correo» and «Cancelar». `currentPasswordIncorrect`
  is a field error under «Contraseña actual», «Tu contraseña actual no es correcta»; `sameEmail` under
  the address, «Esa ya es tu dirección de correo». On success the form gives way to «Si esa dirección
  está disponible, le hemos enviado un enlace de confirmación. El cambio se aplica cuando lo pulses
  allí.» and «Cerrar», the same whether the address is free or taken, and the card's email does not
  change (AUTH-13, kept).
- [x] PAGES-42 · component — «Cambiar contraseña» opens «Cambiar contraseña» with «Contraseña actual»,
  «Nueva contraseña» with the meter, «Repite la contraseña», all three with the eye, the note «Al
  cambiar la contraseña se cerrará la sesión en el resto de dispositivos. En este seguirás
  conectado.», «Guardar contraseña» and «Cancelar». `currentPasswordIncorrect` is a field error under
  «Contraseña actual»; `passwordBreached`, `passwordWeak` and `passwordReused` under «Nueva contraseña»,
  before the meter. On success the dialog closes and the toast «Contraseña actualizada» shows; this
  session stays signed in and every other ends (AUTH-5, BAUTH-2, kept). Every current-password field
  of the account dialogs holds the placeholder «Tu contraseña» (`/login`'s), and a new-password field
  none (amended 2026-10-16: decided by the owner after the build's first review). After the change the
  page does not sign in again: the server kept this session, and the page only tells `authClient`'s
  session store to read it again, outside the action's answer, so a failed refresh never turns a
  change that succeeded into a refusal (amended 2026-10-16: decided by the owner after the build's
  second review).
- [x] PAGES-43 · component — «Enviar correo de verificación» calls `requestEmailVerification` once, busy
  while it runs, then shows the toast «Correo de verificación enviado. Revisa tu bandeja»; a refusal
  (`alreadyVerified`, `rateLimited`) is the error toast with its copy.
- [x] PAGES-71 · component — In every account dialog and sheet that holds a form, a failure that
  belongs to no field (`rateLimited`, `generic`) is a form alert with its `authErrors.*` copy, above
  the dialog's primary button, and no toast: PAGES-4's rule (decided 2026-10-16, owner).
- [x] PAGES-72 · component — While a dialog's or sheet's request runs, Escape, a press outside, a drag
  down from the handle and «Cancelar» do nothing, as F6 decided for its confirmation
  (`redesign-alerts.md`, Decisions); once the request ends, PAGES-38 holds again (decided 2026-10-16,
  owner).
- [x] PAGES-73 · component — When a dialog or sheet opens, focus starts on its first field in a form
  dialog, «¿Eliminar tu cuenta?» included (its button stays `aria-disabled` until the fields are
  filled, PAGES-54); on «Copiar códigos» in the codes dialog; and on «Cerrar» in «Sesiones» (decided
  2026-10-16, owner).
- [x] PAGES-76 · component — When a form or a button gives way to another state, the focus moves to
  the new state: on the access pages to its headline (the `h1`, focusable from script only) —
  `/register` to «check your inbox», `/verify-email` and `/confirm-email` to the confirmed or the
  expired-link state, `/forgot-password` to «check your inbox», `/reset-password` to the expired-link
  state; inside a dialog to its first control — «Cambiar correo» sent to «Cerrar», «Dos pasos» past
  the password to the key, the codes to «Copiar códigos». A state the page opens with (a link with no
  token) takes no focus (decided 2026-10-16, session). On a card whose button goes away once pressed,
  the focus moves to the card's heading (focusable from script only): «Desconectar», once Google is
  disconnected, to the Google card's «Google» (amended 2026-10-16: decided by the owner after the
  build's second review).

Two-factor

- [x] PAGES-44 · component — «Activar» opens «Dos pasos» with the card's line, «Tu contraseña» with the
  eye, «Configurar dos pasos» and «Cancelar». With the password accepted, the same dialog shows «Escanea
  esto con tu app de autenticación», «Vale Google Authenticator, 1Password, Authy o cualquier otra app
  TOTP.», the QR code, «¿No puedes escanear? Introduce esta clave a mano» with the key in a read-only
  field that can be selected whole, «Escríbela tal cual, sin espacios.», «Introduce el código de 6
  dígitos», «Activar dos pasos» and «Cancelar». A wrong code is a field error under the code field,
  «Ese código no es válido. Revisa tu app e inténtalo de nuevo.». A wrong password
  (`currentPasswordIncorrect`) is a field error under «Tu contraseña», «Tu contraseña actual no es
  correcta», with no toast (decided 2026-10-16, owner).
- [x] PAGES-45 · component — After «Activar dos pasos» succeeds, and after «Generar códigos nuevos», the
  recovery codes show once, in a dialog (`role="alertdialog"`; a sheet at phone width) titled «Guarda
  tus códigos de recuperación», with «Cada código sirve una vez y te deja entrar si pierdes el móvil.»,
  the warning «Es la única vez que se muestran. Guárdalos en un sitio seguro antes de continuar.», the
  ten codes in two columns, «Copiar códigos» and «Ya los he guardado». It has no «Cancelar». «Ya los he
  guardado» is `aria-disabled` until «Copiar códigos» has been pressed, and enabled after the first
  press whether the copy succeeded or failed (the codes stay on screen to copy by hand). It is the only
  way out: Escape and a press outside do not close it (decided 2026-10-16, owner; BAUTH-11, kept:
  minted at setup and shown once).
- [x] PAGES-46 · component — «Copiar códigos» writes the ten codes to the clipboard, one per line, and
  shows the toast «Copiado al portapapeles», or the error toast «No se ha podido copiar
  automáticamente. Selecciona los códigos de arriba y cópialos a mano.» when the browser refuses.
- [x] PAGES-47 · component — Closing the codes after enabling shows the toast «Verificación en dos
  pasos activada», and the card shows «Activada» and «Gestionar».
- [x] PAGES-48 · component — «Gestionar» opens «Dos pasos» with «Tu contraseña» and the eye, «Generar
  códigos nuevos» with «Sustituye a los actuales. Los anteriores dejan de funcionar de inmediato.», a
  divider, «Introduce el código de 6 dígitos» with «Requiere tu contraseña y un código actual, para que
  una sesión robada no baste para quitarla.», «Desactivar dos pasos» (danger, full width) and
  «Cancelar». «Generar códigos nuevos» needs the password and «Desactivar dos pasos» the password and a
  code; each is busy while it runs. A wrong password is PAGES-44's field error under «Tu contraseña».
  A disable that succeeds closes the dialog, shows the toast
  «Verificación en dos pasos desactivada», and the card shows «Desactivada» and «Activar».

Sessions and Google

- [x] PAGES-49 · component — «Cerrar las demás» opens «Sesiones» with the list, read again with
  `listMySessions` each time it opens (decided 2026-10-16, owner): each
  session as «<navegador> en <sistema>»; this device with the violet badge «Este dispositivo», no time
  and no button; every other with when it was last used («hace 2 días») and «Cerrar sesión», named with
  its device: «Cerrar la sesión de <device>» (kept; the name amended 2026-10-16: decided by the owner
  after the build's first review). Under the list, «Cerrar las demás»; after a divider, «Esto cerrará
  la sesión en todos los dispositivos, incluido este. Tendrás que volver a iniciar sesión.» and
  «Cerrar sesión en todas partes», a secondary button; and «Cerrar» (corrected 2026-10-16, confirmed
  by the owner: this device's row reads «Este dispositivo» with no time, not "and when it was last
  used" for every row, matching F7-cuenta-sesiones-google). An expired session is not listed
  (amended 2026-10-16: decided by the owner after the build's first review).
- [x] PAGES-50 · component — While the list loads, the sheet shows placeholder rows shaped like the
  list and the buttons under it, in a polite status reading «Cargando…» to assistive tech; when the
  read fails, «No se han podido cargar tus sesiones.» with the circle-alert icon, as an alert,
  «Reintentar», which runs the read again, and «Cerrar». A failed read is never a toast (FRONT-15,
  kept; the status and the alert amended 2026-10-16: decided in session after the build's first
  review). While the read runs again the alert stays and «Reintentar» is busy, until the list or the
  alert answers (amended 2026-10-16: decided after the build's third review).
- [x] PAGES-51 · component — A row's «Cerrar sesión» is busy while it runs and its row leaves the list
  when it succeeds; «Cerrar las demás» leaves this device alone and shows the toast «Se ha cerrado la
  sesión en todos los demás dispositivos»; «Cerrar sesión en todas partes» ends every session and
  sends the user to `/` (BAUTH-4, kept). A refusal is the error toast with its copy.
- [x] PAGES-52 · unit — A session's device reads «<navegador> en <sistema>» when both are known, the one
  known alone otherwise, and «Dispositivo desconocido» when neither is. It gives exactly the worked
  example "Device".
- [x] PAGES-53 · component — «Desconectar» calls `unlinkAccount` once, busy while it runs. On success the
  toast «Cuenta desconectada» shows and the card shows «No hay cuentas conectadas.». A refusal
  (`generic`) is the error toast with its copy; a refusal (`lastSignInMethod`) is the error toast «No
  puedes desconectarla: es tu única forma de iniciar sesión.», dropping the instruction to set a
  password (decided 2026-10-16, owner).

Deleting the account

- [x] PAGES-54 · component — «Eliminar mi cuenta» opens a confirmation (`role="alertdialog"`; a sheet at
  phone width) titled «¿Eliminar tu cuenta?», with the warning line «Borra tu cuenta, tus guardados y
  tus alertas para siempre. No hay vuelta atrás.» and the circle-alert icon, «Tu contraseña» with the
  eye (password accounts only), «Escribe ELIMINAR para confirmar» with «Escribe ELIMINAR en mayúsculas
  para activar el botón.», «Eliminar mi cuenta» (danger, full width) and «Cancelar». «Eliminar mi
  cuenta» is `aria-disabled` until «ELIMINAR» is typed and, on a password account, a password is
  entered (kept).
- [x] PAGES-55 · component — «Eliminar mi cuenta» calls `deleteAccount` once, busy while it runs. On
  success the session is signed out, the user is sent to `/` and the toast «Tu cuenta ha sido
  eliminada» shows. `currentPasswordIncorrect` is a field error under «Tu contraseña», «Tu contraseña
  actual no es correcta», with no toast (decided 2026-10-16, owner).

`/account`'s states

- [x] PAGES-56 · component — `/account`'s `loading.tsx` shows the heading «Cuenta», the line and «Cerrar
  sesión», then eight placeholders shaped like AccountCard: the first with the avatar's circle, the
  others with a title, a badge, two lines and a button, the last across two columns at desktop width,
  in one column at phone width. The placeholders are one region with `aria-busy="true"`, each
  `aria-hidden`, and the region holds a visually hidden «Cargando…» in a polite status.
- [x] PAGES-57 · component — `/account`'s `error.tsx` is the page-error state (`PageError`): «¿Se ha
  roto algo?» over «No es culpa tuya» as the page's `h1`, «Esta página no ha cargado. Vuelve a
  intentarlo y, si sigue, vuelve al mapa.», «Reintentar», which refreshes the route's server data and
  resets the boundary (PLAT-14), and «Volver al mapa», a link to `/map`; at desktop width the empty
  map beside it. It shows no «Cuenta» heading and no card, and not the thrown error.
- [x] PAGES-58 · e2e — `/account` passes axe with no serious or critical violation at 1440×900 and at
  390×844: populated, Google-only, and with the «Cambiar correo» dialog, the codes dialog and the
  deletion confirmation open (database run; amends FRONT-19).
- [x] PAGES-59 · e2e — At 390×844 every control of `/account` has a hit area of at least 44 × 44px:
  each card's button, «Cambiar correo» as a text button, «Cerrar sesión», and every control in the
  sheets, «Cancelar» and «Cerrar» included (database run).

`/account`'s data

- [x] PAGES-60 · node — The `/account` page query returns, for the signed-in user only, the name, the
  email, whether it is confirmed, whether two-factor is on, the version, `createdAt`, whether the
  account has a password (never the hash), the linked providers other than `credential`, and the
  counts of the user's saved cars and alerts, soft-deleted ones left out, and the user's sessions with
  only their id, user agent and last use (never the token), newest-used first (decided 2026-10-16,
  owner), an expired session left out (amended 2026-10-16: decided by the owner after the build's
  first review). Ada's page reads Ada's 8, 3 and 2 sessions while Grace holds her own (worked example
  "Account query"). Signed out it redirects to `/login?callbackUrl=/account` and reads nothing (kept).

`/privacy` and `/terms`

- [x] PAGES-61 · component — `/privacy` shows the heading «Privacidad» and `/terms` «Términos» (`h1`),
  then «Última actualización: <fecha>», then the intro paragraph (`legal.*.intro`), then each section
  of `legal.privacy` or `legal.terms` as an `h2` with its own `id` (PAGES-74) and its paragraph. The
  intro and the sections' text are the message files', and FRONT-27 still holds for them. The page
  shows no «Volver al inicio» link. The footer follows the text, not fixed to the bottom (the intro
  decided 2026-10-16, owner).
- [x] PAGES-62 · component — At desktop width the page has the index «En esta página», a navigation
  region with one link per section in the page's order, each to `#<id>` of its heading. The section on
  screen is marked with `aria-current="location"`, and only that one.
- [x] PAGES-63 · component — At phone width the index is a button «En esta página» after the date, with
  `aria-expanded="false"`. Pressing it opens the list inside the same field (`aria-expanded="true"`),
  with the section being read marked as on desktop. Pressing a section scrolls to its heading and
  folds the index.
- [x] PAGES-64 · e2e — At 1440×900 the index is 260px wide, 72px left of a reading column at most 720px
  wide; at 1024×900 the reading column is 596px. Scrolling the text keeps the index in place and moves
  the current mark to the section on screen. Opening `/privacy#<the Cookies id>` shows «Cookies» with
  its heading wholly below the header, marked current.
- [x] PAGES-74 · unit — Every section of `legal.privacy` and of `legal.terms` has an `id` of its own in
  the message files, unique within its page and the same in `messages/es.json` and `messages/en.json`,
  never derived from the heading; the section's `h2` and its index link use that `id` (decided
  2026-10-16, owner).

Not found and the root error

- [x] PAGES-65 · component — An address that leads to no page, and every `notFound()`, show the
  not-found page: «¿Te has perdido?» over «Esto no existe» as the page's `h1`, the line «Esta dirección
  no lleva a ninguna página. Vuelve al mapa y sigue buscando.», and «Volver al mapa», the one action,
  primary, a link to `/map`. At desktop width the empty map sits beside it.
- [x] PAGES-66 · component — Signed out, the not-found page shows the access header («Volver al mapa»
  at desktop width, «Mapa» at phone width) and no tab bar. Signed in, it shows the pages header with no
  section current and the avatar not marked, and at phone width the tab bar with no tab current
  (amends HEAD-6 to HEAD-8). The exception is `/alerts/[id]`'s 404, signed in: its path is Alertas',
  so «Alertas» stays current in the header and, at phone width, in the tab bar, the section the user
  was in (decided 2026-10-16, owner).
- [x] PAGES-67 · e2e — `GET /esto-no-existe` answers 404 and shows the not-found page in the request's
  locale, signed out; and signed in, with the pages header (the signed-in half: database run).
- [x] PAGES-68 · component — A route with no error file of its own (the access pages, the legal pages,
  `/` and `/login`) shows the page-error state of PAGES-57 when it fails, under that route's header:
  signed out, the access header and no tab bar. The thrown error is reported to Sentry and not shown.

Across the phase

- [x] PAGES-69 · component — Each page sets its browser title as «<página> · Buy Car Map» (`RULES.md`
  §19), with the names of the worked example "Browser titles" (decided
  2026-10-16, owner).
- [x] PAGES-70 · e2e — `/register`, `/verify-email` with a token and without, `/confirm-email` with a
  token, `/forgot-password`, `/reset-password` with a token and without, `/privacy`, `/terms` and the
  not-found page pass axe with no serious or critical violation at 1440×900 and at 390×844 (amends
  FRONT-19).

## Worked examples

**Server rejections (PAGES-3, PAGES-42).** All copy is the existing `authErrors.*` text.

| Page | Field | Code | Shown under the field |
| --- | --- | --- | --- |
| `/register`, `/reset-password`, «Cambiar contraseña» | the new password | `passwordBreached` | «Esta contraseña ha aparecido en una filtración de datos conocida. Elige otra distinta.» |
| same | same | `passwordWeak` | «Esta contraseña es demasiado fácil de adivinar. Prueba con una más larga o menos predecible.» |
| `/reset-password`, «Cambiar contraseña» | same | `passwordReused` | «Elige una contraseña distinta de la actual» |
| `/register` | «Email» | invalid on submit | «Introduce un email válido» |
| «Cambiar correo», «Cambiar contraseña» | «Contraseña actual» | `currentPasswordIncorrect` | «Tu contraseña actual no es correcta» |
| «Cambiar correo» | «Nueva dirección de correo» | `sameEmail` | «Esa ya es tu dirección de correo» |
| «Dos pasos» | the code | `totpInvalid` | «Ese código no es válido. Revisa tu app e inténtalo de nuevo.» |
| «Dos pasos» (activate, regenerate, disable), «¿Eliminar tu cuenta?» | «Tu contraseña» | `currentPasswordIncorrect` | «Tu contraseña actual no es correcta» |
| any form of these pages, dialogs included | none: a form alert above the primary button | `rateLimited`, `generic` | their `authErrors.*` copy (PAGES-4, PAGES-71) |

A taken address on `/register` is not a field error: `register` answers `pending`, and the page shows
PAGES-11's state, as for a free one (AUTH-1).

**Strength meter (PAGES-5),** from `F7-registro-estados` and `F7-contrasena-estados`.
- A 4-character password with a sequence → «Seguridad: muy débil», then «Demasiado corta: usa al menos
  12 caracteres» and «Evita secuencias como “abcd” o “1234”», no hint (corrected 2026-10-16, confirmed
  by the owner: the kept scoring gives 0).
- `fjzqvbkfjzqv` (12 characters, 7 different, about 42 bits, no issue) → «Seguridad: débil», nothing
  listed, and the hint (added 2026-10-16, session).
- A password scored 2 with no issue → «Seguridad: aceptable» and the hint.
- `fjzqvbkmxatlw` (13 different characters, about 61 bits, no issue) → «Seguridad: buena», nothing
  listed, and no hint: the hint's boundary (added 2026-10-16, session).
- A password scored 4 → «Seguridad: muy buena», nothing under it. The server may still reject it
  (`passwordBreached`): the meter is a hint.

**Summary line (PAGES-31).** The first row is `F0-cuenta`'s (Alba). Today is 2026-10-16. The time zone
is next-intl's: the `tz` cookie, or UTC without one (`i18n/request.ts`); the current year is read in
the same zone.

| Saved | Alerts | `createdAt` | Time zone | Summary line |
| --- | --- | --- | --- | --- |
| 8 | 3 | 2026-03-10T10:00:00Z | UTC | «8 guardados · 3 alertas · en BuyCarMap desde marzo» |
| 0 | 0 | 2026-03-10T10:00:00Z | UTC | «0 guardados · 0 alertas · en BuyCarMap desde marzo» |
| 1 | 1 | 2026-03-10T10:00:00Z | UTC | «1 guardado · 1 alerta · en BuyCarMap desde marzo» |
| 2 | 1 | 2025-03-10T10:00:00Z | UTC | «2 guardados · 1 alerta · en BuyCarMap desde marzo de 2025» |
| 8 | 3 | 2025-03-31T23:30:00Z | UTC | «8 guardados · 3 alertas · en BuyCarMap desde marzo de 2025» |
| 8 | 3 | 2025-03-31T23:30:00Z | Europe/Madrid (01:30 on 1 April, summer time) | «8 guardados · 3 alertas · en BuyCarMap desde abril de 2025» |
| 8 | 3 | 2025-12-31T23:30:00Z | UTC | «8 guardados · 3 alertas · en BuyCarMap desde diciembre de 2025» |
| 8 | 3 | 2025-12-31T23:30:00Z | Europe/Madrid (00:30 on 1 January 2026) | «8 guardados · 3 alertas · en BuyCarMap desde enero» |

**Sessions line (PAGES-35).** This device is Chrome on Windows; the other sessions are listed by last
use, newest first.

| Sessions | Badge | Line |
| --- | --- | --- |
| this device only | «1 abierta» | «Chrome en Windows, esta.» |
| this device and Safari on an iPhone, last used 2 days ago (`F0-cuenta`) | «2 abiertas» | «Chrome en Windows, esta. Safari en iOS, hace 2 días.» |
| the two above and 3 older | «5 abiertas» | «Chrome en Windows, esta. Safari en iOS, hace 2 días, y 3 más.» |
| the two above and 1 older (added 2026-10-16, owner) | «3 abiertas» | «Chrome en Windows, esta. Safari en iOS, hace 2 días, y 1 más.» |
| Safari on an iPhone, 2 days ago, and this device used less recently (added 2026-10-16, owner) | «2 abiertas» | «Safari en iOS, hace 2 días. Chrome en Windows, esta.» |

«Cerrar las demás» shows in every row.

**Account query (PAGES-60).** Ada has 8 saved cars and 1 removed (soft-deleted), 3 alerts and 1
deleted (soft-deleted). Grace has 2 saved cars and 5 alerts.
- Ada's `/account` reads 8 saved cars and 3 alerts, her own name, email and `createdAt`, and her 2
  sessions with their id, user agent and last use only, and no field or session of Grace's (Grace has 1
  session).
- A session of Ada's whose `expires` has passed is neither counted nor listed (added 2026-10-16).
- Grace's reads 2 and 5.
- Signed out, `/account` redirects to `/login?callbackUrl=/account` before any read.

**Device (PAGES-52).** `parseDeviceLabel` (`lib/format.ts`) gives the browser and the system.

| User agent | Today | PAGES-52 |
| --- | --- | --- |
| Chrome on Windows | «Chrome · Windows» | «Chrome en Windows» |
| Firefox, system unknown | «Firefox» | «Firefox» |
| neither known, or empty | «Dispositivo desconocido» | «Dispositivo desconocido» |
| Safari on an iPhone | «Safari · iOS» | «Safari en iOS», as the boards write it (the user agent gives the system, not the device) |

**Layout by viewport (PAGES-7, PAGES-28, PAGES-64).** From the boards' markup.

| Viewport | `/register` | `/account` | `/privacy`, `/terms` |
| --- | --- | --- | --- |
| 1440×900 | Two columns 80px apart inside 48px; the left block (headline, line, the illustration 620px wide, its drawn content 30px under the line) centred on the panel; the arrow; footer | 32px side padding, three columns of (1440 − 64 − 40) / 3 = 445.33px with 20px gaps; «Eliminar cuenta» spans 910.67px | 48px side padding; index 260px; 72px gap; reading column at most 720px |
| 1024×900 | One centred 440px column: headline, line, form, Google, legal notice, «Entra»; desktop header and footer; no illustration (less than 150px of drawing fits, ENTRY-29's rule) | Three columns of (1024 − 64 − 40) / 3 = 306.67px; the same spans | Index 260px, 72px gap, reading column 1024 − 96 − 260 − 72 = 596px |
| 390×844 | Phone composition: no panel, no «o», no illustration, no footer | One column, 12px gaps, 18px card padding; the tab bar | The folded index after the date |

The other access pages have no laptop board: from 1024px to 1439px they take `/register`'s 1024 column
(PAGES-75).

**Browser titles (PAGES-69).** Each title is the page name, « · », and «Buy Car Map».

| Page | Title |
| --- | --- |
| `/register` | «Crear cuenta · Buy Car Map» |
| `/verify-email` | «Confirma tu cuenta · Buy Car Map» |
| `/confirm-email` | «Confirma tu correo · Buy Car Map» |
| `/forgot-password` | «Recuperar contraseña · Buy Car Map» |
| `/reset-password` | «Nueva contraseña · Buy Car Map» |
| `/account` | «Cuenta · Buy Car Map» (kept) |
| `/privacy` | «Privacidad · Buy Car Map» |
| `/terms` | «Términos · Buy Car Map» |
| the not-found page | «Esto no existe · Buy Car Map» |

## Data model

No change: no new model, column, index or migration, and no seed change. `/account` reads what the
schema already holds:
- `User.createdAt`, for «en BuyCarMap desde <mes>»;
- the count of the user's `Favorite` rows and of their `Alert` rows, each with `deletedAt` null;
- the user's `Session` rows for the sessions card, with only `id`, `userAgent` and `updatedAt` (the last
  use) selected, as `findMySessions` (`server/account/service.ts`) already reads them, minus `ipAddress`.

**Personal data** (`RULES.md` §12). Nothing new is stored. The Google account's email is not stored
and is not shown (decided 2026-10-16, owner): storing it would be a new personal field for an
inventory row, an export field and a deletion path, for a line the design no longer needs. The counts
and the month are derived from rows the inventory already lists. `docs/privacy/` is unchanged.

## Permissions

- `/account` is the signed-in user's own: the page query goes through `getCurrentUserWithSessionId()`
  (`lib/auth/session.ts`: `getCurrentUser()`'s session lookup, which also answers that session's id to
  mark this device; amended 2026-10-16: approved by the owner after the build's third review) and reads
  rows filtered by the user's id (`ownedBy()`), counts included (PAGES-60). Its integration test proves
  that Ada's page counts none of Grace's rows (`RULES.md` §10).
- Every action behind a dialog keeps its own authorization and rate limits unchanged: `updateProfile`,
  `requestEmailChange`, `requestEmailVerification`, `changePassword`, `startTwoFactorSetup`,
  `confirmTwoFactorSetup`, `regenerateRecoveryCodes`, `disableTwoFactor`, `unlinkAccount`,
  `listMySessions`, `revokeMySession`, `revokeOtherMySessions`, `signOutEverywhere`, `exportMyData`,
  `deleteAccount` (AUTH, BAUTH, EXPORT). F7 changes where their forms are drawn, not what they check.
- The access pages are public; `proxy.ts` still sends a signed-in visitor away from `/register` and
  `/forgot-password`, and leaves `/reset-password`, `/verify-email` and `/confirm-email` open (kept).
- Registration, verification, reset and email change keep their enumeration resistance: the pending,
  sent and email-change notices are identical whatever the address (AUTH-1, AUTH-13, PAGES-11,
  PAGES-21, PAGES-41), and no page reads a token at render (PAGES-14).
- The not-found page reads the session for display only. A 404 for another user's alert stays a 404,
  not a 403 (ALERTUI-45, kept).

## Edge cases

- **A taken address on register:** the same «check your inbox» state as a free one (PAGES-11, AUTH-1).
- **Email not configured** (local only): `register` creates the account at once, and the page signs in
  and goes to `/` with the toast «¡Cuenta creada con éxito!», as today; no board draws it.
- **A breach-service outage:** the password is accepted (AUTH-4, kept).
- **An expired or used link:** the expired-link state, whether the page was opened with it or its
  button was pressed, with no toast (PAGES-16, PAGES-19, PAGES-24).
- **A link with no token:** the same state.
- **A mail scanner fetching a link:** nothing is redeemed (PAGES-14).
- **The meter says «muy buena» and the server refuses:** the field error wins (PAGES-3, worked example
  "Strength meter").
- **A Google-only account:** no password or two-factor card, no email change, «Desconectar» disabled
  (PAGES-27, PAGES-30, PAGES-34).
- **No Google linked:** «No hay cuentas conectadas.» and no button; linking Google from `/account` does
  not exist (Out of scope).
- **One session only:** «1 abierta», «<device>, esta.», and «Cerrar las demás» still shows; the sheet
  lists this device alone (PAGES-35, worked example "Sessions line").
- **No sessions listed:** cannot happen — the user's own session is always listed — so the sessions
  sheet has no empty state (decided 2026-10-16, owner). A read that answers no session at all — this
  session was ended from another device while the sheet opened — is shown as the failed read, the alert
  and «Reintentar», never an empty list (decided 2026-10-16, session, after the build's second review).
- **An expired session:** neither counted on the card nor listed in the sheet (PAGES-35, PAGES-49,
  PAGES-60).
- **More sessions than the line holds:** the two most recent and «y N más» (PAGES-35).
- **A name saved unchanged:** the dialog closes, with no request and no toast (PAGES-40).
- **Leaving an access form or closing a dialog with something typed:** no warning
  ([ADR 0022](../decisions/0022-access-forms-no-unsaved-guard.md)).
- **Pressing Escape, outside or «Cancelar» while a request runs:** nothing happens (PAGES-72).
- **A user with no name:** the email is the card's heading (PAGES-29).
- **A name edited in another tab:** `conflict`, a form alert in the dialog (PAGES-40, DATA-16).
- **A clipboard the browser refuses:** the error toast, and the codes stay on screen to copy by hand
  (PAGES-46), and «Ya los he guardado» is enabled all the same (PAGES-45).
- **The sessions read failing:** «Reintentar» in the sheet (PAGES-50).
- **Deleting with the wrong password:** a field error under «Tu contraseña» (PAGES-55); the same in
  «Dos pasos» (PAGES-44, PAGES-48).
- **A rate limit or an unexpected failure in a form:** a form alert above its primary button (PAGES-4,
  PAGES-71).
- **A long email or name:** cut to one line with «…» on the cards, never widening the grid; the whole
  text stays in the page for assistive tech.
- **Two cards of one row with lines of different length:** the row's cards grow together (PAGES-28).
- **A deep link to a section:** it opens scrolled to the heading, clear of the header (PAGES-64).
- **A section heading that changes between locales:** the anchors do not: each section's `id` is
  stored in the message files, the same in both locales (PAGES-74).
- **`/alerts/[id]`'s 404, signed in:** «Alertas» stays current (PAGES-66).
- **An unknown address, signed in or out:** PAGES-65 to PAGES-67.
- **A failure on a page with no error file:** PAGES-68.
- **The root layout itself failing:** Out of scope.

## Out of scope

- **Linking Google from `/account`,** and setting a password on a Google-only account. Neither exists
  today; the design draws neither.
- **Storing or showing the Google account's email** (decided 2026-10-16, owner).
- **A «password changed» date** (decided 2026-10-16, owner).
- **Changing what the auth actions check:** token lifetimes, rate limits, the password policy, TOTP
  parameters, account linking (`CLAUDE.md` › Authentication). F7 redraws their forms only.
- **The emails** ([#123](https://github.com/algusaem/buycarmap/issues/123)).
- **A `global-error.tsx`** for a failure of the root layout itself: no board draws it, and with the
  layout down there is no header to draw.
- **`/palette` and `/typography`:** development pages.
- **The privacy page's content:** its sections stay the message files' text (FRONT-27); the board's
  repeated paragraph is a placeholder.
- **Keyboard, screen-reader and real-iPhone checks beyond axe**
  ([#127](https://github.com/algusaem/buycarmap/issues/127)).

## Contracts

**Server.**
- `getAccountOverview` (`server/account/queries.ts`) keeps its signature and its redirect.
  `findAccountOverview` (`server/account/service.ts`) adds to its one `select`: `createdAt`, and
  `_count` of `favorites` and of `alerts`, each filtered by `notDeleted` (`lib/db/soft-delete.ts`), and the
  user's `sessions` with `id`, `userAgent` and `updatedAt`, newest-used first (PAGES-60). One query, no
  per-relation read. The password hash still never leaves the server: the page passes only
  whether there is one.
- No new action. Every action listed under Permissions keeps its signature, its result and its error
  codes; the codes are mapped to fields or alerts as the worked example "Server rejections" says.
  The exceptions: `updateProfile` and `changePassword` also answer, on success, the user row's new
  `version`, which the page asserts on its next save instead of adding one itself (DATA-15; amended
  2026-10-16: decided by the owner after the build's first review). `findAccountOverview` and
  `findMySessions` leave out a session whose `expires` has passed (PAGES-60, PAGES-49).
- The pages of `/verify-email`, `/confirm-email` and `/reset-password` keep reading only whether
  `token` is present (PAGES-14). `/forgot-password`'s page becomes a Server Component, with the form as
  the client part (`RULES.md` §9).

**Client.**
- Reused: the `/login` composition (`LoginHeadline`, the panel, the illustration slot and the arrow),
  `PasswordInput`, `PasswordStrengthMeter`, `OAuthButtons`, `FieldMessage`, `Headline`, `EmptyState`,
  `PageError`, `useIsPhone`, the CreateAlert dialog's frame and `PhoneBottomSheet`
  (`components/map/phone/SheetChrome.tsx`) for the sheets.
- `@radix-ui/react-dialog` draws the account's centred dialog (`components/account/AccountDialog.tsx`):
  a use of the package [ADR 0020](../decisions/0020-radix-popover-dialog-slider.md) approved for the
  map and the create-alert dialog, not a new dependency.
- Removed once unused: `AuthBackground`, `BrandHeader`, `LegalNotice` in its current form,
  `InvalidVerifyLink` and `InvalidResetLink` as Card layouts, and the old Card markup of every account
  form.
- Request lifecycles stay where they are (ADR 0007 row 19): the account hooks in `lib/hooks/` call the
  account actions; the access forms call their actions through React Hook Form.
- `formatRelativeTime` and `parseDeviceLabel` (`lib/format.ts`) give the sessions' «hace 2 días» and
  device; the month of PAGES-31 comes from `lib/format.ts` too, beside `formatDate`, in next-intl's time
  zone (FRONT-11).

**Headers** (`components/nav/nav-routes.ts`, HEAD).
- The access and legal pages keep HEAD-6 and HEAD-7.
- `/account`'s `loading.tsx` and `error.tsx` render under `/account`'s own header: the pages header with
  the avatar current, and at phone width the tab bar with «Cuenta» current.
- The root `error.tsx` renders under the header of the route that failed, and takes its side padding
  by the not-found page's rule: the pages header's once the signed-in tab bar shows (amended
  2026-10-16: decided in session).
- The not-found page takes its header from the session, not from the path: the access header signed
  out, the pages header with nothing current signed in (PAGES-66), and while the session resolves
  the neutral pending header the landing shows, offering neither (amended 2026-10-16: decided in
  session).

**Route files.** New: `app/not-found.tsx`, `app/error.tsx`, `app/account/loading.tsx`,
`app/account/error.tsx`. Issue [#43](https://github.com/algusaem/buycarmap/issues/43) is closed (its
state on GitHub, 2026-10-16); of the routes it named, `/account` is the one F7 owns, and it gets its
files here. The access and legal pages read no server data, so they get no `loading.tsx`, as ENTRY
decided for `/` and `/login`; their error boundary is the root `error.tsx`.

**i18n keys**, both locales (`messages/es.json`, `messages/en.json`, `lib/i18n/types.ts`). The design
gives Spanish only; English is drafted with the implementation and reviewed in the pull request, as in
ENTRY. The board copy replaces the current copy (decided 2026-10-16, owner). Changed, from → to:

| Where | Key | Today | F7 |
| --- | --- | --- | --- |
| Register, submit | `auth.signUp` | «Registrarse» | «Crear cuenta» |
| Register, busy | `auth.creatingAccount` | «Creando cuenta...» | removed: the label stays (PAGES-2) |
| Repeat field | `auth.confirmPassword`, `auth.confirmPasswordPlaceholder`, `resetPassword.confirmPassword` | «Confirmar contraseña», «Confirma tu contraseña» | «Repite la contraseña», «Otra vez, por si acaso» |
| Legal notice | `auth.legalNotice` and its parts | «Al iniciar sesión, aceptas nuestros … Política de privacidad» | «Al crear tu cuenta aceptas los Términos y la Privacidad.» |
| Sign-in link | — | «Entrar» | «Entra» (new key) |
| Meter | `passwordStrength.label`, `passwordStrength.scores.*` | «Seguridad de la contraseña», «Muy débil» … «Muy segura» | «Seguridad:», «muy débil», «débil», «aceptable», «buena», «muy buena» |
| Pending | `verifyEmail.pendingDescription`, `verifyEmail.resend` | «Si esa dirección puede usarse…», «¿No te ha llegado? Enviar de nuevo» | PAGES-11's line, «Reenviar el correo» |
| Verify, success toast | `verifyEmail.success` | «Cuenta creada. Ya puedes iniciar sesión.» | removed: no toast (PAGES-15) |
| Google-only line | `account.providers.lastMethodHint` | «Es tu única forma de iniciar sesión. Establece una contraseña antes de desconectarla.» | «Es tu única forma de iniciar sesión.» (PAGES-34) |
| Google-disconnect refusal | `authErrors.lastSignInMethod` | «Es tu única forma de iniciar sesión. Establece una contraseña antes de desconectarla.» | «No puedes desconectarla: es tu única forma de iniciar sesión.» (PAGES-53; decided 2026-10-16, owner) |
| Verify | `verifyEmail.*` | «Todo listo / Tu cuenta está preparada…», «Ir a iniciar sesión» | PAGES-13, PAGES-15, PAGES-16 copy, «Entrar» |
| Confirm | `confirmEmail.*` | «Confirma tu dirección de correo», … | PAGES-17 to PAGES-19 copy |
| Forgot | `forgotPassword.*` | «Restablecer tu contraseña», «Volver a iniciar sesión», «Si existe una cuenta…» | PAGES-20, PAGES-21 copy, «Volver a entrar» |
| Reset | `resetPassword.*` | «Elige una nueva contraseña», «Actualizar contraseña», «Solicitar un enlace nuevo» | PAGES-22 to PAGES-24 copy, «Guardar contraseña», «Pedir otro enlace» |
| Account | `account.description` | «Gestiona tu perfil y tus ajustes de seguridad.» | the two lines of PAGES-25 and PAGES-26 |
| Account cards | `account.email.title`, `account.twoFactor.title`, `account.providers.title`, `account.sessions.title`, `account.email.verified` | «Dirección de correo», «Verificación en dos pasos», «Cuentas conectadas», «Sesiones activas», «Verificada» | «Correo», «Dos pasos», «Google», «Sesiones», «Verificado» |
| Account buttons | `account.twoFactor.enableCta`, `account.sessions.signOutOthers` | «Configurar dos pasos», «Cerrar sesión en todos los demás dispositivos» | «Activar» (card) with «Configurar dos pasos» kept in the dialog; «Cerrar las demás» |
| Account, new | — | — | «Cambiar nombre», «Cambiar contraseña», «Gestionar», «Cerrar», «¿Eliminar tu cuenta?», the cards' lines, «<N> abiertas» with «1 abierta», «Este dispositivo» as a badge, «en BuyCarMap desde {month}», the singular and plural counts of PAGES-31, «y N más» (PAGES-35), the page names of the worked example "Browser titles" |
| Legal | `legal.privacy.title`, `legal.terms.title`, `legal.backToHome` | «Política de privacidad», «Términos del servicio», «Volver al inicio» | «Privacidad», «Términos»; `legal.backToHome` removed |
| Legal, new | — | — | «En esta página»; one stable `id` per section of `legal.privacy` and `legal.terms`, the same in both locales (PAGES-74) |
| Not found | — | — | «¿Te has perdido?», «Esto no existe», «Esta dirección no lleva a ninguna página. Vuelve al mapa y sigue buscando.» |

Kept as they are: `authErrors.*` other than `lastSignInMethod` (the copy of every other field error
and alert), `account.danger.*`, `account.twoFactor.*` other than its title and `enableCta`,
`errors.*`, `nav.backToMap`.

**Tests.** Every e2e criterion that needs a signed-in user — PAGES-28, PAGES-39, PAGES-58, PAGES-59 and
the signed-in half of PAGES-67 — runs in `pnpm test:e2e:db` (`pnpm db:branch` first), not in CI, as
EXPORT-18 and HEAD-18 do. PAGES-7, PAGES-8, PAGES-64, PAGES-70 and the signed-out half of PAGES-67
need no database. PAGES-60's count filtering runs in the integration project against real Postgres.
The visual baselines of the changed pages are regenerated (TEST-15).

**Surface briefs** (`STACK.md` §17): [access](../../.impeccable/surfaces/access.md) (`/register`,
`/verify-email`, `/confirm-email`, `/forgot-password`, `/reset-password`),
[account](../../.impeccable/surfaces/account.md) (`/account`), [legal](../../.impeccable/surfaces/legal.md)
(`/privacy`, `/terms`) and [not-found](../../.impeccable/surfaces/not-found.md) (the not-found page and the
root error).

**Criteria amended** (in the same change as the tests, each statement kept and marked with a dated
note, «amended 2026-10-16, PAGES — redesign-pages.md»):
- **`auth-email-and-oauth.md` (AUTH):**
  - AUTH-1: the pending state is PAGES-11's, still identical for a free and a taken address, and the
    resend toast is still neutral;
  - AUTH-13: the email-change form is the «Cambiar correo» dialog or sheet, with the same neutral
    notice and «Cerrar» (PAGES-41);
  - AUTH-14: the last-method line is the Google card's (PAGES-34); its worked example's text loses its
    second sentence: "This is your only way to sign in." («Es tu única forma de iniciar sesión.»), with
    no instruction to set a password;
  - the Component paragraph's account form names: the email form is the «Correo» card
    (`EmailCard`) and its dialog.
- **`core-better-auth.md` (BAUTH):**
  - BAUTH-4: the sessions list is the «Sesiones» dialog or sheet, read again each time it opens, the
    device «X en Y» (PAGES-49, PAGES-52); the «Sesiones» card reads the sessions with the page query
    (PAGES-35, PAGES-60);
  - BAUTH-10: the Google card shows «Conectada» only, never the Google email (PAGES-34);
  - BAUTH-11: the codes show in the alertdialog of PAGES-45, once; «Ya los he guardado» is enabled
    after any press of «Copiar códigos», and Escape or a press outside does not close it; a wrong
    password in the two-factor dialog is a field error (PAGES-44, PAGES-48), no longer a toast.
- **`account-data-export.md` (EXPORT):** EXPORT-14: the button sits in the «Tus datos» card; EXPORT-14
  to EXPORT-18 otherwise unchanged.
- **`core-data-model.md` (DATA):** DATA-16: the conflict message is a form alert in the «Cambiar
  nombre» dialog (and the «Cambiar contraseña» one), not a toast; its e2e test opens the dialogs.
- **`core-frontend.md` (FRONT):**
  - FRONT-11: `formatMonth` and `formatDeviceLabel` join the formatters (PAGES-31, PAGES-52; decided
    by the owner after the build's second review);
  - FRONT-14: `/account`'s loading and error are PAGES-56 and PAGES-57;
  - FRONT-15: the server's password rejections on `/register` are field errors, the expired or used
    link a page state (PAGES-16, PAGES-19, PAGES-24), and every other failure of a form on these pages,
    dialogs included, sits in the form, never a toast: a wrong password (PAGES-44, PAGES-55) and
    `rateLimited` or `generic` (PAGES-4, PAGES-71); the confirmed registration shows no toast
    (PAGES-15);
  - FRONT-19: the routes of PAGES-58 and PAGES-70, at desktop and phone width;
  - FRONT-20: the F7 screenshots are owed, for every board frame;
  - FRONT-27: `LegalContent` changes (the index, the anchors, the title); the content rules stay.
- **`core-platform.md` (PLAT):** PLAT-14: `/account` gains its error file and the root error boundary
  exists (PAGES-57, PAGES-68); the note on issue #43 says it is closed.
- **`redesign-navigation.md` (HEAD):**
  - HEAD-6, HEAD-7, HEAD-8 and the Edge case «the error and not-found pages take the sign-in header»:
    the not-found page takes the pages header and the tab bar signed in (PAGES-66), except
    `/alerts/[id]`'s 404, which keeps «Alertas» current, and an error page takes its route's header;
  - HEAD-13 and HEAD-18 kept, with the new layout.
- **`redesign-entry.md` (ENTRY):** Out of scope: `/register`'s illustration is built here (PAGES-7),
  and at 1024px it does not show (the board); ENTRY-10 and ENTRY-22 now hold on every F7 password field
  (PAGES-6); ENTRY-22: a field error carries `role="alert"`, `/login`'s email field included (amended
  2026-10-16 after the build's first review).
- **`redesign-foundation.md` (LOOK):** the shared card primitive is removed, no caller left: the
  account blocks are AccountCard and the sign-in forms the access panel.

## Decisions and rationale

**Decided 2026-10-16, owner** (with the design, «aprobado»):
- **`/account` stays a summary** (`F0-cuenta`). Each card says what it holds in one line and offers one
  action; the action opens its form in a dialog on desktop and a bottom sheet on the phone, the
  confirmation patterns of F6 (ALERTUI-33, ALERTUI-34). An account page that shows every form at once
  makes the rare actions (deleting, disabling two-factor) as present as the common ones, and puts eight
  submit buttons on one screen.
- **No name on register.** The design asks for an email and a password only; the name is optional and
  is set from «Cambiar nombre». A shorter form loses nothing the account needs to exist.
- **The Google card says «Conectada» and nothing more.** The Google account's email is not stored
  (`Account` has no email column), and storing it would be new personal data (`RULES.md` §12) for a
  line that adds nothing a user needs to act on.
- **«Confirma tu cuenta» shows no address.** Showing it means looking the token up at render, which
  turns the page into an oracle for probing tokens and lets a mail scanner's prefetch reach the token
  table. The button-only confirm exists precisely because scanners fetch links.
- **The summary counts what exists.** «N guardados · N alertas · en BuyCarMap desde <mes>» is read from
  rows and a column the schema has. No «password changed» date: `users.password_changed_at` was dropped
  (BAUTH-20), and `Account.updatedAt` moves for reasons other than a password change.
- **The boards' copy replaces the app's.** Design first (`CLAUDE.md`): the screens win. That includes
  the strings the designer wrote and the owner approved: «¿Te has perdido? / Esto no existe», «Esta
  dirección no lleva a ninguna página. Vuelve al mapa y sigue buscando.», «¿Enlace caducado? /
  Regístrate otra vez», «¿Es tu correo nuevo? / Confírmalo», «¿Hecho? / Correo cambiado», «¿Eliminar
  tu cuenta?», «Gestionar» and «Cerrar».
- **A rejected password shows under its field, never as a toast** (`STACK.md` §14, FRONT-15). A toast
  vanishes after a few seconds and leaves a form that looks fine. A taken email is not one of these:
  revealing it would break AUTH-1, so it keeps the neutral pending state.

**Taken by the design** (`F7-*` captions and READMEs, approved with it):
- The follow-up states on desktop keep the access layout, the panel holding the state's title and
  actions; on the phone there is no panel title.
- A server rejection sits under its field, the meter under the error.
- The meter's issues and hint, and its hint rule, which is the code's today
  (`components/auth/PasswordStrengthMeter.tsx`: no issue and a score under 3).
- The QR plate is the `text` token with modules in `bg`: the contrast cameras need, without the pure
  white the system bans.
- «Cerrar sesión en todas partes» is secondary, not danger: danger is for what cannot be undone, and
  signing back in undoes it.
- The sessions sheet's load error has «Reintentar», so it is not a dead end (`RULES.md` §19).
- The recovery codes are an alertdialog with no «Cancelar»: they are shown once, and a reflex dismiss
  loses them.
- With no Google linked the card has no button: linking from `/account` does not exist.
- `/account` at 1024px keeps three columns; the legal index stays at 260px and the column narrows.
- The 404 reuses the page-error body, with one lime action because it is the only one.
- `/register` at 1024px has no illustration: its form is taller than `/login`'s, and under ENTRY-29's
  rule less than 150px of drawing fits.

**Decided 2026-10-16, owner («todo sí»)**, the draft's open questions, each with its recommended
answer:
- **An expired or used link, on submit,** gives way to the expired-link page state, the same as a
  missing token, with no toast (PAGES-16, PAGES-19, PAGES-24): the button cannot succeed again, and the
  page's way forward (register again, ask again) is what the user needs.
- **The Google-only line** is «Es tu única forma de iniciar sesión.», with no instruction to set a
  password (PAGES-34): `/account` has no «set a password» for an account with none, and
  `/forgot-password` sends no link to an OAuth-only account (`server/password-reset/actions.ts`). The
  boards and the AccountCard README are amended.
- **«Guardar cambios» is enabled before an edit** (PAGES-40), as `RULES.md` §19 asks and the board
  draws; an unchanged name closes the dialog with no request and no toast.
- **«Ya los he guardado» is enabled after any copy attempt** (PAGES-45), the code's rule
  (`components/account/RecoveryCodesPanel.tsx`): gating it on a successful copy traps anyone whose
  browser refuses the clipboard, on a panel shown once. Escape and a press outside do not close it. The
  board's caption and the AccountCard README are amended.
- **Failures with no field are a form alert above the primary button** (PAGES-4, PAGES-71), as ENTRY-12
  does on `/login`, so every failure of a form is in the form.
- **The phone register shows the legal notice** (PAGES-9), placed as on desktop, after Google: it is the
  statement of consent to the terms. `F0-registro` and `F7-registro-estados` are amended.
- **With no name, the email is the card's heading** (PAGES-29), as the avatar takes the email's initial
  (HEAD-9).
- **The summary line's forms** (PAGES-31): «0 guardados», «1 guardado», «N guardados», the same for
  alerts, and the year only when `createdAt` is not in the current year («desde marzo de 2025»), as
  «Creada el …» does (ALERTUI-10).
- **The sessions card reads on the server** with the page query, selecting only id, user agent and last
  use (PAGES-35, PAGES-60); the sheet re-reads when it opens (PAGES-49). One session: «1 abierta» and
  «<device>, esta.»; past two, the two most recent and «y N más»; «Cerrar las demás» always shows.
- **A wrong password in «Dos pasos» and «¿Eliminar tu cuenta?»** is a field error under «Tu
  contraseña», «Tu contraseña actual no es correcta» (PAGES-44, PAGES-48, PAGES-55), as «Cambiar correo»
  draws it.
- **The legal pages keep their intro under the date** (PAGES-61): it is content (FRONT-27), and the
  board's text is a placeholder.
- **`/alerts/[id]`'s 404 keeps «Alertas» current** (PAGES-66): the section the user was in.
- **The browser titles** are the worked example "Browser titles" (PAGES-69).
- **The device is «Safari en iOS»** (PAGES-52): `parseDeviceLabel` gives «iOS» for an iPhone, an iPad and
  an iPod, and the user agent cannot always tell an iPad from a Mac, so a device name would be guessed.
  The boards now write «Safari en iOS».
- **The other access pages at laptop width** take `/register`'s centred 440px column from 1024px to
  1439px (PAGES-75).
- **Section anchors are stable ids in the message files,** the same in both locales (PAGES-74): an `id`
  built from the heading would break a link shared across locales («Tus derechos» / "Your rights").
- **Focus and closing in the dialogs** (PAGES-72, PAGES-73): focus starts on the first field of a form
  dialog, «¿Eliminar tu cuenta?» included (its button stays disabled until the fields are filled, so no
  reflex can delete); on «Copiar códigos» in the codes dialog; on «Cerrar» in «Sesiones». While a
  request runs, Escape, a press outside, a drag and «Cancelar» do nothing, as F6 decided for its
  confirmation.
- **The confirmed registration shows no toast** (PAGES-15): the page already says it.

**Decided 2026-10-16, owner («apruebo»):**
- **The sessions line's «y N más» joins after a comma:** «Chrome en Windows, esta. Safari en iOS,
  hace 2 días, y 3 más.» (worked example "Sessions line"); the owner confirmed the punctuation, not
  only «y N más».
- **The Google-disconnect refusal drops the instruction to set a password:**
  `authErrors.lastSignInMethod` becomes «No puedes desconectarla: es tu única forma de iniciar
  sesión.» (PAGES-53), losing «Establece una contraseña antes de desconectarla.» (English drafted in
  the PR, as elsewhere in this spec).

**Decided 2026-10-16, owner (after the build's first review)** («todo sí»):
- **An expired session is neither counted nor listed** (PAGES-35, PAGES-49, PAGES-60):
  `findAccountOverview` and `findMySessions` read only sessions whose `expires` is still ahead. A
  session past its expiry cannot sign anyone in, so naming it as open would be false.
- **No unsaved-changes warning on the access forms and the account dialogs**
  ([ADR 0022](../decisions/0022-access-forms-no-unsaved-guard.md)): three fields at most, or one
  short task per dialog; closing a dirty dialog by «Cancelar», Escape, outside or a drag warns of
  nothing either.
- **Three theme tokens, with no visual change:** `account-name` (22px, the own card's name from `lg`),
  `grid-template-columns-legal` (the legal pages' 260px index and 720px column) and `space-dialog-max`
  (the account dialog's tallest, the window less 2rem), so no F7 file holds an arbitrary class.
- **Placeholders:** every current-password field of the account dialogs reads «Tu contraseña»
  (`/login`'s key); a new-password field has none (PAGES-42).
- **The session row's button is named «Cerrar la sesión de <device>»** ("Sign out of <device>")
  (PAGES-49).
- **`updateProfile` and `changePassword` answer the new version** (Contracts › Server): the page
  takes the version from the action instead of adding one to its own.
- **The three session corrections stand:** PAGES-5's «muy débil» for the 4-character example,
  PAGES-28's six cards with no password, PAGES-49's «Este dispositivo» with no time.
- **No empty state for the sessions sheet** (Edge cases): the user's own session is always listed.

**Decided 2026-10-16, session** (after the build's first review):
- **The focus follows a state swap** (PAGES-76): a form that gives way to another state leaves the
  focus on nothing unless it moves; it moves to the new state's headline, or inside a dialog to its
  first control.
- **The not-found page shows the pending header while the session resolves**, as the landing does,
  rather than the signed-out access header; the root error takes its sides by the same session rule
  (Contracts › Headers).
- **Scores 1 and 3 join the meter's worked example** (PAGES-5).

**Decided 2026-10-16, owner (after the build's second review)** («me parece bien todo»):
- **No silent sign-in after a password change** (PAGES-42): the server already keeps this session
  (`replacePassword`'s kept session) and ends the others, so signing in again with the new password
  only adds a second request that can fail. The page tells `authClient`'s session store to read the
  session again, as «Cambiar nombre» does, outside the action's answer, so a failed refresh never
  turns a successful change into a refusal. This replaces the session's round-one decision to bring
  the silent sign-in back.
- **The focus after «Desconectar» Google** (PAGES-76): once the disconnect succeeds, the button is
  gone, so the focus moves to the Google card's heading.
- **FRONT-11 names `formatMonth` and `formatDeviceLabel`** (`core-frontend.md`, Criteria amended):
  the summary line's month and the session's device are locale formatting, held to the same rule as
  the other formatters.

**Decided 2026-10-16, owner (after the build's third review)** («todo sí»):
- **No fourth review round:** this batch of fixes is verified and then goes to the screenshots.
- **One shared responsive dialog frame** (`components/ui/ResponsiveDialog.tsx`): the account dialogs
  and the alerts' delete confirmation (ALERTUI-33 to ALERTUI-35) open in the same centred dialog on
  desktop and bottom sheet on the phone, with no visual or behavioural change to either.
- **A busy button keeps the focus** (the busy definition above, PAGES-2): busy is `aria-disabled` and
  `aria-busy` with a press ignored, not the native `disabled`, so a keyboard user who pressed it is
  still on it when a refusal comes back. «Cerrar sesión» (`SignOutButton`) uses the same busy button.
- **The end-to-end fallback secret lives in one place:** `playwright.config.ts` exports it and the
  session fixture imports it.
- **`getCurrentUserWithSessionId()` is approved** (Permissions): one read-only export of
  `lib/auth/session.ts`, so `/account` resolves the session once and marks this device from it.
- **Two more rows for the sessions line** (worked example "Sessions line"): three sessions read «y 1
  más», and this device used less recently than another is named second.
- **«Desactivar dos pasos» keeps the danger colour** (PAGES-48): the one reversible action in danger, a
  security downgrade that asks for the password and a code (`DESIGN.md` › Danger,
  `Button/README.md` › Peligro).

**Why the not-found page reads the session.** The header rules pick a header by path (HEAD), and an
unknown path names no section. Signed in, the access header would offer «Volver al mapa» and hide the
sections the user can reach; the board gives the pages header and the tab bar with nothing current, as
the signed-in landing does (ENTRY-8).

**Why no `loading.tsx` for the access and legal pages.** They read no server data: the access pages
only await `searchParams`, the legal pages are static. There is no wait to cover, as ENTRY decided for
`/` and `/login`. A failure still has a designed state, through the root `error.tsx`.
