# Spec: Favorites

Key: FAV
Status: Implemented
Last updated: 2026-08-02.

---

## 1. Problem

Someone searching for a car looks at dozens of listings across three sites and
has no way to keep the ones worth a second look. Today the heart on a listing
card fills in and does nothing else: it is component state, so it resets on
navigation, on reload, and on the next search. The user's shortlist lives in
open browser tabs or not at all.

This matters more here than in a normal marketplace because the listings are
not ours. They come from Wallapop, coches.net and Milanuncios, they are not
stored anywhere, and a search from a different location or with different
filters will not return the same set. A listing seen once and not saved is
genuinely hard to find again.

## 2. Scope

**In scope.** Saving and unsaving a listing while signed in; the saved set
surviving reloads and new sessions; a page that lists what was saved; the
signed-out and failure behaviours of the control.

**Out of scope, deliberately:**

- **Saved searches and notifications.** Adjacent and often assumed to come
  with favorites, but a different feature — that one is about criteria, this
  one is about specific listings.
- **Detecting that a saved listing has been sold or delisted.** Requires
  re-fetching each listing from its source on every page view; see the snapshot
  decision in §4 for why that is not free.
- **Favorites for signed-out visitors**, stored locally and merged on sign-in.
  See FAV-12 and the first open question.
- **Sorting, filtering, or paginating the favorites page.** Revisit when a real
  user has more than a screenful.

## 3. Acceptance criteria

| AC | Statement | Level | Verified by |
| --- | --- | --- | --- |
| FAV-1 | Saving a listing while signed in records it against that user, and it is still there on the next request | node + e2e | `app/actions/favorites.node.test.ts` + `components/map/CarListingCard.test.tsx` + `e2e/favorites.spec.ts` |
| FAV-2 | Saving a listing that is already saved leaves exactly one record and reports success | node | `app/actions/favorites.node.test.ts` |
| FAV-3 | Unsaving a listing removes it, and the user’s other saved listings are untouched | node + e2e | `app/actions/favorites.node.test.ts` + `e2e/favorites.spec.ts` |
| FAV-4 | Unsaving a listing that was never saved reports success rather than an error | node | `app/actions/favorites.node.test.ts` |
| FAV-5 | A caller with no session cannot save or unsave anything, and nothing is written | node | `app/actions/favorites.node.test.ts` (save, remove, list) |
| FAV-6 | A user cannot unsave a listing saved by a different user | node | `app/actions/favorites.node.test.ts` |
| FAV-7 | A save with a blank listing id, an unknown source, or a missing title is rejected with an error code and writes nothing | node | `app/actions/favorites.node.test.ts` (three cases) |
| FAV-8 | Listing favorites returns only the caller’s own, newest first | node + e2e | `app/actions/favorites.node.test.ts` + `e2e/favorites.spec.ts` |
| FAV-9 | A card for an already-saved listing renders in the saved state on first paint, without waiting for a request | component | `components/map/CarListingCard.test.tsx` |
| FAV-10 | Toggling the control updates it immediately, before the server has responded | component | `components/map/CarListingCard.test.tsx` |
| FAV-11 | When the save fails, the control returns to its previous state and the failure is surfaced as a toast | component | `components/map/CarListingCard.test.tsx` (failure + throw) |
| FAV-12 | For a signed-out visitor the control leads to sign-in, and returns to where they were afterwards | component | `components/map/CarListingCard.test.tsx` |
| FAV-13 | The favorites page renders each saved listing from stored data, with no request to any source API | component | `components/favorites/FavoritesList.test.tsx` |
| FAV-14 | With nothing saved, the favorites page shows an empty state offering a way back to search | component | `components/favorites/FavoritesList.test.tsx` |
| FAV-15 | Visiting the favorites page without a session redirects to sign-in, carrying the intended path | node | `proxy.node.test.ts` |
| FAV-16 | A listing the user has already saved appears saved in search results, not just on the favorites page | component + e2e | `lib/hooks/useFavorites.test.tsx` + `components/map/MapView.test.tsx` + `components/map/CarListingCard.test.tsx` + `e2e/favorites.spec.ts` |
| FAV-17 | A signed-in user can reach their saved cars from anywhere in the app | component | `components/Navbar.test.tsx` |
| FAV-18 | A click while the session is still resolving never navigates the user away, and never reports the listing as saved | component | `components/map/CarListingCard.test.tsx` |

Seventeen criteria: eight on the server boundary, eight on rendering and
interaction, one on routing. No criterion is `e2e`-only — `e2e/favorites.spec.ts`
re-proves four of them (FAV-1, FAV-3, FAV-8, FAV-16) against real Postgres
rather than adding criteria of its own, because what the browser adds there is
durability, not new behaviour. See the second open question for why that suite
had to exist at all.

## 4. Decisions and rationale

### Store a snapshot of the listing, not a reference to it

The obvious model is a join row: user id, source, source listing id. It does not
work here. Nothing in this codebase persists listings, and none of the three
source clients can fetch a single listing by id — `lib/wallapop/client.ts`,
`lib/cochesnet/client.ts` and `lib/milanuncios/client.ts` expose search only.
A reference-only favorite would therefore have nothing to render: opening the
favorites page would show a list of ids.

So a `Favorite` row carries the fields the card needs — title, price, image,
mileage, year, fuel, location, source, coordinates, outbound URL — copied at the
moment of saving.

The cost is honest and worth stating: **the snapshot goes stale.** A car whose
price drops, or that sells, will keep showing the saved price until the user
follows the link. The alternative — re-fetching every saved listing when the
page opens — turns one page view into N upstream calls against APIs that are
reverse-engineered, rate-limited, and already known to fail intermittently
(which is why `useListingsSearch` uses `Promise.allSettled`). Trading freshness
for a page that always renders is the right way round; a favorites page that is
blank because Wallapop is having a bad afternoon is worse than one showing
last week's price.

### Identity is the normalized listing id

`lib/*/normalize.ts` already produces source-prefixed ids — `wallapop-abc123`,
`cochesnet-99`, `milanuncios-7`. They are stable for as long as the listing
exists and are already unique across sources, so they are the natural key. A
unique index on `(userId, listingId)` is what makes FAV-2 true in the database
rather than in application logic, which matters because the control is a toggle
a user can click twice in a second.

### Search results have to be reconciled against saved listings

FAV-9 says an already-saved listing renders saved, and it was true of the card
in isolation while being false everywhere it actually mattered: `MapView`
rendered every card without `isFavorite`, so a car you had saved came back from
a search looking unsaved. The component test passed because it supplied the prop
the application never did.

The sources return whatever matches the filters and know nothing about this
user, so the two have to be joined on the client — `useFavorites` fetches the
saved ids once per session and `MapView` reconciles. FAV-16 exists so the
criterion is anchored to the place the user meets it rather than to a component
rendered with a convenient prop.

Because the saved set resolves after the cards have mounted, the card adjusts
its state during render when the prop changes rather than seeding `useState`
once. An effect would paint the wrong state and then correct it, which is a
visible flicker on every search.

### "Loading" is not "signed out"

`useSession()` has three states, and the control originally branched on two:
anything that was not `authenticated` was sent to sign-in. That is wrong for the
window before the session request resolves — an already signed-in user was
pushed to `/login`, which `proxy.ts` then redirects to `/` because `/login` is
guest-only and they hold a valid token. The click was lost and the user was
thrown to the home page.

The window is invisible on `/map`, where cards only appear after the source
fetches resolve, and wide open on `/favorites`, which is server-rendered and
therefore clickable on first paint. It surfaced as `e2e/favorites.spec.ts`
FAV-3 failing two runs in three.

A click while `loading` is now ignored. The alternatives were worse: disabling
the control makes it a dead end the UI bar forbids, and queueing the click until
the session resolves means a heart that silently acts a second after the user
gave up on it. FAV-18 pins both halves — no navigation, and no pretending the
listing was saved.

### The toggle is optimistic

Favoriting is low-stakes and high-frequency: the cost of being briefly wrong is
a heart that flickers back, and the cost of being slow is a control that feels
broken. So the control updates first and reconciles after, rolling back with a
toast on failure (FAV-10, FAV-11). This follows the project's existing UX rule
rather than introducing a new one.

### Signed-out visitors are sent to sign-in, not shown a dead control

Three options: hide the heart, disable it, or route to sign-in. Hiding it means
a signed-out visitor never discovers the feature exists. Disabling it is a dead
end, which the project's UI bar explicitly forbids. Routing to `/login` with a
`callbackUrl` reuses the mechanism `proxy.ts` already implements for `/account`
and lands the user back where they were.

The rejected fourth option — keeping favorites in `localStorage` for signed-out
users and merging them on sign-in — is a real feature people like, but it brings
a merge-conflict problem (same listing saved in both places, which timestamp
wins) that is larger than the rest of this spec put together. It belongs in its
own spec if it is wanted.

### No rate limit for now

`lib/rate-limit.ts` exists and is applied to every auth surface, but those are
unauthenticated endpoints where the abuse is enumeration and credential
stuffing. Saving a favorite requires a session, writes one small row, and is
bounded by a unique constraint, so the worst a determined user achieves is
filling their own list. Adding a limiter here would be reflex, not reasoning.
Recorded as an open question rather than an assumption.

### The cascade is a schema property, not a criterion

Deleting a user must delete their favorites. That is `onDelete: Cascade`,
enforced by Postgres — and this project has no test database, so no test in this
repo can prove it. Rather than write a criterion that can only be verified by
mocking the very thing under test, it is specified in §5 as a schema
requirement and left to review. Writing FAV-n for it would have produced a test
that asserts Prisma was called with the right arguments, which proves nothing
about whether the constraint exists.

## 5. Data and contracts

### Schema

A new `Favorite` model, related to `User` with `onDelete: Cascade`, plus the
matching `favorites Favorite[]` relation field on `User`:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | |
| `userId` | `String` | Indexed; cascade on user delete |
| `listingId` | `String` | The normalized, source-prefixed id |
| `source` | `String` | `Wallapop` / `Coches.net` / `Milanuncios` |
| `title`, `subtitle`, `image`, `location`, `fuel`, `url` | `String` | Snapshot; `subtitle`, `image` and `fuel` may be empty strings, matching `CarListing` |
| `price`, `mileage`, `year` | `Int` | Snapshot; zero means unknown, as in `CarListing` |
| `lat`, `lng` | `Float` | Snapshot, so the favorites page can map them later |
| `createdAt` | `DateTime @default(now())` | Orders FAV-8 |

Constraints: `@@unique([userId, listingId])` and `@@index([userId])`.

### Server actions

In `app/actions/favorites.ts`, following the project's action conventions —
`getCurrentUser()` first, Zod `safeParse`, and a typed
`{ success, error?: FavoriteErrorCode }` return where the error is a **code**,
never prose:

- `saveFavorite(input)` — FAV-1, FAV-2, FAV-5, FAV-7
- `removeFavorite(listingId)` — FAV-3, FAV-4, FAV-5, FAV-6
- `listFavorites()` — FAV-8

Error codes in `lib/validations/favorites.ts`, mirroring the `AUTH_ERROR` shape:
`unauthenticated`, `invalidListing`, `unexpected`.

### Routing

`/favorites` is added to `PROTECTED_PREFIXES` and to the `matcher` in
`proxy.ts` (FAV-15). As with `/account`, this is UX — the actions re-check
`getCurrentUser()` independently.

### i18n

`t.map.addFavorite` and `t.map.removeFavorite` already exist in both locales.
New keys needed in `en.ts`, `es.ts` and `types.ts`: a favorites page title, the
empty state and its call to action, and the save-failed toast.

## 6. Open questions

1. ~~Is FAV-12 the behaviour you want?~~ **Settled 2026-08-02: route to
   sign-in.** Hiding the control was considered and rejected — a signed-out
   visitor would never discover the feature exists. FAV-12 stands as written.
2. ~~FAV-1's durability is asserted at the action boundary, not end to end.~~
   **Closed.** `pnpm db:branch` supplied the disposable database this was waiting
   on; `e2e/favorites.spec.ts` now proves the round trip against real Postgres,
   polling the row count rather than trusting the optimistic toggle. Original
   finding:
   With Prisma mocked, "still there on the next request" means the action reads
   back what it wrote, not that Postgres kept it. A true round trip needs the
   disposable test database that `e2e/auth.spec.ts` is already blocked on
   (`test.skip` stub). Worth doing once, for both features at once — out of
   scope here.
3. **Decided: no rate limit.** Saving requires a session, writes one small row,
   and is bounded by a unique constraint, so the worst a determined user
   achieves is filling their own list. `lib/rate-limit.ts` exists for
   unauthenticated surfaces where the abuse is enumeration and credential
   stuffing; applying it here would be reflex rather than reasoning. Revisit if
   a real abuse pattern appears.
4. **Decided: not now.** The coordinates are snapshotted so it stays cheap to
   add, and nobody has asked for it. Building it because it is easy is how
   features arrive without anyone wanting them. Original note: The coordinates are
   snapshotted, so it is cheap to add later; not specified here because nobody
   asked for it.
