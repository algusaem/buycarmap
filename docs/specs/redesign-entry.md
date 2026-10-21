# Redesign F4 — landing and sign in

Key: ENTRY
Status: Implemented
Last updated: 2026-10-21

---

## Problem

The landing `/` and the sign-in page `/login` are the two pages a visitor sees before anything else.
Today they still wear the pre-redesign look, and they do not behave the way the approved design
(`docs/design/canvas/R3-landing.dc.html`, `R3-login.dc.html`) draws them. The two pages are covered
separately below.

**The landing.**
- Its search is one free-text box. «golf madrid» reaches the map as `?q=golf madrid`, a filter the map
  only half supports (MAPUI-18), instead of a place, a car and a price.
- It shows made-up figures («50K+ / 12 / 100%») that the design system forbids.
- Signed in on a phone, it is the only signed-in page without the tab bar.

**Sign in.**
- A wrong password and a rate limit appear as a toast that disappears, where the stack's rule is
  inline feedback.
- The two-factor step, the loading state and the OAuth error are not designed.
- The phone page has no way to reach password recovery or registration.
- `?callbackUrl=` accepts a backslash path that the browser resolves to another site, so a crafted
  sign-in link can send a user elsewhere after they sign in.
- A GitHub button still appears when GitHub is configured, although the product never offers GitHub
  sign-in.

In scope:
- the landing body, desktop and phone, signed in or out, with its search, its popular cars and its
  map preview;
- the sign-in page: its copy, its states (errors, two-factor, loading, OAuth error), its phone layout,
  and the `callbackUrl` rule;
- removing GitHub sign-in;
- the illustrations and arrows on these two pages;
- the tab bar on the signed-in landing.

## Acceptance criteria

Landing

- [x] ENTRY-1 · component — The landing shows the headline «¿En busca de coche?» over «Mira el mapa»,
  the line «Una web, toda la segunda mano, sin cincuenta pestañas.», the search, and the map preview.
  It does not show figures, «Ver el mapa» as a separate link, or «Accede para guardar búsquedas».
  The body is the same signed in and signed out. From 1024px to 1439px wide the map preview is not
  shown (amended 2026-10-14: ENTRY-23).
- [x] ENTRY-2 · component — At desktop width the landing search has the segments «Dónde», «Coche» and
  «Precio» and the button «Buscar». Each segment opens the same popover as on the map (MAPUI-2 to
  MAPUI-12). A choice made in a popover is shown in its segment, and nothing is searched on the
  landing.
- [x] ENTRY-3 · component + e2e — «Buscar» goes to `/map` with what was chosen: the place with its
  radius, the brand and model, and the price limits. With nothing chosen it goes to `/map` with no
  query. The map opens with those filters applied (MAPUI-13 chips, MAPUI-1 segments).
- [x] ENTRY-4 · component — Under the desktop search, «Populares» lists «Golf», «SEAT León», «BMW
  Serie 3» and «Audi A4». Each is a link to `/map` with that car as the brand and model filter. The
  phone shows no popular list.
- [x] ENTRY-5 · component — At phone width the landing search is a card with «Dónde» and «Coche»
  over «Buscar». Tapping anywhere on the card, «Buscar» included, opens the «BUSCAR» sheet of the map
  (MAPUI-21), over the landing.
  «Ver coches» goes to `/map` with what was chosen, as ENTRY-3 does; closing it changes nothing. — «Dónde» left untouched in the phone sheet keeps the place chosen on the landing card (amended 2026-10-21, MAPUI-21, issue #117)
- [x] ENTRY-6 · component — The landing produces no `?q=` link: neither the search nor a popular car
  sends free text. The map still reads `?q=` from old links (MAPUI-18, kept).
- [x] ENTRY-7 · component — The map preview is a fixed illustration with example pins and an example
  car card. The whole preview is one link to `/map`, named «Ver el mapa». From 1440px wide it sits
  beside the search, with the Storyset illustration and the arrows. From 1024px to 1439px wide there
  is no preview and no arrow, and the Storyset illustration sits centred under the search (amended
  2026-10-14: ENTRY-23, ENTRY-24). At phone width it shows the car card inside the map and no
  illustration.
- [x] ENTRY-8 · component — At phone width, signed in, the landing shows the tab bar with «Mapa»,
  «Guardados», «Alertas» and «Cuenta», none marked current. Its header shows the wordmark and the
  language control, with no avatar and no «Entrar». Signed out it shows no tab bar and keeps «Entrar»
  (amends HEAD-7 and MAPUI-52).
- [x] ENTRY-31 · e2e — Signed in at phone width, the landing's last element can be
  scrolled fully clear of the tab bar (bug fix, found 2026-10-17, #133; HEAD-19 for the other pages).

Sign in

- [x] ENTRY-9 · component — `/login` shows:
  - the headline «¿Te mola un coche?» over «Guárdalo» and the line «Recibir alertas es gratis,
    regístrate y nos encargamos del resto.»;
  - the form titled «Entrar», with «Email» (placeholder «tu@email.com») and «Contraseña»
    (placeholder «Tu contraseña»);
  - «¿La olvidaste?» linking to `/forgot-password`, beside the «Contraseña» label and outside it;
  - «Entrar»;
  - «o» and «Continuar con Google» when Google is configured;
  - «¿No tienes cuenta? Créala», with «Créala» linking to `/register`.

  The same links are on the phone page.
- [x] ENTRY-10 · component — The password field has a show/hide button at its right end, named
  «Mostrar contraseña» while the password is hidden and «Ocultar contraseña» while it is shown.
  Pressing it switches the field between hidden and shown text and keeps what was typed. — now holds
  on every F7 password field (PAGES-6) (amended 2026-10-16, PAGES — redesign-pages.md).
- [x] ENTRY-11 · component — A wrong email or password shows «Email o contraseña incorrectos» inside
  the form, above «Entrar», as an alert. The fields keep what was typed, and no toast appears. An
  unknown email and a wrong password show the same message (AUTH enumeration resistance, kept).
- [x] ENTRY-12 · component — A rate-limited sign-in shows «Demasiados intentos. Espera unos minutos e
  inténtalo de nuevo.» in the same place, as an alert, with no toast.
- [x] ENTRY-13 · component — When the account has two-factor on, the code field
  («Introduce el código de 6 dígitos») appears under the password, with focus and the hint
  «¿Has perdido el móvil? Escribe aquí uno de tus códigos de recuperación.». Email and password stay
  as typed. Six digits are checked as an app code, anything else as a recovery code (kept). A wrong
  code shows «Ese código no es válido. Revisa tu app e inténtalo de nuevo.» under the code field.
- [x] ENTRY-14 · component — While signing in, «Entrar» is disabled and shows a spinner beside its
  label, which does not change. — "disabled" is PAGES' busy: `aria-disabled` and `aria-busy` with a
  press ignored, not the native `disabled`, so the button keeps the focus (amended 2026-10-16,
  PAGES — redesign-pages.md).
- [x] ENTRY-15 · component — An OAuth error in the URL (`?error=`) shows, at the top of the form, as an
  alert: «Ya existe una cuenta con este email. Inicia sesión con tu email y contraseña.» for
  `account_not_linked` and `unable_to_link_account`, and «Algo ha ido mal. Inténtalo de nuevo.» for any
  other code.
- [x] ENTRY-16 · component — With Google not configured, neither «o» nor the Google button is shown.
  No GitHub button is ever shown, on `/login` or `/register`.
- [x] ENTRY-17 · unit + component — After signing in, the user goes to `callbackUrl` only when it is a
  path on this site. Anything else, a backslash path included, sends them to `/`. The rule is the
  same for the email sign-in, the two-factor step and the Google sign-in. See the worked example.
- [x] ENTRY-18 · node — The app has no GitHub sign-in:
  - Better Auth has no GitHub provider;
  - the env schema has no GitHub variables;
  - no message key names GitHub.
- [x] ENTRY-19 · component — From 1440px wide `/login` shows the Storyset illustration beside the
  form, with the arrow. From 1024px to 1439px wide it shows the phone composition in one centred
  column instead, with no arrow (amended 2026-10-14, replacing the earlier reflow of the two columns
  with the arrow hidden: ENTRY-25). At phone width it shows the form directly on the page
  background, with no panel, no «o», and Google without its mark, and the illustration under the
  buttons, centred (amended 2026-10-14: ENTRY-27).

Both pages

- [x] ENTRY-20 · component — The browser title is «Buy Car Map» on `/` and «Entrar · Buy Car Map» on
  `/login`.
- [x] ENTRY-21 · e2e — `/` and `/login` pass the axe check at desktop and phone width (amends FRONT-19,
  which checked desktop only for these pages), and the illustrations load under the page's CSP.
- [x] ENTRY-22 · component — On submit, an empty or invalid field shows its error under the field:
  «El email es obligatorio», «Introduce un email válido», «La contraseña es obligatoria», each with
  the circle-alert icon, tied to the field by `aria-describedby` and `aria-invalid`; the border does
  not change and the password eye stays centred on the field. The same pattern applies to every
  password field. — now holds on every F7 password field (PAGES-6) (amended 2026-10-16, PAGES —
  redesign-pages.md). — each field error carries `role="alert"`, on `/login` too (amended
  2026-10-16, PAGES — redesign-pages.md).

Laptop width and the illustrations (added 2026-10-14)

Here "phone width" is under 1024px, "laptop width" is 1024px to 1439px and "desktop width" is
1440px and up. "Centred" means the horizontal centre of the element's rendered content is within
1px of the centre of the page's scrolling area (its client width, without the scrollbar); for a
text block, its content is the union of its rendered lines.

- [x] ENTRY-23 · e2e — At 1440×900, `/` shows the map preview «Ver el mapa» to the right of the
  search pill, and both arrows. At 1024×900 the map preview and both arrows are not displayed, and
  «Ver el mapa» is not in the accessibility tree. At 390×844 the phone map preview of ENTRY-7 is
  shown, as before.
- [x] ENTRY-24 · e2e — At 1024×900, on `/`:
  - the headline, the line, the search pill, the «Populares» row and the illustration are stacked in
    that order, and each is centred;
  - the footer's links row is centred, and its top is 24px (±1px) below the bottom of the
    illustration's drawn content (Contracts › Illustrations), as on the board. The same holds at
    1024×760 and 1024×700, where the illustration is also shown (ENTRY-29).

  (Amended 2026-10-15: the footer is measured against the drawn content, not the image's box; the
  earlier window of 20px above to 24px below the box's bottom goes.)
- [x] ENTRY-25 · e2e — At 1024×900, `/login` is one centred column 440px wide (±1px). It holds, top
  to bottom:
  - the headline and the line;
  - the form: «Email», «Contraseña» with «¿La olvidaste?», «Entrar»;
  - «Continuar con Google» when Google is configured;
  - «¿No tienes cuenta? Créala»;
  - the illustration, centred. The order is measured on its drawn content (Contracts ›
    Illustrations), not on the image's box, whose empty top band rises above «Créala» (amended
    2026-10-15: ENTRY-30).

  The form has no panel (no border and no background of its own), and no «o», no «Entrar» form title
  and no Google mark are displayed. The desktop header and the footer are shown. At 1440×900 the
  two columns stay: the headline wholly left of the panel, the panel with its border, «o» and the
  arrow displayed.
- [x] ENTRY-26 · e2e — The illustration is never cropped. On `/` at 1440×900, 1024×900, 1024×760 and
  1024×700, and on `/login` at 1440×900, 1024×900 and 390×844:
  - the image keeps the file's 3:2 proportions (width over height within 1% of 1.5), so its box is
    the file's whole viewBox and the drawn content's box can be derived from it (Contracts ›
    Illustrations);
  - with the page scrolled to its end, the drawn content's box lies wholly inside the viewport and
    inside the visible area of every ancestor whose `overflow` is not `visible`;
  - where the footer is shown, the drawn content's top is above the footer's top, and the drawn
    content's box overlaps none of the footer's links.

  At 1024×600 (amended 2026-10-15):
  - `/` does not scroll, and the illustration is absent. The page's scrolling area has a scroll
    height no greater than its client height, and no illustration image is displayed. The headline,
    the line, the search pill and the «Populares» row are centred. The footer's links row is
    centred, with its top 24px (±1px) below the bottom of the «Populares» row.
  - `/login` has no illustration, and its scroll does not exceed what the form needs. The form
    column alone is taller than the viewport, so the page scrolls. The page is no taller than the
    board's 655px (+1px), a scroll of at most 55px.

  (Amended 2026-10-15: the conditions apply to the drawn content, not to the image's empty bands,
  and the named footer-link exception on `/` at 1024×900 goes, because the drawn content now ends
  24px above the links. The earlier rule, that the page scrolls at 1024×600 to reach the whole
  illustration, goes too.)
- [x] ENTRY-27 · e2e — At 390×844 the `/login` illustration is centred and its drawn content starts below
  «¿No tienes cuenta? Créala» (amended 2026-10-15: measured on the drawn content, ENTRY-30).

Illustration size, gaps and the sign-in left block (added 2026-10-15)

"Drawn content" is the part of the illustration file that has ink, derived from the image's box and
the viewBox fractions in Contracts › Illustrations. "The room" is the height left for the drawn
content with the page not scrolling. It runs from the item above the illustration, plus the gap of
ENTRY-30, down to what sits below it. On `/` at laptop width, what sits below is the footer's links
row, less its 24px gap (ENTRY-24).

- [x] ENTRY-28 · e2e — At 1440×900 on `/login`, the left block is vertically centred as one group
  against the panel. The left block is the headline, the line and the illustration's drawn content,
  and the panel is the `<form>`'s parent. The centre of the union of their boxes is within 2px of
  the panel box's vertical centre. The illustration's drawn content is whole and its bottom is above
  the footer's top. The arrow is still displayed: its box's top lies within the «Guárdalo» line's
  box, and its tip ends left of the panel, within 32px of the panel's left edge. In the default
  state the tip is at the height of the «o» row (±8px). The arrow keeps the board's path in every
  state, so when the panel grows its tip stays where the default «o» is (amended 2026-10-15: the
  board ends the arrow short of the panel, so its box never overlaps the «o» row).
  - This holds in every state of the boards: the default form, the per-field errors, the credential
    and rate-limit alerts, the two-factor step and its error, signing in, and the OAuth error.
  - The e2e test covers at least the states reachable without a database: the default form, the
    per-field errors on an empty submit, and `?error=account_not_linked`.
- [x] ENTRY-29 · e2e — From 1024px wide, on `/` and `/login`, the illustration takes the room. It is
  drawn whole at the file's proportions, at the largest size that fits, and never wider than its
  cap:
  - `/` from 1024px to 1439px wide: 480px;
  - `/login` from 1024px to 1439px wide: 440px;
  - `/` from 1440px wide: 540px;
  - `/login` from 1440px wide: 620px.

  It never makes the page scroll. When the room holds less than 150px of drawn content height, the
  illustration is not displayed. Measured on `/` (the arithmetic is under Worked examples):
  - at 1024×600 it is not displayed (ENTRY-26);
  - at 1024×700 it is displayed. Its drawn content is at least 150px tall, the image is at most
    480px (+1px) wide, and the page does not scroll;
  - at 1024×760 it is displayed at its cap, 480px (±1px) wide, and the page does not scroll.

  At 1024×900 the image is at most 440px (+1px) wide on `/login` and at most 480px (+1px) on `/`.
  At 1440×900 it is at most 620px (+1px) wide on `/login` and at most 540px (+1px) on `/`.
- [x] ENTRY-30 · e2e — The gap from the item above the illustration to its drawn content's top is,
  within ±1px:
  - 30px below the «Populares» row on `/` at 1024×900, 1024×760 and 1024×700;
  - 24px below the «¿No tienes cuenta? Créala» line on `/login` at 1024×900 and at 390×844;
  - 30px below the line «Recibir alertas es gratis, regístrate y nos encargamos del resto.» on
    `/login` at 1440×900.

## Worked examples

**Landing search (ENTRY-3).**

| Chosen | Goes to (`/map` with these parameters, in any order) |
| --- | --- |
| Nothing | `/map` with no parameters |
| Dónde «Madrid» (50 km), Coche «Volkswagen» «Golf», Precio «Hasta 10.000 €» | `/map` with the Madrid place parameters (`lat`, `lng`, `placeId`, `locationName`), `radius=50`, `make=Volkswagen`, `model=Golf`, `maxPrice=10000` |
| Coche «BMW» only | `/map?make=BMW` |

The map then shows the segments «Madrid · 50 km», «Volkswagen Golf» and «Hasta 10.000 €».

**Popular cars (ENTRY-4).**

| Chip | Brand and model |
| --- | --- |
| «Golf» | `make=Volkswagen&model=Golf` |
| «SEAT León» | `make=Seat&model=León` |
| «BMW Serie 3» | `make=BMW&model=Serie 3` |
| «Audi A4» | `make=Audi&model=A4` |

Brands are spelt as the brand list spells them (`components/map/search-filter-options.ts`: «Seat»,
not «SEAT»). The model strings are confirmed against the models the brand's list returns during
implementation; one that does not exist is raised, not guessed.

**callbackUrl (ENTRY-17), security fix.**

| `callbackUrl` | Goes to |
| --- | --- |
| `/favorites` | `/favorites` |
| `/map?make=Toyota&radius=50` | `/map?make=Toyota&radius=50` |
| absent | `/` |
| `https://evil.example` | `/` |
| `//evil.example` | `/` |
| `/\evil.example` (sent as `/%5Cevil.example`) | `/` — this one is the bug: today it passes |
| `javascript:alert(1)` | `/` |
| `/.//evil.example` | `/` — bug found in review: the normalised path began with `//` |
| `/..//evil.example` | `/` — found in review |
| `/%2e//evil.example` | `/` — found in review |
| `/a/..//evil.example` | `/` — found in review |
| `/\t/evil.example` (a raw tab) | `/` — found in review |
| `/%2Fevil.example` (an encoded slash after the leading slash) | `/` — found in review |
| `/a/%2e%2e/%2fevil.example` (an encoded slash reached through a dot segment) | `/` — found in review |

**Login errors (ENTRY-11 to ENTRY-15).** All copy is the existing message text:
`auth.invalidCredentials`, `authErrors.rateLimited`, `authErrors.totpInvalid`,
`authErrors.oauthLinkBlocked`, `authErrors.generic`, `account.twoFactor.codeLabel` and
`account.twoFactor.recoveryHint`.

**Layout by viewport (ENTRY-23 to ENTRY-30), amended 2026-10-15.** The boards are
`docs/design/canvas/R3-landing.dc.html` and `R3-login.dc.html` (1440×900, 1024×900, 1024×600,
390×844). The 1024×760 and 1024×700 rows are not boards: they are derived from the 1024 boards'
numbers below.

| Viewport | `/` | `/login` |
| --- | --- | --- |
| 1440×900 | Two columns: the search on the left, the map preview on the right, both arrows, the illustration whole behind the left column, at most 540px wide; footer at the bottom right | Two columns: headline left, panel right, «o» and the arrow from the «Guárdalo» line to the «o». The left block (headline, line and the illustration's drawn content, 30px below the line) is centred as one group on the panel's vertical centre (board: group 223–697.1px, panel centre 460px), in every state. The illustration is whole, at most 620px wide, and above the footer |
| 1439×900 | As 1024×900 (under 1440) | As 1024×900 (under 1440) |
| 1024×900 | One centred column: headline, line, pill, «Populares», illustration 480px wide with its drawn content 30px below «Populares»; no map preview, no arrows; footer links centred, their top 24px below the drawn content's bottom | One centred 440px column: headline, line, form with no panel, Google, «Créala», illustration centred, at most 440px wide, its drawn content 24px below «Créala»; no «o», no form title, no Google mark, no arrow; desktop header and footer |
| 1024×760 | The same column; the room (273px) is above the cap, so the illustration is 480px wide and the column is centred in the leftover height; no scroll | — |
| 1024×700 | The same column; the room (213px) is under the cap, so the illustration takes it whole: drawn content about 213px tall, about 469px wide; no scroll | — |
| 1024×600 | No illustration: the room (113px) is under 150px. Headline, line, pill and «Populares» centred, footer links centred 24px below «Populares» (board: content 151.5–488.5px, footer 512.5–528.5px); no scroll | No illustration. The form column alone is 613px tall with its padding («Créala» ends at 595px), so the page is 655px tall and scrolls 55px, for the form only |
| 390×844 | Phone layout of ENTRY-5 and ENTRY-7: the phone map preview, no illustration, no footer | Phone layout of ENTRY-19: the illustration whole and centred, its drawn content 24px below «Créala»; no footer; the page may scroll |

**Room and the 150px minimum on `/` at 1024px wide (ENTRY-29), from the boards.**
- The header is 80px, so the body is the viewport height H less 80px.
- Without the illustration, the 1024×600 board centres a 377px stack in its 520px body: content
  151.5–488.5px (337px), 24px, footer 512.5–528.5px (16px). (520 − 377) / 2 = 71.5, and 80 + 71.5
  = 151.5.
- With the illustration, the stack is 337 + 30 + drawn content + 24 + 16. So the room is
  H − 80 − 407 = H − 487.
- The cap: 480px wide is 320px tall at 3:2, and the drawn content is 0.681 of that height
  ((440.8 − 100.3) / 500), so 217.9px.

| H | Room H − 487 | Result |
| --- | --- | --- |
| 600 | 113px | under 150px: not displayed (the board's note says the same) |
| 636 | 149px | under 150px: not displayed |
| 637 | 150px | displayed: the threshold |
| 700 | 213px | displayed below the cap. Drawn content 213px tall; image 213 / 0.681 = 312.8px tall and 469.2px wide; no leftover, so the footer row ends at 700px |
| 760 | 273px | displayed at the cap, 480 × 320px with 217.9px drawn. 55.1px leftover, centred: «Populares» ends at 444.5px, drawn content 474.5–692.5px, footer row 716.5–732.5px |
| 900 | 413px | displayed at the cap. 195.1px leftover, centred: «Populares» ends at 514.5px, drawn content 544.5–762.5px, footer row 786.5–802.5px |

These positions assume the content block is 337px tall, as on the board. The tests assert the
outcome at each viewport (shown or not, at the cap or not, no scroll, the gaps), not the absolute
positions. 700 and 760 sit 63px and 123px above the 637px threshold, so a few pixels of font
difference does not flip them. In the code the footer links row is 24px tall, not the board's
16px, because each link keeps a 24px hit target (`RULES.md` §19); that moves the threshold to
645px and leaves the 600, 700 and 760 results unchanged. The boards do not state the gap from the drawn content's bottom to
the footer on the `/login` laptop boards, so `/login`'s threshold height cannot be derived from
them. `/login` is measured at 1024×600 (not displayed) and 1024×900 (displayed) only.

Centring, worked: at 1024px wide, with a 15px scrollbar on the page's scrolling area, its client
width is 1009px and its centre is at 504.5px; an element is centred when its content's centre is
between 503.5px and 505.5px. With no scrollbar, the centre is at 512px.

**ENTRY-31 (bug fix)** — signed in at phone width on `/`, scrolled to the end: before the fix the
last element's bottom was at 812px while the tab bar's top was at 747px, so it sat under the bar.
Correct result: the last element's bottom is at or above the tab bar's top (≤ 747px at that
viewport).

## Data model

No change. There is no Prisma model, migration or seed change.

GitHub removal touches configuration, not data. The env variables `GITHUB_ID` and `GITHUB_SECRET` leave
the env schema and `.env.example`, and must be deleted from Vercel by hand. No GitHub accounts exist
(owner, 2026-10-14), so none is stranded; the account page lists only Google.

## Permissions

- Both pages are public.
- A signed-in visit to `/login` is still redirected to `/` by `proxy.ts` (unchanged).
- The signed-in landing differs only in its header and tab bar (ENTRY-8). It reads the session for
  display, not for authorization.
- Sign-in keeps every server-side rule of AUTH and BAUTH unchanged:
  - our own sign-in action;
  - enumeration-resistant responses;
  - two-factor never bypassed;
  - the rate limits.

ENTRY-17 narrows where a signed-in user can be sent; it grants nothing.

## Edge cases

- **No match in a landing popover:** the same no-match messages as the map (MAPUI-56), including the
  place search being down.
- **An invalid price typed on the landing:** the same rules as the map's boxes (MAPUI-11, MAPUI-14).
- **A popular car whose model the list does not return:** raised during implementation (Worked
  examples).
- **Wrong password, then right one:** the alert goes away when the next attempt starts (ENTRY-11).
- **Two-factor rate limit:** the rate-limit alert of ENTRY-12.
- **A recovery code:** accepted in the same field (ENTRY-13).
- **An OAuth error with an unknown code:** the generic message (ENTRY-15).
- **An OAuth error in the URL, then a sign-in attempt:** the OAuth alert clears when the attempt
  starts, so only one alert shows at a time (ENTRY-15).
- **After a successful sign-in:** «Entrar» stays disabled while the page redirects (ENTRY-14).
- **Google not configured:** no «o» and no button (ENTRY-16).
- **Hostile `callbackUrl`:** `/` (ENTRY-17), for every route listed in its worked example.
- **Long typed values and a long email:** the fields scroll their text; the form does not widen.
- **A screen too short for the content** (amended 2026-10-15): the illustration shrinks to the
  room, keeping its proportions, and never makes the page scroll (ENTRY-29).
  - When the room holds less than 150px of drawn content, the illustration is not shown (ENTRY-29).
  - The page scrolls only when the content without the illustration does not fit, as `/login`'s
    form does at 1024×600 (ENTRY-26).
  - The illustration is never cut by the bottom edge or by a band (ENTRY-26).
- **A tall laptop screen:** the illustration stops growing at its cap, and the column is centred in
  the leftover height (ENTRY-29, the 1024×760 and 1024×900 rows of the layout table).
- **A sign-in state that makes the panel taller** (an alert, the per-field errors, the two-factor
  step): at desktop width the left block stays centred on the panel's new vertical centre
  (ENTRY-28).
- **The phone:** the room rule of ENTRY-29 starts at 1024px, so the phone illustration is not
  sized to the room. It sits under «Créala» (ENTRY-27, ENTRY-30), and the page may scroll to reach
  it, as before.
- **Exactly 1440px wide:** the desktop layout; 1439px is laptop (ENTRY-23, ENTRY-25).
- **Signed-out heart, «Crear alerta» and other sign-in redirects:** they land on `/login` with their
  `callbackUrl` and return to it, query included (MAPUI-37, kept, now bound by ENTRY-17).

## Out of scope

- `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/confirm-email`, `/account`
  and the legal pages (F7). F4 only changes them where a shared piece is restyled:
  - the Google button;
  - the password field's show/hide button;
  - the GitHub button's removal.

  Their own layouts, the brand block and the legal notice stay until F7. `/register` has no
  illustration yet. When F7 gives it one (`docs/design/canvas/F0-registro.dc.html`), the rules of
  ENTRY-26 and ENTRY-29 apply to it, as the design system states (`docs/design/system/README.md` ›
  Ilustraciones y flechas › Sitio). At desktop width, its left block (headline, line and the
  illustration's drawn content) is centred as one group on the form's vertical centre, as ENTRY-28
  states for `/login`. That is the desktop board (amended 2026-10-15).
- A live map or real listings on the landing (owner decision: a fixed illustration).
- Signed-in redirect to `callbackUrl` from `/login` (the proxy keeps sending to `/`).
- The emails (#123).
- Keyboard, screen-reader and real-iPhone checks beyond axe ([#127](https://github.com/algusaem/buycarmap/issues/127)).

## Contracts

**Landing to map.**
- The landing builds the map URL with the map's own URL-state parsers (`lib/search/url-state.ts`), so
  the parameters are exactly those the map reads.
- `?q=` is still parsed by the map for old links. Nothing in the app produces it anymore.

**Shared pieces.**
- The landing reuses the map's search popovers and the phone «BUSCAR» sheet (`components/map/search/*`,
  `components/map/phone/SearchSheet.tsx`). It uses them with a held draft and a navigation in place of
  an applied search.
- The Google button and the password field are restyled once and used by `/login` and `/register`.

**Illustrations.**
- `vehicle-sale-lime.svg` (landing) and `by-my-car-lime.svg` (sign in) are served as same-origin
  images.
- The arrows are decorative inline SVG coloured from the theme, hidden from assistive technology,
  from 1440px wide only (amended 2026-10-14).
- The illustration is drawn whole, ground line included, above the footer row, at every width
  (ENTRY-26).
- Both files have a 750×500 viewBox, and their drawn content does not fill it (amended 2026-10-15).
  Gaps, the footer and the room are measured to the drawn content, so the files' empty bands add no
  visible gap.

  | File | Drawn content in the viewBox | As fractions of the image's box (left, right of the width; top, bottom of the height) |
  | --- | --- | --- |
  | `vehicle-sale-lime.svg` | x 51.7–698.3, y 100.3–440.8 | left 0.0689, right 0.9311; top 0.2006, bottom 0.8816 (drawn height 0.681 of the box) |
  | `by-my-car-lime.svg` | x 41.2–708.8, y 121.5–454.3 | left 0.0549, right 0.9451; top 0.2430, bottom 0.9086 (drawn height 0.6656 of the box) |

  For an image box at (x, y) of width w and height h, the drawn content's box runs from
  x + left·w to x + right·w, and from y + top·h to y + bottom·h. The box is the whole viewBox
  because the image keeps the file's 3:2 proportions (ENTRY-26). Each fraction is the viewBox
  coordinate over 750 or 500.
- Size caps, by image width (ENTRY-29):
  - `/` at laptop width: 480px (217.9px drawn);
  - `/login` at laptop width: 440px (195.2px drawn);
  - `/` from 1440px: 540px (245.2px drawn);
  - `/login` from 1440px: 620px (275.1px drawn).

  The minimum is 150px of drawn height: about 330px wide for `vehicle-sale-lime.svg` and 338px for
  `by-my-car-lime.svg`. Below it the image is not displayed.
- The footer's Storyset credit stays (LOOK-16).

**Surface briefs.** `/`'s and `/login`'s Impeccable briefs are
[`.impeccable/surfaces/landing.md`](../../.impeccable/surfaces/landing.md) and
[`.impeccable/surfaces/login.md`](../../.impeccable/surfaces/login.md) (`STACK.md` §17).

**i18n keys**, both locales:
- new or changed `hero.*` and `auth.*` keys for the copy above;
- `auth.signingIn` is no longer shown, because the label stays «Entrar»;
- `common.popular` loses its colon;
- `auth.continueWithGithub` and the other GitHub keys are removed;
- `authErrors.emailRequired` and `authErrors.emailInvalid`, new Spanish copy for the empty and
  invalid email cases (ENTRY-22).

English copy is drafted with the implementation and reviewed in the pull request.

**Criteria amended** (in the same change):
- HEAD-7, for the signed-in phone landing (ENTRY-8);
- MAPUI-52, which adds the signed-in landing to the tab bar routes;
- MAPUI-18's «until F4» notes, to read: still parsed, no longer produced;
- FRONT-19 (ENTRY-21);
- FRONT-23: its e2e trigger moves from the sign-in toast, which no longer exists, to the «Alerta
  creada» toast on `/map`, which runs in the DB suite;
- TEST-15: the login baseline is regenerated;
- the AUTH prose on `OAuthButtons` and on GitHub;
- BAUTH-6 and BAUTH-8 (`docs/specs/core-better-auth.md`), FRONT-27 (`docs/specs/core-frontend.md`)
  and DOCS-8 (`docs/specs/core-docs.md`), for the GitHub removal review round;
- BAUTH-10 (`docs/specs/core-better-auth.md`), the `ConnectedAccounts` criterion: the account page
  lists only Google;
- MAP-18 (`docs/specs/map-and-search.md`), for model matching that ignores case and accents;
- SRC-7 (`docs/specs/data-sources.md`), same amendment.

## Decisions and rationale

- **Inline errors, not toasts.**
  - `STACK.md` §14 says never a toast for a validation error, and to map server errors to the form.
  - A toast that vanishes after four seconds leaves someone who looked away with no idea why they are
    still on the page.
  - The rate-limit message joins it, so every sign-in failure is in one place.
- **The landing search navigates; it does not search.** The landing has no results to show, so the
  popovers hold a draft and «Buscar» hands it to the map. The phone sheet's «Ver coches» does the
  same. This reuses the map's controls, rather than building a second set that would drift.
- **No `?q=` from the landing.** Free text is the one filter the map only half applies (MAPUI-18).
  The design draws structured segments. Old links keep working.
- **Popular cars as brand and model.** They become real filters that every source understands, not
  free text.
- **The map preview is a picture.** A live map on the landing would load the map library and query
  the sources before the visitor asks for anything (owner decision, 2026-10-14). Its example prices
  are illustrative, as the design states.
- **The tab bar on the signed-in landing.** Every other signed-in page has it. The landing without
  it was the one exception, recorded as temporary «until F4» (owner decision, 2026-10-14).
- **The phone keeps recovery and register links.** The board left them out. Without them, a phone
  user who forgot their password, or has no account, has no way forward from `/login`. The design
  was amended to add them (accepted 2026-10-14).
- **The callbackUrl fix ships here** (owner approval, 2026-10-14). F4 rewrites the form that applies
  the rule, and the backslash case is a live open redirect. The rule checks that the target resolves
  to this site's own origin, rather than pattern-matching the string, which is how the backslash slipped
  through.
- **GitHub removed.** The product never offers GitHub sign-in (owner decision, standing). Keeping
  the provider wired «if configured» kept a dead path, its env variables, and a button that could
  reappear.
- **No `loading.tsx` or `error.tsx` for `/` and `/login`.** Both render without reading data on the
  server, so there is no wait to cover and no read to fail. A failing sign-in is handled inside the
  form (ENTRY-11 to ENTRY-15).
- **Per-field errors on submit, «email» in the copy.** The per-field error design and the «email»
  wording were accepted by the owner (2026-10-14, «si, acepto»; «en los errores es mejor email»).
- **Model matching ignores case and accents.** The owner's words were «SEAT León y SEAT Leon y Seat
  Leon y seaT LeON» should all match. A live probe found coches.net «León» and Wallapop «Leon», and
  Wallapop returns the same cars for either. This amends MAP-18 and SRC-7.
- **Whole illustrations, one column under 1440px** (amended 2026-10-14, owner accepted the design
  fix). The owner rejected illustrations cropped by the bottom edge or by a band, and the two-column
  layouts at laptop width. Under 1440px the landing drops the map preview and centres its content,
  and `/login` takes the phone composition in a centred 440px column (the 1024×900 boards). This
  replaces the earlier reflow with the arrows hidden (ENTRY-1, ENTRY-7 and ENTRY-19 amended;
  ENTRY-23 to ENTRY-27 added).
- **The illustration fits the height, or it goes** (2026-10-15; the owner accepted the design fix:
  «están perfectas ahora»). The owner rejected two things in the 2026-10-14 result:
  - the page scrolling at 1024×600 just to reach the illustration;
  - the left block sitting low on the 1440 sign-in page.

  From 1024px the illustration takes the height left between the content and the footer, up to a
  cap. When less than 150px of drawing fits, it is dropped rather than shrunk to a smudge or pushed
  below the fold. Gaps are measured to the drawn content, because the files' empty top and bottom
  bands made the visible gaps differ from the boxes. On the 1440 sign-in page, the headline, line
  and illustration are centred as one group on the panel. `/login` at 1024×600 still scrolls 55px,
  because the form alone does not fit, and the owner accepted that. ENTRY-24 and ENTRY-26 are
  amended, and ENTRY-28 to ENTRY-30 added.
