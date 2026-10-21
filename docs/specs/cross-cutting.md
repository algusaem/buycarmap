# Cross-cutting — language, geography, theme

Key: CORE
Status: Implemented
Last updated: 2026-10-21

---

## Problem

Two things run underneath every page and are noticed only when wrong: what
language the interface is in, and where on the map a car without coordinates
belongs. (A third, whether the page is readable at night, was a theme switch
until the dark-only redesign of 2026-10-12.) Each has a fallback chain
several steps deep, each chain has a step that is hard to reach on purpose, and
between them they had almost no tests.

In scope: locale resolution and switching; the static city and province
lookups that place listings without coordinates; browser geolocation. Theme
switching was in scope until 2026-10-12, when the dark-only BuyCarMap 2.0 design
removed it (`docs/specs/redesign-foundation.md`, LOOK-5).

## Acceptance criteria

- [x] CORE-1 · unit — An explicit language choice wins over the browser's preference
- [x] CORE-2 · unit — With no choice made, the browser's preferred language is used if it is one we support
- [x] CORE-3 · unit — With neither, the interface is Spanish
- [x] CORE-4 · unit — A language cookie holding an unsupported or malformed value is ignored, not trusted
- [x] CORE-5 · component — Choosing a language persists the choice and re-renders the page in it
- [x] CORE-6 · unit — A listing's city resolves to coordinates regardless of case or surrounding whitespace
- [x] CORE-7 · unit — A city we do not know falls back to the coordinates the caller supplied, never to a wrong city
- [x] CORE-8 · unit — The browser is asked for the user's position at most once per session, however many searches run
- [x] CORE-9 · unit — A denied or unavailable position resolves rather than leaving callers waiting
- [x] CORE-10 · component — Withdrawn 2026-10-12 (docs/specs/redesign-foundation.md, LOOK-5): there is no theme to switch — the approved BuyCarMap 2.0 design is dark only, and next-themes, the toggle and this criterion's test go with it. `spec:check` only requires that some test title still *mentions* the id (`checkDeclaredCriteria`) and that the id stays declared here so a test mentioning it is not flagged as a dangling reference (`checkDanglingReferences`) — `scripts/core-frontend.node.test.ts`'s own LOOK-5 tests, which check that this line says "Withdrawn" and that no test *claims* CORE-10 any more, satisfy the first without re-adding a behavioural test for the second.

## Worked examples

None: no criterion here is on the critical list (a permission boundary, or a bug fix), and none carries an exact value.

## Data model

None: this feature adds or changes no table or column.

## Permissions

None: locale and geography carry no authorization check and store no
user data here; the language cookie is user-writable input, which CORE-4 treats
as untrusted.

## Edge cases

- CORE-3 — neither a choice nor a supported browser language; the interface is Spanish.
- CORE-4 — an unsupported or malformed language cookie is ignored.
- CORE-7 — an unknown city falls back to the caller's coordinates.
- CORE-8 — concurrent searches ask the browser for a position at most once.
- CORE-9 — a denied or unavailable position still resolves.
- A request with no cookie or `Accept-Language` (the alert runner): see Decisions › Spanish is the default, and the fallback order encodes who is being served.
- A tampered cookie: see Decisions › An unrecognised cookie value is discarded rather than repaired.
- A denied permission prompt: see Decisions › Geolocation is requested once and shared.

## Out of scope

Out of scope, deliberately:

- **Nominatim geocoding for the location search box.** Already covered by
  `lib/geo/nominatim.test.ts` and by the place field's component tests in
  `components/map/search/LocationPopover.test.tsx`.
- **Email copy and templates.** Covered in Wave C.
- **The UI primitives** (`components/ui/*`). `button`, `input`, `label` and
  `separator` are styling wrappers with no branches worth asserting (`card` removed 2026-10-16,
  PAGES — redesign-pages.md: no caller left);
  `toggle-chip` has behaviour and is already tested.
- **Theme transitions.** There are none: the app has one dark theme, and the
  hook that animated a theme change is removed (Open questions 1).

## Contracts

- **`LOCALES`, `DEFAULT_LOCALE`, `COOKIE_NAME`** in `lib/i18n/config.ts`. Adding
  a locale means a new file, a `LOCALES` entry, and every key in `Translations`.
- **Key parity between locales is enforced by the type system, not by a test.**
  `en.ts` and `es.ts` are both declared `: Translations`, so a missing or
  misspelled key is a build failure. This is why no criterion covers it: the
  test would assert something the compiler will not let you commit.
- **`SPANISH_CITIES`** in `lib/geo/cities.ts` — roughly seventy cities keyed by
  lowercased name. Coarse by design; it exists for listings whose seller gave a
  city and nothing more.
- **`SPAIN_CENTER`** in `lib/geo/cities.ts` — where `lib/cochesnet/geo.ts` and
  `lib/milanuncios/geo.ts` pin a listing whose location neither the city nor
  the province lookup recognised. It is exported rather than declared in each
  because `lib/geo/radius.ts` compares against it *exactly* to exclude unknown
  locations from a radius search: the three have to agree on the point or that
  exclusion silently stops working. The behaviour itself is MAP-17's, in
  [map-and-search.md](map-and-search.md).

## Decisions and rationale

### About this spec

> **This is a backfill**, and the smallest of the four waves. The gap I expected
> to find here — locale files drifting apart — does not exist: both `en.ts` and
> `es.ts` are typed `: Translations`, so a missing key fails the build. That is
> recorded in Contracts rather than as a criterion, because a test for it would only
> re-assert what the compiler already refuses to let through.

### Spanish is the default, and the fallback order encodes who is being served

Cookie, then `Accept-Language`, then Spanish. The last step is the opinionated
one: this aggregates Spanish marketplaces for cars physically located in Spain,
so a visitor whose browser announces Japanese is far more likely to be a Spanish
speaker with an odd browser configuration than an actual Japanese speaker. An
English default would have been the reflex choice and the wrong one.

**That chain needs a request, and one path has none.** The alert runner is a
cron: no cookie, no `Accept-Language`, so it would fall straight to Spanish for
everyone. It reads `User.locale` instead — a stored copy of what the language
switcher last chose. The switcher writing that column, and what happens when it
is null, belong to [`alerts.md`](alerts.md) rather than being restated here.

### An unrecognised cookie value is discarded rather than repaired

`isValidLocale` gates the cookie before it is used. The cookie is user-writable,
so treating its contents as a key into the translations map is how you get an
undefined lookup rendering as blank UI, or worse. Falling through to the next
step in the chain means a tampered cookie degrades to the default rather than
breaking the page.

### Geolocation is requested once and shared

`initUserGeolocation` guards on a module-level `pending` promise, so concurrent
callers await the same request instead of triggering several permission prompts.
The promise resolves on *failure* as well as success — a denied prompt has to
unblock every waiter, because the search that depends on it must still run with
the country-wide fallback. A rejecting promise would have left the first search
hanging behind a permission dialog the user ignored. The position it exposes
is rounded to two decimals before anything reads it
([map-and-search.md](map-and-search.md), MAP-35). Once the user makes a
location choice, the module forgets the position and asks the browser no
more until the page is reloaded ([map-and-search.md](map-and-search.md), MAP-37).

### Unknown cities fall back to the caller's coordinates, not to a guess

`getCityCoordinates` takes the fallback as an argument rather than defaulting
internally. Each source knows something different about where it is: Wallapop
supplies real coordinates and only needs the lookup when they are missing, while
coches.net can offer a province capital. Picking a wrong city would put a pin
somewhere specific and confidently incorrect, which is worse than a coarse one —
a user driving to see a car trusts the pin.

## Open questions

1. ~~`useThemeTransition` is untested and will stay that way~~ **Closed, then moot.**
   The theme toggle and `useThemeTransition` are removed with CORE-10's withdrawal
   (2026-10-12, LOOK — redesign-foundation.md): the app is dark only, so there is no
   theme change to animate and the browser test that drove the hook is gone.
2. **Decided: no fallback counter.** The city list is unversioned and
   hand-maintained, and nothing detects a town missing from it. Adding a "how
   often did we fall back?" metric is a monitoring question, and this project
   has no metrics pipeline to put it in — building one for a single counter
   would be the larger mistake. Revisit if pins start looking wrong. Original
   note: Nothing detects a city
   that is missing from it, so a listing in an unlisted town silently lands on
   the province or country centre. Adding a "how often did we fall back?"
   counter would tell us whether the list needs extending — not specified here
   because it is a monitoring question, not a behaviour.
