# Testing

**Vitest** (unit, node, component), **React Testing Library**, **MSW** for
network, **vitest-axe** for accessibility, **Playwright** for end-to-end and
visual. This is the house setup — do not introduce Jest or Cypress.

Tests are **colocated**: `foo.ts` → `foo.test.ts`. There are no `__tests__/`
folders.

## The five levels

Choosing the level is a decision made in the spec, not an afterthought. Pushing
work down a level is almost always right.

| Level | Runs in | Named | For |
| --- | --- | --- | --- |
| `unit` | jsdom | `*.test.ts` | Pure library code, source clients (they need `window.location`) |
| `component` | jsdom | `*.test.tsx` | Rendering and interaction, via Testing Library |
| `node` | node | `*.node.test.ts` | Route handlers, server actions, scripts — anything needing real Node request globals |
| `contract` | node | `test/contract/*.contract.test.ts` | The shape of the **external** APIs |
| `e2e` | browser | `e2e/*.spec.ts` | Only what genuinely needs a browser |

### The two Vitest projects

Split by environment, not by kind — see [`vitest.config.ts`](../vitest.config.ts).

**`unit`** (jsdom) is the default: everything under `lib/`, `components/` and
`app/` matching `*.test.{ts,tsx}`.

**`node`** is opt-in **by filename**: `*.node.test.ts`. Route handlers and server
actions need Node's real `Request`/`Response`, which jsdom does not provide.

Two entries in the `node` include list are worth knowing:

- `proxy.node.test.ts` is listed explicitly, because Next's file convention
  forces `proxy.ts` to sit at the repo root where the `{lib,app}/**` glob cannot
  reach it.
- `scripts/**/*.node.test.ts` is covered even though it is not app code — a bug
  in `db-branch.mjs` clobbers real secrets.

## Network: MSW only

**Never hand-stub `global.fetch`.** All network faking goes through MSW, with
`onUnhandledRequest: "error"` so a stray request fails loudly instead of hanging.

| File | Holds |
| --- | --- |
| `test/msw/handlers.ts` | Default happy-path handlers — the local proxy routes for jsdom clients, the upstream APIs for node route tests |
| `test/msw/server.ts` | The server instance |
| `test/fixtures/*.ts` | Typed builders — `makeWallapopItem`, `makeCochesNetItem`, … |
| `test/mocks/intersection-observer.ts` | Controllable IO; `triggerIntersection()` drives infinite scroll |
| `test/utils/render.tsx` | `renderWithI18n(ui)` |

Override per-test with `server.use(...)`. Handlers reset in `afterEach`.

**Fixtures: override only the field under test.** A builder that spells out every
field in every test is how a fixture stops describing anything.

**`renderWithI18n` wraps in `I18nProvider locale="en"`** so tests can query stable
English labels. Without a provider `useTranslation` falls back to Spanish, which
is the app default but makes assertions read strangely.

## Contract tests

`test/contract/*.contract.test.ts` are Zod schemas of the **external** shapes the
normalizers read — not of our own types.

- `pnpm test:contract` validates the fixtures offline. Runs in CI on every push.
- `pnpm test:contract:live` (`CONTRACT_LIVE=1`) hits the real APIs. **Runs
  nightly**, and is the alarm for an upstream changing shape.

This is the only thing standing between a silent upstream change and a search
that returns nothing. It matters most for Milanuncios, where a layout change
degrades to zero ads rather than an error — see
[integrations/milanuncios.md](integrations/milanuncios.md).

## Environment gotchas

Every entry here is a trap someone already fell into. That is what earns them the
space.

**Module-level caches persist across tests.** `lib/wallapop/cache.ts`,
`lib/cochesnet/models.ts` (`modelsByMake`) and `lib/geo/user-location.ts` all
hold module state with no reset hook. Use distinct keys or brands per test, or
fake timers.

**Fake timers and `userEvent` do not mix.** Testing Library's async wrapper awaits
a `setTimeout` it only advances when it detects *jest's* fake clock, which Vitest
does not expose — so every interaction hangs until the test times out. Either
drive the hook directly (`renderHook` + `act`), or keep real timers and let
`findBy*` (1 s default) absorb the 400 ms debounce. `LocationSearch.test.tsx`
does the latter.

**Radix Select needs pointer plumbing jsdom lacks.**
`hasPointerCapture`/`setPointerCapture`/`releasePointerCapture` are stubbed in
`test/setup.jsdom.ts`, and the trigger must be clicked with
`userEvent.setup({ pointerEventsCheck: 0 })`. `SelectValue` renders nothing while
the content is unmounted, so a closed trigger's accessible name is its label
alone — query `getByRole("combobox", { name: /Brand/ })`, **never** by the
selected value.

**`useListingsSearch.loadMore` is not public.** It fires only from the sentinel.
Test it with `sentinelRef(node)` then `triggerIntersection()`.

**`<input type="email">` uses native browser validation.** A malformed value is
blocked by the browser *before* react-hook-form runs, so RHF's "Invalid email
address" message never renders. Assert "did not submit" for malformed input, and
use empty/required cases to exercise RHF's own messages. The forms deliberately
do not set `noValidate`.

**Controlled inputs need a stateful harness.** A value only accumulates in e.g.
`RangeInput` if a parent holds state. Do not pass a static `value` and expect
typing to work.

**jsdom lacks** IntersectionObserver, geolocation (defaults to denied, so the
Spain-centre fallback is what you get), matchMedia and canvas. All are stubbed in
`test/setup.jsdom.ts`.

**Leaflet cannot run in jsdom.** Mock `react-leaflet` in component tests; render
it for real only in Playwright.

## End-to-end

`e2e/`, run against a real `next dev` server via Playwright's `webServer`.

**The source proxies are mocked at the browser level** (`page.route`, in
`e2e/fixtures/network.ts`), so e2e never touches live Wallapop, coches.net or
Milanuncios. Fixture image URLs must use a host allowed in `next.config.ts`
(`**.wallapop.com`, `**.ccdn.es`) or `next/image` throws a client exception.
`mockListingSources` also stubs `**/_next/image**` — the fixture URLs use allowed
hosts but do not exist, so `next/image` really fetched them, really 404'd, and
rendered differently depending on timing.

Three projects, all run by `pnpm test:e2e`: `chromium` and `mobile` (functional)
plus `visual` (screenshots). `pnpm test:visual` runs the screenshots alone.

### The database-backed suite

`pnpm test:e2e:db` (`E2E_DB=1`) runs the auth, two-factor and favorites round
trips against a real database — the only tests that prove anything about
persistence, since Prisma is mocked everywhere in Vitest.

**It needs `pnpm db:branch` first.** Without its own branch database it writes to
whatever `DATABASE_URL` points at. Global teardown deletes every `@e2e.local`
account, and `Favorite` rows go with them by cascade.

**Env-prefixed scripts need `cross-env`.** `E2E_DB=1 playwright test` is POSIX
syntax that cmd.exe does not understand, so on Windows the script failed with
`'E2E_DB' is not recognized` and the suite never ran at all. CI is ubuntu, where
the bare form works, so nothing caught it — the gate was broken on the only
machine that runs it. Both `test:e2e:db` and `test:contract:live` now go through
`cross-env`; any new script that sets a variable inline must do the same.

**It is not in CI.** `pnpm test:e2e` runs without `E2E_DB`, so those tests skip
there and gate nothing. Wiring them needs `NEON_API_KEY` as a GitHub secret plus
a job that forks and deletes a branch database per run. Until that exists, **a
green CI says nothing about persistence.**

Two traps found while wiring it up:

- **The suite exhausts its own login rate limit.** Dozens of sign-ins from one
  address against a limit of 20 per IP per 15 minutes, so a second run inside
  that window failed every test with what looked like broken auth. Global setup
  now clears the `RateLimit` table when `E2E_DB` is set.
- **`webServer.env` merges with `process.env`**, and `playwright.config.ts` loads
  `.env` at line 1. Registration behaves completely differently depending on
  whether email is configured, so the mode was decided by the developer's `.env`
  until `RESEND_API_KEY`/`EMAIL_FROM` were pinned to `""` there.

**On a server-rendered page, wait for the session before clicking.** `/favorites`
paints its cards from the server, so they are clickable well before
`useSession()` resolves — and a favorite click while the session is loading is
deliberately ignored (FAV-18). Clicking too early is therefore a silent no-op,
which surfaced as `FAV-3` failing two runs in three. `waitForSession()` waits for
the navbar to swap in the signed-in controls, the same hydration signal
`waitForPageToSettle` uses. `/map` hides this window because its cards only exist
after the source fetches resolve.

This one was worth chasing rather than retrying: the same early click used to
push a signed-in user to `/login`, which `proxy.ts` bounced to `/`. The flake was
a real bug wearing a timing costume.

**Never assert an optimistic UI toggle to prove a write landed.** The favorite
control flips before the server answers and rolls back after a failure, so the
assertion passes even when nothing was saved — and navigating away next cancels
the request. `e2e/favorites.spec.ts` polls the row count in Postgres instead.

### Visual tests

**Baselines are platform-specific** (`*-win32.png` locally; CI is ubuntu). Each
visual test **skips itself with an explanatory reason** when the current platform
has no baseline, so a Linux CI stays green until Linux baselines are committed.
Generate them with `pnpm test:visual --update-snapshots` on that platform.

**Screenshots must wait for the page to settle** (`waitForPageToSettle` in
`e2e/visual.spec.ts`). The navbar swaps a placeholder for real links when
`useSession()` resolves, and `next/font` loads asynchronously. Both raced the
camera and made these tests look inherently flaky. They are not.

**`maxDiffPixels: 300` is calibrated, not arbitrary**: roughly 86 px of
antialiasing noise between identical renders, versus 1,310 px for a one-step
font-size change. Do not raise it to silence a failure — read the diff PNG in
`test-results/`, which points straight at the culprit.

## Coverage

A **ratchet, not a target**: 89 statements / 85 branches / 84 functions / 89
lines, each set a point under what was measured so ordinary variance does not
fail CI but a real drop does.

Raise them when coverage rises. **Never lower them to make a red build green.**

Route shells (`app/**/page.tsx`, `layout.tsx`) are deliberately still counted even
though Playwright is what exercises them — excluding them would flatter the
number and hide logic that drifts into a page. `scripts/` is outside the coverage
scope entirely.

## Quality bar

The `/check-tests` rules are the real gate, and they apply to every test written
here:

- No tautological assertions, no self-fulfilling fixtures, no mocking the unit
  under test.
- **Hand-derive every expected value.** Computing the expectation the same way
  the code does proves nothing.
- Cover a negative path. Invalid input, empty result, upstream failure,
  unauthorised caller — that is where the bugs are.
- When a test is red, **fix the production code, not the test** — unless the test
  itself was wrong.

`pnpm spec:check` proves an acceptance criterion is *mentioned* by a test title.
It cannot prove the assertion behind it is meaningful. Only review does.

## Known findings, unfixed

Surfaced by the suite and deliberately left:

- Auth pages fail `color-contrast`, and are excluded from the a11y gate.
- Malformed email is caught by native browser validation rather than
  react-hook-form, because the forms lack `noValidate`.

## See also

- [Contributing](README.md#contributing) — where tests sit in the spec loop
- [`specs/README.md`](specs/README.md) — criteria, ids, and how tests name them
- [Getting started](getting-started.md) — the commands
