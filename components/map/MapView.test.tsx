import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { NextIntlClientProvider } from "next-intl";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { axe } from "vitest-axe";
import { server } from "@/test/msw/server";
import { renderWithI18n } from "@/test/utils/render";
import { stubPhoneWidth } from "@/test/utils/viewport";
import esMessages from "@/messages/es.json";
import { makeWallapopItem, makeWallapopResponse } from "@/test/fixtures/wallapop";
import { makeCochesNetResponse } from "@/test/fixtures/cochesnet";
import { makeMilanunciosResponse } from "@/test/fixtures/milanuncios";
import { triggerIntersection } from "@/test/mocks/intersection-observer";
import { makeFavoriteInput } from "@/test/fixtures/favorite-listings";
import { listFavorites } from "@/server/favorites/actions";
import { searchListings } from "@/server/search/actions";
import { setMapFiltersSlot, setMapHeaderSlot } from "@/lib/hooks/useMapHeaderSlot";
import { createAlert } from "@/server/alerts/actions";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { TabBar } from "@/components/nav/TabBar";
import { MapView } from "./MapView";

// The tests that quote docs/specs/redesign-map.md's worked examples word for
// word render in Spanish, the locale the spec writes them in, with
// `{ locale: "es" }`; renderWithI18n otherwise renders English
// (test/utils/render.tsx).

const push = vi.fn();
// What useCurrentPath (lib/hooks/useCurrentPath.ts) reads as the page's query.
const currentQuery = vi.fn(() => "");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/map",
  useSearchParams: () => ({ toString: () => currentQuery() }),
}));
vi.mock("@/server/alerts/actions", () => ({ createAlert: vi.fn() }));
// The browser's position (MAP-28 to MAP-35, issue #117): null by default, so
// every case above behaves exactly as before (jsdom's own geolocation denial).
// A case that sets `geo.position` stands in for a resolved, granted fix; one
// that replaces `geo.wait` controls when the browser answers.
const geo = vi.hoisted(() => ({
  position: null as { lat: number; lng: number } | null,
  wait: Promise.resolve(),
}));
vi.mock("@/lib/geo/user-location", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/geo/user-location")>()),
  initUserGeolocation: vi.fn(),
  waitForGeolocation: () => geo.wait,
  getUserLocation: () => geo.position,
}));
// SiteHeader's language control calls this action; Sentry is what
// LanguageControl reports a failure to. Neither is what these tests are about.
vi.mock("@/server/locale/actions", () => ({
  setLocale: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from "sonner";
// useFavorites reads the session (authClient.useSession(), Better Auth) to
// decide what a card's favorite control does, and calls the favorites actions.
// Neither is what these tests are about. Typed so a test can widen it to an
// authenticated session; inferring from the default would pin `data` to null.
const useSession = vi.fn<() => { data: { user: { id: string } } | null; isPending: boolean }>(
  () => ({
    data: null,
    isPending: false,
  }),
);
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => useSession() },
}));
vi.mock("@/server/favorites/actions", () => ({
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  listFavorites: vi.fn(async () => ({ success: true, data: [] })),
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));

// The mock IS the real fan-out: it delegates to the real `searchRound`
// (server/search/service.ts) against the MSW upstream handlers below — the
// same pattern lib/hooks/useListingsSearch.test.tsx uses, since FRONT-5
// deletes the local `/api/wallapop|cochesnet|milanuncios` proxies this file
// used to override.
vi.mock("@/server/search/actions", async () => {
  const { searchRound } = await import("@/server/search/service");
  const { applyResultFilters } = await import("@/lib/listings/merge");
  return {
    searchListings: vi.fn(async (input, cursors) => {
      const round = await searchRound(input, cursors);
      return { ok: true, value: { ...round, listings: applyResultFilters(round.listings, input) } };
    }),
  };
});

// MapView loads the map through next/dynamic, and these tests are about what
// MapView hands it, so the stub stands in for the whole module and reports
// that: the listings, the active car (MAPUI-27, MAPUI-28), whether it is the
// desktop map (MAPUI-20, MAPUI-29), and one button per listing standing for
// that car's pin (MAPUI-24, MAPUI-27). ListingsMap's own behaviour is
// ListingsMap.test.tsx's and ListingsMap.preview.test.tsx's job.
vi.mock("@/components/map/ListingsMap", () => ({
  ListingsMap: ({
    listings,
    activeId,
    desktop,
    onActivate,
    onMapInteract,
    zone,
  }: {
    listings: { id: string }[];
    activeId?: string;
    desktop?: boolean;
    onActivate?: (id: string) => void;
    // MAPUI-62: the map itself was tapped or a pan started — never a pin tap.
    onMapInteract?: () => void;
    // MAP-34: the 50 km circle around the browser's position, standing in for a place.
    zone?: { lat: number; lng: number; radiusKm: number };
  }) => (
    <div
      data-testid="listings-map"
      data-count={listings.length}
      data-active-id={activeId ?? ""}
      data-desktop={String(desktop)}
      data-zone={zone ? JSON.stringify(zone) : ""}
    >
      {onMapInteract && (
        <button type="button" onClick={() => onMapInteract()}>
          tap map
        </button>
      )}
      {onActivate && listings[0] && (
        <button type="button" onClick={() => onActivate(listings[0].id)}>
          tap pin
        </button>
      )}
      {onActivate &&
        listings.map((listing) => (
          <button key={listing.id} type="button" onClick={() => onActivate(listing.id)}>
            {`tap pin ${listing.id}`}
          </button>
        ))}
    </div>
  ),
}));

// lib/wallapop/cache.ts is a module-level Map keyed by the search params and
// lives for the whole file. Every case therefore opens MapView with its own
// query, which is both the cache key and the keyword sent upstream.
const WALLAPOP_TITLE = "Audi A3 2.0 TDI";

const WALLAPOP = "https://api.wallapop.com/api/v3/search/section";
const COCHESNET = "https://web.gw.coches.net/search/listing";
const MILANUNCIOS = "https://www.milanuncios.com/*";

// Narrow the search to Wallapop so a case can control a single source.
const onlyWallapop = [
  http.post(COCHESNET, () => HttpResponse.json(makeCochesNetResponse([], 0))),
  http.get(MILANUNCIOS, () => HttpResponse.json(makeMilanunciosResponse([], 0))),
];

// What a case may change, put back before the next: the session (signed
// out), a signed-in buyer's favourites (none), the page's query, the router's
// and createAlert's calls, the phone width and the map header's slot.
const realMatchMedia = window.matchMedia;

beforeEach(() => {
  useSession.mockReturnValue({ data: null, isPending: false });
  vi.mocked(listFavorites).mockReset();
  vi.mocked(listFavorites).mockResolvedValue({ ok: true, value: [] });
  currentQuery.mockReturnValue("");
  push.mockClear();
  vi.mocked(createAlert).mockClear();
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
  setMapHeaderSlot(null);
  setMapFiltersSlot(null);
});

describe("MapView results", () => {
  it("renders what the sources return", async () => {
    renderWithI18n(<MapView initialQuery="case-all-sources" />);

    expect(await screen.findByText(WALLAPOP_TITLE)).toBeInTheDocument();
    // One card per source: the default handlers return one item each.
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("MAP-15/MAPUI-31: shows the redesigned empty state when no source has anything, with no place chosen", async () => {
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([], null))),
    );

    renderWithI18n(<MapView initialQuery="case-empty" />, { locale: "es" });

    expect(await screen.findByText("¿Nada por aquí?")).toBeInTheDocument();
    expect(screen.getByText("Quita algún filtro")).toBeInTheDocument();
    // No place chosen: the line and the status pill both name no radius.
    expect(
      screen.getByText("Con estos filtros no hay coches. Prueba a quitar algún filtro."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ningún coche con estos filtros")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ampliar a/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar filtros" })).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("MAPUI-31: shows the redesigned empty state widened for the next radius, with a place chosen at 50 km", async () => {
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([], null))),
    );

    // Deep-links a place and leaves `radius` at its 50 km default (FRONT-13's
    // worked-example URL, lib/search/url-state.ts's `searchParsers`), rather
    // than driving the «Dónde» popover's PlaceField combobox through a
    // debounce — the hook reads this through `useQueryStates` on mount, so
    // the first search already carries the place.
    render(<MapView initialQuery="case-empty-with-place" />, {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale="es" messages={esMessages} timeZone="UTC">
          <NuqsTestingAdapter
            hasMemory
            searchParams="lat=40.4168&lng=-3.7038&placeId=1&locationName=Madrid"
          >
            {children}
          </NuqsTestingAdapter>
        </NextIntlClientProvider>
      ),
    });

    expect(await screen.findByText("¿Nada por aquí?")).toBeInTheDocument();
    expect(screen.getByText("Amplía el radio")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Con estos filtros no hay coches en 50 km. Prueba más lejos o quita algún filtro.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ampliar a 100 km" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar filtros" })).toBeInTheDocument();
    expect(screen.getByText("Ningún coche en 50 km")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("MAP-15/MAPUI-31: the empty state with a filter has no accessibility violations", async () => {
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([], null))),
    );

    const { container } = renderWithI18n(<MapView initialQuery="case-empty-axe" />, {
      locale: "es",
    });
    await screen.findByText("¿Nada por aquí?");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("MAPUI-31: the empty state with no filter, a place at 50 km, has no accessibility violations", async () => {
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([], null))),
    );

    // Same deep link as MAPUI-31's worked example above: a place with the
    // 50 km default radius and no `?q=` text.
    const { container } = render(<MapView />, {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale="es" messages={esMessages} timeZone="UTC">
          <NuqsTestingAdapter
            hasMemory
            searchParams="lat=40.4168&lng=-3.7038&placeId=1&locationName=Madrid"
          >
            {children}
          </NuqsTestingAdapter>
        </NextIntlClientProvider>
      ),
    });
    await screen.findByText("¿Nada por aquí?");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("MAP-15: hands the same listings to the map", async () => {
    renderWithI18n(<MapView initialQuery="case-map-sync" />);

    await screen.findByText(WALLAPOP_TITLE);

    await waitFor(() =>
      expect(screen.getByTestId("listings-map")).toHaveAttribute("data-count", "3"),
    );
  });
});

describe("MapView searching", () => {
  it("starts from the query the page was opened with", async () => {
    renderWithI18n(<MapView initialQuery="case-initial-query" />);

    // MAPUI-18: the `?q=` text still reaches the search, with no control for it.
    await waitFor(() =>
      expect(searchListings).toHaveBeenCalledWith(
        expect.objectContaining({ keywords: "case-initial-query" }),
        expect.anything(),
      ),
    );
  });
});

describe("MapView infinite scroll", () => {
  it("MAP-8: appends the next page when the sentinel comes into view", async () => {
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, ({ request }) => {
        const isNextPage = new URL(request.url).searchParams.get("next_page") !== null;
        return HttpResponse.json(
          isNextPage
            ? makeWallapopResponse(
                [makeWallapopItem({ id: "def456", title: "Seat Leon FR" })],
                null,
              )
            : makeWallapopResponse([makeWallapopItem()], "page-2"),
        );
      }),
    );
    renderWithI18n(<MapView initialQuery="case-next-page" />);
    await screen.findByText(WALLAPOP_TITLE);

    act(() => triggerIntersection());

    expect(await screen.findByText("Seat Leon FR")).toBeInTheDocument();
    // Appended, not replaced.
    expect(screen.getByText(WALLAPOP_TITLE)).toBeInTheDocument();
  });

  it("MAP-9: fetches nothing more once every source is exhausted", async () => {
    let calls = 0;
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, () => {
        calls += 1;
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem()], null));
      }),
    );
    renderWithI18n(<MapView initialQuery="case-exhausted" />);
    await screen.findByText(WALLAPOP_TITLE);
    const callsAfterSearch = calls;

    act(() => triggerIntersection());

    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
    expect(calls).toBe(callsAfterSearch);
  });
});

describe("MapView favorites", () => {
  it("FAV-16: shows an already-saved listing as saved in the results", async () => {
    useSession.mockReturnValue({
      data: { user: { id: "user-ada" } },
      isPending: false,
    });
    // The Wallapop fixture normalises to this id.
    vi.mocked(listFavorites).mockResolvedValue({
      ok: true,
      value: [makeFavoriteInput({ id: "wallapop-abc123" })],
    });

    renderWithI18n(<MapView initialQuery="case-saved-listing" />);
    await screen.findByText(WALLAPOP_TITLE);

    // Before this criterion existed, MapView passed no isFavorite at all, so a
    // saved car came back from a search looking unsaved.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove from saved" })).toBeInTheDocument(),
    );
  });

  it("FAV-16: leaves listings unsaved for a signed-out visitor", async () => {
    renderWithI18n(<MapView initialQuery="case-signed-out" />);
    await screen.findByText(WALLAPOP_TITLE);

    expect(screen.queryByRole("button", { name: "Remove from saved" })).not.toBeInTheDocument();
    expect(listFavorites).not.toHaveBeenCalled();
  });
});

// FRONT-14 (docs/specs/core-frontend.md): the map results list's four
// states. Populated is covered above ("renders what the sources return") and
// empty by MAP-15. These two are new: a loading skeleton (RULES.md §19:
// "skeletons mirror final content"), replacing the Loader2 spinner MapView
// renders today, and an inline error with a Retry button — the exact
// FRONT-14 worked example — replacing the toast MAP-3 asserts today.
describe("MapView result states (FRONT-14)", () => {
  it("FRONT-14/MAPUI-30: shows a loading skeleton and, at desktop width, a Buscando coches… status pill", async () => {
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, async () => {
        await delay(50);
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem()]));
      }),
    );
    const { container } = renderWithI18n(<MapView initialQuery="loading-skeleton-case" />, {
      locale: "es",
    });

    // aria-busy, not colour alone, marks the region as loading for assistive
    // tech while the skeleton mirrors the eventual card grid. Not
    // role="status": that would clash with PlaceField's own live region
    // under strict mode (MAP-20) — MAPUI-30's own status pill is a second,
    // map-side region, not the list's.
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Buscando coches…");

    await screen.findByText(WALLAPOP_TITLE);
  });

  it("MAPUI-30: below lg the busy region shows one two-bar placeholder, and at lg a grid of three-bar placeholders (F0-estado-cargando.dc.html)", async () => {
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, async () => {
        await delay(50);
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem()]));
      }),
    );
    const { container } = renderWithI18n(<MapView initialQuery="loading-skeleton-bars-case" />, {
      locale: "es",
    });

    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });
    const busyRegion = container.querySelector('[aria-busy="true"]') as HTMLElement;

    // jsdom ignores breakpoints, so both placeholders exist in the DOM at
    // once; `lg:hidden` and `max-lg:hidden` (real CSS, not jsdom) are what
    // keep only one showing at a given width. `startsWith`/`includes` here
    // (not a CSS selector) tells the two apart without a false match, since
    // "max-lg:hidden" also contains the substring "lg:hidden".
    const children = Array.from(busyRegion.children) as HTMLElement[];
    const phonePlaceholder = children.find((el) => el.className.startsWith("lg:hidden"));
    const desktopGrid = children.find((el) => el.className.includes("max-lg:hidden"));
    expect(phonePlaceholder).not.toBeUndefined();
    expect(desktopGrid).not.toBeUndefined();

    // Phone (F0-estado-cargando.dc.html): the photo plus two bars.
    expect(phonePlaceholder?.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);

    // Desktop: each placeholder is the photo plus three bars.
    const firstDesktopCard = desktopGrid?.firstElementChild as HTMLElement;
    expect(firstDesktopCard.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4);

    await screen.findByText(WALLAPOP_TITLE);
  });

  it("FRONT-14/MAPUI-32: a rejecting search shows the redesigned error state with Reintentar and never a toast (worked example)", async () => {
    server.use(
      http.get(WALLAPOP, () => HttpResponse.json({ error: "down" }, { status: 500 })),
      http.post(COCHESNET, () => HttpResponse.json({ error: "down" }, { status: 500 })),
      http.get(MILANUNCIOS, () => HttpResponse.json({ error: "down" }, { status: 500 })),
    );
    renderWithI18n(<MapView initialQuery="error-state-case" />, { locale: "es" });

    // "Reintentar" alone already holds against today's code (errors.retry is
    // already that word in Spanish) — the heading, the line and the map's
    // own status pill are what is actually new in MAPUI-32.
    expect(await screen.findByText("¿Se ha caído algo?")).toBeInTheDocument();
    expect(screen.getByText("Prueba otra vez")).toBeInTheDocument();
    expect(
      screen.getByText("No hemos podido traer los anuncios. Suele ser cosa de un momento."),
    ).toBeInTheDocument();
    expect(screen.getByText("Sin conexión con los anuncios")).toBeInTheDocument();

    const retry = screen.getByRole("button", { name: "Reintentar" });
    expect(toast.error).not.toHaveBeenCalled();

    // Retry re-runs the same round rather than leaving the user stuck.
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([makeWallapopItem()]))),
    );
    await userEvent.click(retry);
    await screen.findByText(WALLAPOP_TITLE);
  });

  it("FRONT-14/MAPUI-32: the failed-search state has no accessibility violations", async () => {
    server.use(
      http.get(WALLAPOP, () => HttpResponse.json({ error: "down" }, { status: 500 })),
      http.post(COCHESNET, () => HttpResponse.json({ error: "down" }, { status: 500 })),
      http.get(MILANUNCIOS, () => HttpResponse.json({ error: "down" }, { status: 500 })),
    );
    const { container } = renderWithI18n(<MapView initialQuery="error-state-axe" />, {
      locale: "es",
    });

    await screen.findByText("¿Se ha caído algo?");

    expect(await axe(container)).toHaveNoViolations();
  });
});

// docs/specs/redesign-map.md (MAPUI-28). Hovering or focusing a card marks
// its pin active — surfaced here as the `activeId` prop handed to the
// (mocked) map, since ListingsMap's own rendering of "active" is its own
// test's job (components/map/ListingsMap.test.tsx).
describe("MapView — MAPUI-28 card hover and focus activates the pin", () => {
  it("MAPUI-28: hovering a card sets it as the map's active listing", async () => {
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-hover-active" />);
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.hover(screen.getByRole("article"));

    await waitFor(() =>
      expect(screen.getByTestId("listings-map")).toHaveAttribute(
        "data-active-id",
        "wallapop-abc123",
      ),
    );
  });

  it("MAPUI-28: focusing a card sets it as the map's active listing", async () => {
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-focus-active" />);
    await screen.findByText(WALLAPOP_TITLE);

    screen.getByRole("article").focus();

    await waitFor(() =>
      expect(screen.getByTestId("listings-map")).toHaveAttribute(
        "data-active-id",
        "wallapop-abc123",
      ),
    );
  });
});

// docs/specs/redesign-map.md (MAPUI-39). Two floating cards (the pin preview
// and the create-alert dialog) must never show at once on desktop — opening
// the header's «Crear alerta» closes an open pin preview. HeaderSearch
// portals into the map header's centre cell (useMapHeaderSlot), which only
// components/nav/MapHeader.tsx normally provides, so this test hands it a
// detached slot directly rather than rendering the whole layout.
describe("MapView — MAPUI-39 opening Crear alerta closes an open pin preview", () => {
  it("MAPUI-39: opening Crear alerta closes an open pin preview", async () => {
    // Only a signed-in buyer gets the dialog; a signed-out one is sent to
    // sign in instead (MAPUI-46, below).
    useSession.mockReturnValue({ data: { user: { id: "user-ada" } }, isPending: false });
    server.use(...onlyWallapop);
    const headerSlot = document.createElement("div");
    document.body.appendChild(headerSlot);
    setMapHeaderSlot(headerSlot);

    try {
      renderWithI18n(<MapView initialQuery="case-create-alert-closes-preview" />);
      await screen.findByText(WALLAPOP_TITLE);

      await userEvent.click(screen.getByRole("button", { name: "tap pin" }));
      expect(screen.getByTestId("listings-map")).toHaveAttribute(
        "data-active-id",
        "wallapop-abc123",
      );

      await userEvent.click(within(headerSlot).getByRole("button", { name: "Create alert" }));

      await waitFor(() =>
        expect(screen.getByTestId("listings-map")).toHaveAttribute("data-active-id", ""),
      );
    } finally {
      headerSlot.remove();
    }
  });
});

// docs/specs/redesign-map.md (MAPUI-24). useIsPhone (lib/hooks/useIsPhone.ts)
// reads window.matchMedia, which test/setup.jsdom.ts stubs to always report
// no match — so without overriding it here, MapView never behaves as the
// phone layout and this test would prove nothing about MAPUI-24. The sheet's
// resting position is already "middle" (MAPUI-23), so the test first
// collapses it to "peeked" via its handle (two clicks: middle -> full ->
// peeked — each press moves it one step up, and full wraps to peeked,
// MAPUI-58) to start from a position the pin tap actually has to move.
describe("MapView — MAPUI-24 tapping a pin on the phone", () => {
  it("MAPUI-24: tapping a pin moves the results sheet to its middle position showing that car's card first", async () => {
    stubPhoneWidth();

    renderWithI18n(<MapView initialQuery="case-tap-pin" />);
    await screen.findByText(WALLAPOP_TITLE);

    const handle = screen.getByRole("button", { name: "Results list" });
    await userEvent.click(handle);
    await userEvent.click(handle);
    expect(screen.getByTestId("results-sheet")).toHaveAttribute("data-position", "peeked");

    await userEvent.click(screen.getByRole("button", { name: "tap pin" }));

    expect(screen.getByTestId("results-sheet")).toHaveAttribute("data-position", "middle");
  });
});

// docs/specs/redesign-map.md (MAPUI-23). The sheet's three positions are
// "peeked, showing the title only", "middle, showing the first card" and
// "full". The design board draws the phone sheet at middle with the first
// card already visible from a fresh /map load — MAPUI-24's pin tap only
// changes which car is shown first, not the position.
describe("MapView — MAPUI-23 the results sheet's resting position", () => {
  it("MAPUI-23: starts at middle, showing the first card, before any pin is tapped", async () => {
    renderWithI18n(<MapView initialQuery="case-tap-pin" />);
    await screen.findByText(WALLAPOP_TITLE);

    expect(screen.getByTestId("results-sheet")).toHaveAttribute("data-position", "middle");
  });
});

// docs/specs/redesign-map.md (MAPUI-33, component half — the unit half,
// resultsHeading's own string construction, is tested in isolation at
// lib/map/results-heading.test.ts). In Spanish, as the spec's table reads.
describe("MapView — MAPUI-33 the results heading", () => {
  it("MAPUI-33: reads BUSCANDO COCHES… while the first page loads", async () => {
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, async () => {
        await delay(50);
        return HttpResponse.json(makeWallapopResponse([makeWallapopItem()]));
      }),
    );
    renderWithI18n(<MapView initialQuery="case-heading-loading" />, { locale: "es" });

    expect(await screen.findByText("BUSCANDO COCHES…")).toBeInTheDocument();
  });

  it("MAPUI-33: reads the exact count once every source is exhausted", async () => {
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([makeWallapopItem()], null))),
    );
    renderWithI18n(<MapView initialQuery="case-heading-exhausted" />, { locale: "es" });
    await screen.findByText(WALLAPOP_TITLE);

    expect(screen.getByText("1 COCHE")).toBeInTheDocument();
  });

  it("MAPUI-33: reads NINGÚN COCHE once sources are exhausted with no cars", async () => {
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([], null))),
    );
    renderWithI18n(<MapView initialQuery="case-heading-none" />, { locale: "es" });

    expect(await screen.findByText("NINGÚN COCHE")).toBeInTheDocument();
  });
});

// --- Phone width, the page's URL, and the cars a case returns. ---

const SEAT_TITLE = "Seat Leon FR";

/** Wallapop alone, exhausted, with the Audi then the Seat. */
const audiThenSeat = [
  ...onlyWallapop,
  http.get(WALLAPOP, () =>
    HttpResponse.json(
      makeWallapopResponse(
        [makeWallapopItem(), makeWallapopItem({ id: "def456", title: SEAT_TITLE })],
        null,
      ),
    ),
  ),
];

const nothingFound = [
  ...onlyWallapop,
  http.get(WALLAPOP, () => HttpResponse.json(makeWallapopResponse([], null))),
];

/** The criteria the latest search ran with. */
function lastSearch() {
  return vi.mocked(searchListings).mock.lastCall?.[0];
}

describe("MapView — MAPUI-20 the phone map screen", () => {
  it("MAPUI-20: at phone width the map has no zoom control and no app header, and the tab bar runs along the bottom", async () => {
    server.use(...onlyWallapop);
    stubPhoneWidth();

    renderWithI18n(
      <>
        <SiteHeader />
        <MapView initialQuery="case-phone-screen" />
        <TabBar />
      </>,
      { locale: "es" },
    );
    await screen.findByText(WALLAPOP_TITLE);

    expect(screen.getByTestId("listings-map")).toHaveAttribute("data-desktop", "false");
    expect(screen.queryByRole("button", { name: "Acercar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alejar" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("header-phone")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Toda España/ })).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav")).toHaveAccessibleName("Principal");
  });
});

describe("MapView — MAPUI-53 the tab bar and the full sheet", () => {
  it("MAPUI-53: the tab bar hides while the sheet is full and comes back when it leaves full", async () => {
    server.use(...onlyWallapop);
    stubPhoneWidth();

    renderWithI18n(
      <>
        <MapView initialQuery="case-tab-bar-full-sheet" />
        <TabBar />
      </>,
      { locale: "es" },
    );
    await screen.findByText(WALLAPOP_TITLE);
    const handle = screen.getByRole("button", { name: "Lista de resultados" });
    const tabBar = screen.getByTestId("bottom-nav");
    expect(tabBar).toHaveAttribute("aria-hidden", "false");

    await userEvent.click(handle);
    expect(screen.getByTestId("results-sheet")).toHaveAttribute("data-position", "full");
    expect(tabBar).toHaveAttribute("aria-hidden", "true");

    await userEvent.click(handle);
    expect(screen.getByTestId("results-sheet")).toHaveAttribute("data-position", "peeked");
    expect(tabBar).toHaveAttribute("aria-hidden", "false");
  });

  it("MAPUI-53: scrolling the sheet's list, then the map, at the middle position leaves the tab bar visible", async () => {
    server.use(...onlyWallapop);
    stubPhoneWidth();

    renderWithI18n(
      <>
        <MapView initialQuery="case-tab-bar-middle-scroll" />
        <TabBar />
      </>,
      { locale: "es" },
    );
    await screen.findByText(WALLAPOP_TITLE);

    const sheet = screen.getByTestId("results-sheet");
    expect(sheet).toHaveAttribute("data-position", "middle");
    const tabBar = screen.getByTestId("bottom-nav");
    expect(tabBar).toHaveAttribute("aria-hidden", "false");

    // ResultsSheet's body wrapper (the only element carrying
    // `overscroll-contain`) is the sheet's scrolling list in every position
    // but middle, where it is `overflow-hidden` rather than scrollable — the
    // single first card has nothing to scroll. It is still the closest
    // reachable stand-in for "the sheet's scrolling list element": the
    // behaviour under test (useHideOnScrollDown's listener, which does not
    // care whether the element actually overflows) only needs a scroll event
    // to bubble from inside the sheet to window's capture-phase listener.
    const scrollingList = sheet.querySelector(".overscroll-contain");
    if (!scrollingList) throw new Error("ResultsSheet renders no scrolling body element");
    Object.defineProperty(scrollingList, "scrollTop", { value: 400, writable: true });
    fireEvent.scroll(scrollingList);
    expect(tabBar).toHaveAttribute("aria-hidden", "false");

    const mapContainer = screen.getByTestId("listings-map");
    Object.defineProperty(mapContainer, "scrollTop", { value: 400, writable: true });
    fireEvent.scroll(mapContainer);

    // On /map, MAPUI-53 (bug fix) ties the bar to the sheet's full position
    // alone (TabBar.tsx), never to useHideOnScrollDown's scroll tracking —
    // so neither scroll, however they are read, ever hides it here.
    expect(tabBar).toHaveAttribute("aria-hidden", "false");
  });
});

// docs/specs/redesign-map.md (MAPUI-61, #133): dragging is never the only
// way to reach a position — the handle alone must still cycle through all
// three, and MAPUI-53's tab-bar rule must hold however the sheet got there.
describe("MapView — MAPUI-61 the handle alone reaches every position", () => {
  it("MAPUI-61: pressing the handle alone cycles middle -> full -> peeked -> middle, hiding the tab bar only at full", async () => {
    server.use(...onlyWallapop);
    stubPhoneWidth();

    renderWithI18n(
      <>
        <MapView initialQuery="case-handle-cycle" />
        <TabBar />
      </>,
      { locale: "es" },
    );
    await screen.findByText(WALLAPOP_TITLE);

    const handle = screen.getByRole("button", { name: "Lista de resultados" });
    const sheet = screen.getByTestId("results-sheet");
    const tabBar = screen.getByTestId("bottom-nav");
    expect(sheet).toHaveAttribute("data-position", "middle");
    expect(tabBar).toHaveAttribute("aria-hidden", "false");

    await userEvent.click(handle);
    expect(sheet).toHaveAttribute("data-position", "full");
    expect(tabBar).toHaveAttribute("aria-hidden", "true");

    await userEvent.click(handle);
    expect(sheet).toHaveAttribute("data-position", "peeked");
    expect(tabBar).toHaveAttribute("aria-hidden", "false");

    await userEvent.click(handle);
    expect(sheet).toHaveAttribute("data-position", "middle");
    expect(tabBar).toHaveAttribute("aria-hidden", "false");
  });
});

// docs/specs/redesign-map.md (MAPUI-62, #133).
describe("MapView — MAPUI-62 a map tap or pan lowers the sheet from middle to peeked", () => {
  it("MAPUI-62: a map interaction moves the sheet from middle to peeked, changes nothing at peeked, and a pin tap still reaches middle with that car first", async () => {
    server.use(...audiThenSeat);
    stubPhoneWidth();

    renderWithI18n(<MapView initialQuery="case-map-tap" />, { locale: "es" });
    await screen.findByText(WALLAPOP_TITLE);

    const sheet = screen.getByTestId("results-sheet");
    expect(sheet).toHaveAttribute("data-position", "middle");

    const tapMap = screen.getByRole("button", { name: "tap map" });
    await userEvent.click(tapMap);
    expect(sheet).toHaveAttribute("data-position", "peeked");

    // At peeked, a further map interaction changes nothing.
    await userEvent.click(tapMap);
    expect(sheet).toHaveAttribute("data-position", "peeked");

    // A pin tap still reaches middle with that car first (MAPUI-24), and
    // never lowers the sheet.
    await userEvent.click(screen.getByRole("button", { name: "tap pin wallapop-def456" }));
    expect(sheet).toHaveAttribute("data-position", "middle");
    const cards = within(sheet).getAllByRole("article");
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText(SEAT_TITLE)).toBeInTheDocument();
  });

  it("MAPUI-62: at desktop width the map gets no map-interaction handler", async () => {
    server.use(...audiThenSeat);

    renderWithI18n(<MapView initialQuery="case-desktop-map-tap" />, { locale: "es" });
    await screen.findByText(WALLAPOP_TITLE);

    expect(screen.getByTestId("listings-map")).toHaveAttribute("data-desktop", "true");
    expect(screen.queryByRole("button", { name: "tap map" })).not.toBeInTheDocument();
  });
});

describe("MapView — MAPUI-27 a pin at desktop width", () => {
  it("MAPUI-27: activating a pin marks it, outlines that car's card and scrolls the card into view", async () => {
    server.use(...audiThenSeat);
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");

    try {
      renderWithI18n(<MapView initialQuery="case-desktop-pin" />);
      await screen.findByText(SEAT_TITLE);
      scrollIntoView.mockClear();

      await userEvent.click(screen.getByRole("button", { name: "tap pin wallapop-def456" }));

      const seatCard = screen.getByText(SEAT_TITLE).closest("article");
      const audiCard = screen.getByText(WALLAPOP_TITLE).closest("article");
      expect(screen.getByTestId("listings-map")).toHaveAttribute(
        "data-active-id",
        "wallapop-def456",
      );
      expect(seatCard).toHaveAttribute("data-active", "true");
      expect(audiCard).not.toHaveAttribute("data-active");
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(seatCard);
    } finally {
      scrollIntoView.mockRestore();
    }
  });
});

describe("MapView — MAPUI-63 a quick filter on a phone", () => {
  it("MAPUI-63: on a phone, pressing Diesel in the top band searches again with engine=gasoil", async () => {
    stubPhoneWidth();
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-quick-filter-diesel" />);
    await screen.findByText(WALLAPOP_TITLE);

    // A quick filter applies at once, not through the panel's debounced path
    // (MAP-11): fake timers prove the search follows the click's microtasks
    // alone, with no 400ms wait.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole("button", { name: "Diesel" }));
      await act(async () => {
        // Empty on purpose: just flushing the microtasks the click above
        // queued before asserting on the search.
      });

      expect(lastSearch()).toMatchObject({ engine: ["gasoil"] });
    } finally {
      vi.useRealTimers();
    }
  });

  it("MAPUI-63: on a phone, after pressing Diesel in the band the filters dialog shows Diesel chosen and the badge reads 1", async () => {
    stubPhoneWidth();
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-quick-filter-diesel-dialog" />);
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(screen.getByRole("button", { name: "Diesel" }));
    await waitFor(() => expect(lastSearch()).toMatchObject({ engine: ["gasoil"] }));

    const filtersButton = phoneFiltersButton();
    expect(within(filtersButton).getByText("1", { exact: true })).toBeInTheDocument();
    await userEvent.click(filtersButton);

    const dialog = await screen.findByRole("dialog", { name: "FILTERS" });
    expect(within(dialog).getByRole("button", { name: "Diesel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("MAPUI-63: on a phone, choosing Manual in the filters dialog presses Manual in the band", async () => {
    stubPhoneWidth();
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-quick-filter-phone-gearbox" />);
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(phoneFiltersButton());
    const dialog = await screen.findByRole("dialog", { name: "FILTERS" });
    await userEvent.click(within(dialog).getByRole("radio", { name: "Manual" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Show cars" }));

    await waitFor(() => expect(lastSearch()).toMatchObject({ gearbox: ["manual"] }));
    expect(screen.getByRole("button", { name: "Manual" })).toHaveAttribute("aria-pressed", "true");
    const filtersButton = phoneFiltersButton();
    expect(within(filtersButton).getByText("1", { exact: true })).toBeInTheDocument();
  });
});

// docs/specs/redesign-map.md (MAPUI-63). The desktop quick filters live in
// the map header's second row (lib/hooks/useMapHeaderSlot.ts's filters
// slot), portalled there by HeaderSearch/FilterRow — so, like the header's
// own MAPUI-39 case above, these hand MapView a detached slot for both cells
// rather than rendering the whole layout.
describe("MapView — MAPUI-63 the desktop quick filters", () => {
  let headerSlot: HTMLDivElement;
  let filtersSlot: HTMLDivElement;

  beforeEach(() => {
    headerSlot = document.createElement("div");
    filtersSlot = document.createElement("div");
    document.body.append(headerSlot, filtersSlot);
    setMapHeaderSlot(headerSlot);
    setMapFiltersSlot(filtersSlot);
  });

  afterEach(() => {
    headerSlot.remove();
    filtersSlot.remove();
  });

  it("MAPUI-63: at desktop width, pressing Diesel in the header band searches again at once with engine=gasoil", async () => {
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-quick-filter-desktop-diesel" />);
    await screen.findByText(WALLAPOP_TITLE);

    // Below the 400ms MAP-11 debounce (lib/hooks/useSearchFilters.ts): a
    // quick filter applies at once, not through the panel's debounced path.
    // Fake timers prove the search follows the click's microtasks alone.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(within(filtersSlot).getByRole("button", { name: "Diesel" }));
      await act(async () => {
        // Empty on purpose: just flushing the microtasks the click above
        // queued before asserting on the search.
      });

      expect(lastSearch()).toMatchObject({ engine: ["gasoil"] });
      expect(within(filtersSlot).getByRole("button", { name: "Diesel" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("MAPUI-63: after pressing Diesel in the header band, the filters panel shows Diesel chosen and «Filters» reads 1", async () => {
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-quick-filter-desktop-panel" />);
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(within(filtersSlot).getByRole("button", { name: "Diesel" }));
    await waitFor(() => expect(lastSearch()).toMatchObject({ engine: ["gasoil"] }));

    const filtersButton = within(filtersSlot).getByRole("button", { name: "Filters" });
    expect(within(filtersButton).getByText("1", { exact: true })).toBeInTheDocument();
    await userEvent.click(filtersButton);

    const dropdown = await screen.findByRole("dialog", { name: "Filters" });
    expect(within(dropdown).getByRole("button", { name: "Diesel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("MAPUI-63: choosing «Manual» in the desktop filters panel presses «Manual» in the header band and releases «Automatic»", async () => {
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-quick-filter-desktop-gearbox" />, {
      searchParams: "gearbox=automatic",
    });
    await screen.findByText(WALLAPOP_TITLE);
    expect(within(filtersSlot).getByRole("button", { name: "Automatic" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(within(filtersSlot).getByRole("button", { name: "Filters" }));
    const dropdown = await screen.findByRole("dialog", { name: "Filters" });
    await userEvent.click(within(dropdown).getByRole("radio", { name: "Manual" }));

    await waitFor(() => expect(lastSearch()).toMatchObject({ gearbox: ["manual"] }));
    expect(within(filtersSlot).getByRole("button", { name: "Manual" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(filtersSlot).getByRole("button", { name: "Automatic" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("MAPUI-63: at desktop width, pressing the pressed «Automatic» clears the gearbox", async () => {
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-quick-filter-desktop-clear-gearbox" />, {
      searchParams: "gearbox=automatic",
    });
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(within(filtersSlot).getByRole("button", { name: "Automatic" }));

    await waitFor(() => expect(lastSearch()?.gearbox).toBeUndefined());
    expect(within(filtersSlot).getByRole("button", { name: "Automatic" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("MapView — MAPUI-24 the tapped car first", () => {
  it("MAPUI-24: tapping the second car's pin shows that car as the middle sheet's card", async () => {
    server.use(...audiThenSeat);
    stubPhoneWidth();

    renderWithI18n(<MapView initialQuery="case-tap-second-pin" />, { locale: "es" });
    // The middle sheet shows one card: the first car, until a pin says otherwise.
    expect(await screen.findByText(WALLAPOP_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(SEAT_TITLE)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "tap pin wallapop-def456" }));

    const sheet = screen.getByTestId("results-sheet");
    expect(sheet).toHaveAttribute("data-position", "middle");
    const cards = within(sheet).getAllByRole("article");
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText(SEAT_TITLE)).toBeInTheDocument();
  });
});

describe("MapView — MAPUI-46 Crear alerta signed out", () => {
  it("MAPUI-46: goes to /login with the full current map path and query, opens nothing and creates nothing", async () => {
    currentQuery.mockReturnValue("make=Toyota&maxPrice=20000");
    server.use(...onlyWallapop);

    renderWithI18n(<MapView initialQuery="case-alert-signed-out" />, { locale: "es" });
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(push).toHaveBeenCalledWith(
      "/login?callbackUrl=%2Fmap%3Fmake%3DToyota%26maxPrice%3D20000",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createAlert).not.toHaveBeenCalled();
  });

  it("MAPUI-39: signed in, Crear alerta opens the dialog and sends nobody to sign in", async () => {
    useSession.mockReturnValue({ data: { user: { id: "user-ada" } }, isPending: false });
    server.use(...onlyWallapop);

    renderWithI18n(<MapView initialQuery="case-alert-signed-in" />, { locale: "es" });
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(await screen.findByRole("dialog", { name: "CREAR ALERTA" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

const MADRID = "lat=40.4168&lng=-3.7038&placeId=1&locationName=Madrid";

describe("MapView — MAPUI-31 the empty state's actions", () => {
  it("MAPUI-31: «Ampliar a 100 km» searches again at 100 km", async () => {
    server.use(...nothingFound);
    renderWithI18n(<MapView initialQuery="case-widen" />, { locale: "es", searchParams: MADRID });

    await userEvent.click(await screen.findByRole("button", { name: "Ampliar a 100 km" }));

    await waitFor(() => expect(lastSearch()).toMatchObject({ distanceInKm: 100 }));
  });

  it("MAPUI-31: «Quitar filtros» clears every filter and the ?q= text, and keeps the place and the radius (worked example)", async () => {
    server.use(...nothingFound);
    const onUrlUpdate = vi.fn();
    renderWithI18n(<MapView initialQuery="case-clear-filters" />, {
      locale: "es",
      searchParams: `${MADRID}&radius=25&engine=gasoil&maxPrice=20000&q=case-clear-filters`,
      onUrlUpdate,
    });

    await userEvent.click(await screen.findByRole("button", { name: "Quitar filtros" }));

    await waitFor(() =>
      expect(Object.fromEntries(onUrlUpdate.mock.lastCall?.[0].searchParams ?? [])).toEqual({
        lat: "40.4168",
        lng: "-3.7038",
        placeId: "1",
        locationName: "Madrid",
        radius: "25",
      }),
    );
    await waitFor(() =>
      expect(lastSearch()).toMatchObject({
        latitude: 40.4168,
        longitude: -3.7038,
        distanceInKm: 25,
        keywords: "",
      }),
    );
    expect(lastSearch()?.engine).toBeUndefined();
    expect(lastSearch()?.maxPrice).toBeUndefined();
  });

  it("MAPUI-31: at 200 km there is no widen button, and neither the line nor the pill names a radius", async () => {
    server.use(...nothingFound);
    renderWithI18n(<MapView initialQuery="case-widest" />, {
      locale: "es",
      searchParams: `${MADRID}&radius=200`,
    });

    expect(await screen.findByText("Quita algún filtro")).toBeInTheDocument();
    expect(
      screen.getByText("Con estos filtros no hay coches. Prueba a quitar algún filtro."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ningún coche con estos filtros")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ampliar a/ })).not.toBeInTheDocument();
  });
});

describe("MapView — MAPUI-5 the national search's heading", () => {
  it("MAPUI-5: with no place, exhausted results are counted: «2 COCHES»", async () => {
    server.use(...audiThenSeat);
    renderWithI18n(<MapView initialQuery="case-national-count" />, { locale: "es" });

    expect(await screen.findByText("2 COCHES")).toBeInTheDocument();
  });
});

describe("MapView — MAPUI-33 the heading while a page is appended", () => {
  it("MAPUI-33: 40 listed with load-more running still reads «MÁS DE 40 COCHES» (worked example)", async () => {
    const firstPage = Array.from({ length: 40 }, (_, index) =>
      makeWallapopItem({ id: `forty-${index}`, title: `Coche ${index}` }),
    );
    server.use(
      ...onlyWallapop,
      http.get(WALLAPOP, async ({ request }) => {
        // The second page never lands: the load-more stays running.
        if (new URL(request.url).searchParams.get("next_page") !== null) await delay("infinite");
        return HttpResponse.json(makeWallapopResponse(firstPage, "page-2"));
      }),
    );
    renderWithI18n(<MapView initialQuery="case-forty-load-more" />, { locale: "es" });
    expect(await screen.findByText("MÁS DE 40 COCHES")).toBeInTheDocument();

    act(() => triggerIntersection());

    expect(await screen.findByText("Cargando…")).toBeInTheDocument();
    expect(screen.getByText("MÁS DE 40 COCHES")).toBeInTheDocument();
    expect(screen.queryByText("BUSCANDO COCHES…")).not.toBeInTheDocument();
  });
});

describe("MapView — MAPUI-31 the empty state with no filter (worked example)", () => {
  it("MAPUI-31: Madrid, 50 km, nothing else: «No hay coches en 50 km.», «Ampliar a 100 km» and no «Quitar filtros»", async () => {
    server.use(...nothingFound);
    renderWithI18n(<MapView />, { locale: "es", searchParams: `${MADRID}&radius=50` });

    expect(await screen.findByText("No hay coches en 50 km.")).toBeInTheDocument();
    expect(screen.getByText("¿Nada por aquí?")).toBeInTheDocument();
    expect(screen.getByText("Amplía el radio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ampliar a 100 km" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).not.toBeInTheDocument();
    expect(screen.getByText("Ningún coche en 50 km")).toBeInTheDocument();
  });

  it("MAPUI-31: Madrid, 200 km, nothing else: «Toda España» clears the place for a national search", async () => {
    server.use(...nothingFound);
    const onUrlUpdate = vi.fn();
    renderWithI18n(<MapView />, {
      locale: "es",
      searchParams: `${MADRID}&radius=200`,
      onUrlUpdate,
    });

    expect(await screen.findByText("No hay coches en 200 km.")).toBeInTheDocument();
    expect(screen.getByText("Ningún coche en 200 km")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ampliar a/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Toda España" }));

    await waitFor(() => expect(lastSearch()?.latitude).toBeUndefined());
    expect(lastSearch()?.longitude).toBeUndefined();
    const lastUrl = Object.fromEntries(onUrlUpdate.mock.lastCall?.[0].searchParams ?? []);
    expect(lastUrl).not.toHaveProperty("lat");
    expect(lastUrl).not.toHaveProperty("locationName");
  });

  it("MAPUI-31/MAPUI-32: no place, no filter and no car in all of Spain shows the failed-search state", async () => {
    server.use(...nothingFound);
    renderWithI18n(<MapView />, { locale: "es" });

    expect(await screen.findByText("¿Se ha caído algo?")).toBeInTheDocument();
    expect(
      screen.getByText("No hemos podido traer los anuncios. Suele ser cosa de un momento."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByText("Sin conexión con los anuncios")).toBeInTheDocument();
    expect(screen.queryByText("¿Nada por aquí?")).not.toBeInTheDocument();
  });
});

/**
 * The phone «Filters», which opens the full-screen filters dialog (MAPUI-67):
 * the round button carries the real accessible name itself. The desktop one,
 * also in the DOM, is Radix's popover trigger, which carries `data-state`;
 * the phone one is a plain button. Rendered at the default English locale so
 * "Filters" is the exact name (map.filters), as the test below asserts
 * literally.
 */
function phoneFiltersButton(): HTMLElement {
  const button = screen
    .getAllByRole("button", { name: "Filters" })
    .find((candidate) => !candidate.hasAttribute("data-state"));
  if (!button) throw new Error("The phone «Filters» did not render.");
  return button;
}

describe("MapView — the phone dialogs give the focus back to their opener", () => {
  it("MAPUI-21: closing the «BUSCAR» sheet focuses the search summary again", async () => {
    server.use(...onlyWallapop);
    stubPhoneWidth();
    renderWithI18n(<MapView initialQuery="case-focus-search-sheet" />, { locale: "es" });
    await screen.findByText(WALLAPOP_TITLE);
    const opener = screen.getByRole("button", { name: /Toda España/ });

    await userEvent.click(opener);
    expect(await screen.findByRole("dialog", { name: "BUSCAR" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("MAPUI-22: «Filters» announces its dialog, and closing the dialog focuses «Filters» again", async () => {
    server.use(...onlyWallapop);
    stubPhoneWidth();
    renderWithI18n(<MapView initialQuery="case-focus-filters" />);
    await screen.findByText(WALLAPOP_TITLE);
    const opener = phoneFiltersButton();
    expect(opener).toHaveAttribute("aria-haspopup", "dialog");
    expect(opener).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(opener);
    expect(await screen.findByRole("dialog", { name: "FILTERS" })).toBeInTheDocument();
    expect(opener).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "false");
  });

  it("MAPUI-39: closing the «Crear alerta» sheet focuses the sheet's «Crear alerta» again", async () => {
    useSession.mockReturnValue({ data: { user: { id: "user-ada" } }, isPending: false });
    server.use(...onlyWallapop);
    stubPhoneWidth();
    renderWithI18n(<MapView initialQuery="case-focus-create-alert" />, { locale: "es" });
    await screen.findByText(WALLAPOP_TITLE);
    const opener = screen.getByRole("button", { name: "Crear alerta" });

    await userEvent.click(opener);
    expect(await screen.findByRole("dialog", { name: "CREAR ALERTA" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
});

// docs/specs/map-and-search.md (MAP-28 to MAP-35, issue #117): while the
// browser's position stands in for a chosen place, it reads «Your location»
// everywhere a place would, the radius choices work around it, and it never
// shows up as a deep-linked place would (no URL, MAP-33, covered at the hook
// level in lib/hooks/useSearchFilters.test.tsx). The desktop pill only
// renders through the map header's portalled slot (useMapHeaderSlot), as the
// MAPUI-39 and MAPUI-63 cases above already set up by hand.
describe("MapView with the browser's position (issue #117)", () => {
  let headerSlot: HTMLDivElement;

  beforeEach(() => {
    geo.position = { lat: 40.42, lng: -3.7 };
    headerSlot = document.createElement("div");
    document.body.appendChild(headerSlot);
    setMapHeaderSlot(headerSlot);
  });

  afterEach(() => {
    headerSlot.remove();
    geo.wait = Promise.resolve();
    geo.position = null;
  });

  it("MAP-32: the pill and the phone summary read «Your location · 50 km»", async () => {
    server.use(...onlyWallapop);
    const { container } = renderWithI18n(<MapView initialQuery="case-geo-pill" />);
    await screen.findByText(WALLAPOP_TITLE);

    expect(
      within(headerSlot).getByRole("button", { name: "Your location · 50 km" }),
    ).toBeInTheDocument();
    // The phone search summary sits in the DOM at every width (jsdom ignores
    // the `lg:hidden` breakpoint that hides it at desktop width), so it is
    // reachable without stubbing the phone width.
    expect(
      within(container).getByRole("button", { name: /Your location · 50 km/ }),
    ).toBeInTheDocument();
  });

  it("MAP-32: the radius choices are enabled and apply around the position", async () => {
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-geo-radius" />);
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(
      within(headerSlot).getByRole("button", { name: "Your location · 50 km" }),
    );
    const choice = await screen.findByRole("radio", { name: "100 km" });
    expect(choice).not.toBeDisabled();

    await userEvent.click(choice);

    await waitFor(() =>
      expect(lastSearch()).toMatchObject({ latitude: 40.42, longitude: -3.7, distanceInKm: 100 }),
    );
  });

  it("MAP-32: an empty result offers the wider radius", async () => {
    server.use(...nothingFound);
    renderWithI18n(<MapView initialQuery="case-geo-empty" />, { locale: "es" });

    // Same widen button MAPUI-31 asserts for a chosen place at 50 km.
    expect(await screen.findByRole("button", { name: "Ampliar a 100 km" })).toBeInTheDocument();
  });

  it("MAP-32: «All of Spain» clears the position and runs the national search", async () => {
    server.use(...onlyWallapop);
    const { container } = renderWithI18n(<MapView initialQuery="case-geo-all-spain" />);
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(
      within(headerSlot).getByRole("button", { name: "Your location · 50 km" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "All of Spain" }));

    await waitFor(() => expect(lastSearch()?.latitude).toBeUndefined());
    expect(lastSearch()?.longitude).toBeUndefined();
    expect(within(container).queryByText(/Your location/)).not.toBeInTheDocument();
    expect(screen.getByTestId("listings-map")).toHaveAttribute("data-zone", "");
  });

  it("MAP-28: on a phone, «Ver coches» with «Dónde» untouched keeps the position", async () => {
    stubPhoneWidth();
    server.use(...onlyWallapop);
    const { container } = renderWithI18n(<MapView initialQuery="case-geo-phone-show-cars" />);
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(within(container).getByRole("button", { name: /Your location · 50 km/ }));
    const dialog = await screen.findByRole("dialog", { name: "SEARCH" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Show cars" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(lastSearch()).toMatchObject({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 });
    expect(
      within(container).getByRole("button", { name: /Your location · 50 km/ }),
    ).toBeInTheDocument();
  });

  it("MAP-28: on a phone, a «BUSCAR» sheet opened before the position arrives keeps it on «Ver coches»", async () => {
    stubPhoneWidth();
    let answer: () => void = () => undefined;
    geo.wait = new Promise<void>((resolve) => {
      answer = resolve;
    });
    server.use(...onlyWallapop);
    const { container } = renderWithI18n(<MapView initialQuery="case-geo-phone-sheet-early" />);
    await screen.findByText(WALLAPOP_TITLE);

    // The browser has not answered yet: the national search, and a sheet with no place.
    await userEvent.click(within(container).getByRole("button", { name: /All of Spain/ }));
    const dialog = await screen.findByRole("dialog", { name: "SEARCH" });

    await act(async () => {
      answer();
      await geo.wait;
    });
    await waitFor(() =>
      expect(lastSearch()).toMatchObject({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 }),
    );

    await userEvent.click(within(dialog).getByRole("button", { name: "Show cars" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(lastSearch()).toMatchObject({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 });
    expect(
      within(container).getByRole("button", { name: /Your location · 50 km/ }),
    ).toBeInTheDocument();
  });

  it("MAP-32: on a phone, the place field's × clears «Your location»", async () => {
    stubPhoneWidth();
    server.use(...onlyWallapop);
    const { container } = renderWithI18n(<MapView initialQuery="case-geo-phone-clear-text" />);
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(within(container).getByRole("button", { name: /Your location · 50 km/ }));
    const dialog = await screen.findByRole("dialog", { name: "SEARCH" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Clear text" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Show cars" }));

    await waitFor(() => expect(lastSearch()?.latitude).toBeUndefined());
    expect(lastSearch()?.longitude).toBeUndefined();
    expect(screen.getByTestId("listings-map")).toHaveAttribute("data-zone", "");
  });

  it("MAP-34: the map is handed the 50 km zone around the position", async () => {
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-geo-zone" />);
    await screen.findByText(WALLAPOP_TITLE);

    expect(screen.getByTestId("listings-map")).toHaveAttribute(
      "data-zone",
      JSON.stringify({ lat: 40.42, lng: -3.7, radiusKm: 50 }),
    );
  });

  it("MAP-34: the map is still handed the 50 km zone around the position with no results", async () => {
    server.use(...nothingFound);
    renderWithI18n(<MapView initialQuery="case-geo-zone-empty" />, { locale: "es" });
    await screen.findByText("¿Nada por aquí?");

    expect(screen.getByTestId("listings-map")).toHaveAttribute(
      "data-zone",
      JSON.stringify({ lat: 40.42, lng: -3.7, radiusKm: 50 }),
    );
  });

  it("MAP-34: a place chosen in the URL hands the map no zone", async () => {
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-geo-zone-url-place" />, { searchParams: MADRID });
    await screen.findByText(WALLAPOP_TITLE);

    expect(screen.getByTestId("listings-map")).toHaveAttribute("data-zone", "");
  });

  it("MAP-36: «Crear alerta» from the position stores no place name and its summary ends with «50 km»", async () => {
    useSession.mockReturnValue({ data: { user: { id: "user-ada" } }, isPending: false });
    vi.mocked(createAlert).mockResolvedValue({ ok: true, value: { created: true } });
    server.use(...onlyWallapop);
    const { container } = renderWithI18n(<MapView initialQuery="case-geo-alert" />, {
      locale: "es",
      searchParams: "make=Toyota&model=Corolla",
    });
    // No Toyota Corolla among the fixture listings: the search, not its results, is what matters.
    await waitFor(() =>
      expect(lastSearch()).toMatchObject({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 }),
    );

    // The results area's own «Crear alerta», which opens it as a dialog at every width in jsdom.
    await userEvent.click(within(container).getByRole("button", { name: "Crear alerta" }));
    const dialog = await screen.findByRole("dialog", { name: "CREAR ALERTA" });

    // getByText reads the no-break space before «km» as a plain one, so the
    // exact text is asserted on the element it finds.
    const summary = within(dialog).getByText("Toyota Corolla · Cualquier precio · 50 km");
    expect(summary.textContent).toBe("Toyota Corolla · Cualquier precio · 50 km");
    expect(within(dialog).getByRole("textbox", { name: /nombre/i })).toHaveValue("Toyota Corolla");

    await userEvent.click(within(dialog).getByRole("button", { name: "Crear alerta" }));

    await waitFor(() => expect(createAlert).toHaveBeenCalledTimes(1));
    const [criteria, label, placeName] = vi.mocked(createAlert).mock.calls[0];
    expect(criteria).toMatchObject({
      brand: "Toyota",
      model: "Corolla",
      latitude: 40.42,
      longitude: -3.7,
      distanceInKm: 50,
    });
    expect(label).toBe("Toyota Corolla");
    expect(placeName).toBeUndefined();
  });

  it("MAP-36: «Crear alerta» with a chosen place still stores its name", async () => {
    useSession.mockReturnValue({ data: { user: { id: "user-ada" } }, isPending: false });
    vi.mocked(createAlert).mockResolvedValue({ ok: true, value: { created: true } });
    server.use(...onlyWallapop);
    const { container } = renderWithI18n(<MapView initialQuery="case-place-alert" />, {
      locale: "es",
      searchParams: MADRID,
    });
    await waitFor(() =>
      expect(lastSearch()).toMatchObject({ latitude: 40.4168, longitude: -3.7038 }),
    );

    await userEvent.click(within(container).getByRole("button", { name: "Crear alerta" }));
    const dialog = await screen.findByRole("dialog", { name: "CREAR ALERTA" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear alerta" }));

    await waitFor(() => expect(createAlert).toHaveBeenCalledTimes(1));
    const [, , placeName] = vi.mocked(createAlert).mock.calls[0];
    expect(placeName).toBe("Madrid");
  });

  it("MAP-31: «Toda España» chosen before the position arrives keeps the pill on «Toda España»", async () => {
    let answer: () => void = () => undefined;
    geo.wait = new Promise<void>((resolve) => {
      answer = resolve;
    });
    vi.mocked(searchListings).mockClear();
    server.use(...onlyWallapop);
    const { container } = renderWithI18n(<MapView initialQuery="case-geo-all-spain-pending" />, {
      locale: "es",
    });
    await screen.findByText(WALLAPOP_TITLE);

    // The browser has not answered yet: the pill has no place, and reads its placeholder.
    await userEvent.click(
      within(headerSlot).getByRole("button", { name: "Ciudad o código postal…" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Toda España" }));

    await act(async () => {
      answer();
      await geo.wait;
    });

    const withLatitude = vi
      .mocked(searchListings)
      .mock.calls.filter(([input]) => input.latitude !== undefined);
    expect(withLatitude).toEqual([]);
    expect(
      within(headerSlot).getByRole("button", { name: "Ciudad o código postal…" }),
    ).toBeInTheDocument();
    expect(within(headerSlot).queryByText(/Tu ubicación/)).not.toBeInTheDocument();
    // The phone summary keeps its no-place reading too: «Toda España» over the car and price.
    expect(
      within(container).getByRole("button", { name: /Toda España.*Cualquier marca/ }),
    ).toBeInTheDocument();
    expect(within(container).queryByText(/Tu ubicación/)).not.toBeInTheDocument();
  });

  it("MAP-32: on the desktop, the place field's × on «Your location» only clears the text", async () => {
    vi.mocked(searchListings).mockClear();
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-geo-desktop-clear-text" />);
    await screen.findByText(WALLAPOP_TITLE);
    await waitFor(() =>
      expect(lastSearch()).toMatchObject({ latitude: 40.42, longitude: -3.7, distanceInKm: 50 }),
    );

    const searchesBefore = vi.mocked(searchListings).mock.calls.length;

    await userEvent.click(
      within(headerSlot).getByRole("button", { name: "Your location · 50 km" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Clear text" }));
    await userEvent.keyboard("{Escape}");

    // The × sent no national search: every search after it still has the position.
    const withoutLatitude = vi
      .mocked(searchListings)
      .mock.calls.slice(searchesBefore)
      .filter(([input]) => input.latitude === undefined);
    expect(withoutLatitude).toEqual([]);
    const pill = within(headerSlot).getByRole("button", { name: "Your location · 50 km" });
    expect(pill.textContent).toContain("Your location · 50 km");
  });

  it("MAP-34: the zone follows the radius chosen around the position", async () => {
    server.use(...onlyWallapop);
    renderWithI18n(<MapView initialQuery="case-geo-zone-radius" />);
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.click(
      within(headerSlot).getByRole("button", { name: "Your location · 50 km" }),
    );
    await userEvent.click(await screen.findByRole("radio", { name: "100 km" }));

    await waitFor(() =>
      expect(screen.getByTestId("listings-map")).toHaveAttribute(
        "data-zone",
        JSON.stringify({ lat: 40.42, lng: -3.7, radiusKm: 100 }),
      ),
    );
  });
});
