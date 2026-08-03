# Spec: Cross-cutting — language, geography, theme

Key: CORE
Status: Implemented
Last updated: 2026-08-02.

> **This is a backfill**, and the smallest of the four waves. The gap I expected
> to find here — locale files drifting apart — does not exist: both `en.ts` and
> `es.ts` are typed `: Translations`, so a missing key fails the build. That is
> recorded in §5 rather than as a criterion, because a test for it would only
> re-assert what the compiler already refuses to let through.

---

## 1. Problem

Three things run underneath every page and are noticed only when wrong: what
language the interface is in, where on the map a car without coordinates
belongs, and whether the page is readable at night. Each has a fallback chain
several steps deep, each chain has a step that is hard to reach on purpose, and
between them they had almost no tests.

## 2. Scope

**In scope.** Locale resolution and switching; the static city and province
lookups that place listings without coordinates; browser geolocation; theme
switching.

**Out of scope, deliberately:**

- **Nominatim geocoding for the location search box.** Already covered by
  `lib/geo/nominatim.test.ts` and by the `LocationSearch` component tests in
  Wave A.
- **Email copy and templates.** Covered in Wave C.
- **The UI primitives** (`components/ui/*`). `button`, `card`, `input`, `label`
  and `separator` are styling wrappers with no branches worth asserting;
  `range-input`, `toggle-chip` and `select` have behaviour and are already
  tested.
- **`useThemeTransition`.** It drives the View Transitions API, which jsdom does
  not implement. Asserting the fallback path would test the stub, not the
  feature. Playwright is where this belongs, if anywhere.

## 3. Acceptance criteria

| AC | Statement | Level | Verified by |
| --- | --- | --- | --- |
| CORE-1 | An explicit language choice wins over the browser's preference | unit | `lib/i18n/server.node.test.ts` |
| CORE-2 | With no choice made, the browser's preferred language is used if it is one we support | unit | `lib/i18n/server.node.test.ts` (supported + q-order) |
| CORE-3 | With neither, the interface is Spanish | unit | `lib/i18n/server.node.test.ts` |
| CORE-4 | A language cookie holding an unsupported or malformed value is ignored, not trusted | unit | `lib/i18n/server.node.test.ts` (unsupported + malformed) |
| CORE-5 | Choosing a language persists the choice and re-renders the page in it | component | `components/LanguageSwitcher.test.tsx` |
| CORE-6 | A listing's city resolves to coordinates regardless of case or surrounding whitespace | unit | `lib/geo/cities.test.ts` |
| CORE-7 | A city we do not know falls back to the coordinates the caller supplied, never to a wrong city | unit | `lib/geo/cities.test.ts` |
| CORE-8 | The browser is asked for the user's position at most once per session, however many searches run | unit | `lib/geo/user-location.test.ts` |
| CORE-9 | A denied or unavailable position resolves rather than leaving callers waiting | unit | `lib/geo/user-location.test.ts` |
| CORE-10 | Switching the theme changes it, and the choice survives a re-render | component | `components/ThemeSwitcher.test.tsx` + `e2e/theme.spec.ts` |

## 4. Decisions and rationale

### Spanish is the default, and the fallback order encodes who is being served

Cookie, then `Accept-Language`, then Spanish. The last step is the opinionated
one: this aggregates Spanish marketplaces for cars physically located in Spain,
so a visitor whose browser announces Japanese is far more likely to be a Spanish
speaker with an odd browser configuration than an actual Japanese speaker. An
English default would have been the reflex choice and the wrong one.

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
hanging behind a permission dialog the user ignored.

### Unknown cities fall back to the caller's coordinates, not to a guess

`getCityCoordinates` takes the fallback as an argument rather than defaulting
internally. Each source knows something different about where it is: Wallapop
supplies real coordinates and only needs the lookup when they are missing, while
coches.net can offer a province capital. Picking a wrong city would put a pin
somewhere specific and confidently incorrect, which is worse than a coarse one —
a user driving to see a car trusts the pin.

## 5. Data and contracts

- **`LOCALES`, `DEFAULT_LOCALE`, `COOKIE_NAME`** in `lib/i18n/config.ts`. Adding
  a locale means a new file, a `LOCALES` entry, and every key in `Translations`.
- **Key parity between locales is enforced by the type system, not by a test.**
  `en.ts` and `es.ts` are both declared `: Translations`, so a missing or
  misspelled key is a build failure. This is why no criterion covers it: the
  test would assert something the compiler will not let you commit.
- **`SPANISH_CITIES`** in `lib/geo/cities.ts` — roughly seventy cities keyed by
  lowercased name. Coarse by design; it exists for listings whose seller gave a
  city and nothing more.
- **Theme** is `next-themes` with `attribute="class"`, dark default, `.light`
  for light. Anything reading `useTheme` must wait for `useMounted` or it
  renders server markup that disagrees with the client.

## 6. Open questions

1. ~~`useThemeTransition` is untested and will stay that way~~ **Closed.**
   `e2e/theme.spec.ts` runs the real hook in a browser: it toggles, asserts the
   `.light` class, and checks the choice survives a reload. The component test
   still stubs the hook, because jsdom implements no View Transitions API.
   Original note: until there is a
   reason to drive it in Playwright. It is a progressive enhancement over
   `setTheme`, so its failure mode is a theme change without the animation.
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
