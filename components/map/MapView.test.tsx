import { describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { renderWithI18n } from "@/test/utils/render";
import { makeWallapopItem, makeWallapopResponse } from "@/test/fixtures/wallapop";
import { makeCochesNetResponse } from "@/test/fixtures/cochesnet";
import { makeMilanunciosResponse } from "@/test/fixtures/milanuncios";
import { triggerIntersection } from "@/test/mocks/intersection-observer";
import { makeFavoriteInput } from "@/test/fixtures/favorites";
import { listFavorites } from "@/app/actions/favorites";
import { MapView } from "./MapView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/map",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// CarListingCard reads the session to decide what its favorite control does,
// and calls the favorites actions. Neither is what these tests are about.
// Typed so a test can widen it to an authenticated session; inferring from the
// default would pin `data` to null.
const useSession = vi.fn<
  () => { data: { user: { id: string } } | null; status: string }
>(() => ({ data: null, status: "unauthenticated" }));
vi.mock("next-auth/react", () => ({ useSession: () => useSession() }));
vi.mock("@/app/actions/favorites", () => ({
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  listFavorites: vi.fn(async () => ({ success: true, data: [] })),
}));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

// Leaflet cannot run in jsdom. MapView loads the map through next/dynamic, so
// the stub stands in for the whole module and reports what it was handed.
vi.mock("@/components/map/ListingsMap", () => ({
  ListingsMap: ({ listings }: { listings: { id: string }[] }) => (
    <div data-testid="listings-map" data-count={listings.length} />
  ),
}));

// lib/wallapop/cache.ts is a module-level Map keyed by the search params and
// lives for the whole file. Every case therefore opens MapView with its own
// query, which is both the cache key and the keyword sent upstream.
const WALLAPOP_TITLE = "Audi A3 2.0 TDI";

// Narrow the search to Wallapop so a case can control a single source.
const onlyWallapop = [
  http.post("*/api/cochesnet/search", () =>
    HttpResponse.json(makeCochesNetResponse([], 0)),
  ),
  http.get("*/api/milanuncios/search", () =>
    HttpResponse.json(makeMilanunciosResponse([], 0)),
  ),
];

// Records the keywords of every Wallapop call so a case can assert what the
// filters actually sent.
function captureWallapopKeywords(response: () => Response) {
  const keywords: (string | null)[] = [];
  server.use(
    ...onlyWallapop,
    http.get("*/api/wallapop/search", ({ request }) => {
      keywords.push(new URL(request.url).searchParams.get("keywords"));
      return response();
    }),
  );
  return keywords;
}

describe("MapView results", () => {
  it("renders what the sources return", async () => {
    renderWithI18n(<MapView initialQuery="case-all-sources" />);

    expect(await screen.findByText(WALLAPOP_TITLE)).toBeInTheDocument();
    // One card per source: the default handlers return one item each.
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("MAP-15: shows the empty state when no source has anything", async () => {
    server.use(
      ...onlyWallapop,
      http.get("*/api/wallapop/search", () =>
        HttpResponse.json(makeWallapopResponse([], null)),
      ),
    );

    renderWithI18n(<MapView initialQuery="case-empty" />);

    expect(
      await screen.findByText("Search for cars to see results"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("MAP-15: hands the same listings to the map", async () => {
    renderWithI18n(<MapView initialQuery="case-map-sync" />);

    await screen.findByText(WALLAPOP_TITLE);

    await waitFor(() =>
      expect(screen.getByTestId("listings-map")).toHaveAttribute(
        "data-count",
        "3",
      ),
    );
  });
});

describe("MapView searching", () => {
  it("starts from the query the page was opened with", async () => {
    const keywords = captureWallapopKeywords(() =>
      HttpResponse.json(makeWallapopResponse([makeWallapopItem()], null)),
    );

    renderWithI18n(<MapView initialQuery="case-initial-query" />);

    await waitFor(() => expect(keywords[0]).toBe("case-initial-query"));
    expect(screen.getByRole("textbox")).toHaveValue("case-initial-query");
  });

  it("sends the keywords the user typed", async () => {
    const keywords = captureWallapopKeywords(() =>
      HttpResponse.json(makeWallapopResponse([makeWallapopItem()], null)),
    );
    renderWithI18n(<MapView initialQuery="case-typed-query" />);
    await screen.findByText(WALLAPOP_TITLE);

    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "golf");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(keywords.at(-1)).toBe("golf"));
  });
});

describe("MapView infinite scroll", () => {
  it("MAP-8: appends the next page when the sentinel comes into view", async () => {
    server.use(
      ...onlyWallapop,
      http.get("*/api/wallapop/search", ({ request }) => {
        const isNextPage =
          new URL(request.url).searchParams.get("next_page") !== null;
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
      http.get("*/api/wallapop/search", () => {
        calls += 1;
        return HttpResponse.json(
          makeWallapopResponse([makeWallapopItem()], null),
        );
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

describe("MapView mobile map", () => {
  it("opens the map overlay and closes it again", async () => {
    renderWithI18n(<MapView initialQuery="case-mobile-map" />);
    await screen.findByText(WALLAPOP_TITLE);

    expect(screen.getAllByTestId("listings-map")).toHaveLength(1);

    await userEvent.click(
      screen.getByRole("button", { name: "Explore the map" }),
    );
    expect(screen.getAllByTestId("listings-map")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Close map" }));
    expect(screen.getAllByTestId("listings-map")).toHaveLength(1);
  });
});

describe("MapView favorites", () => {
  it("FAV-16: shows an already-saved listing as saved in the results", async () => {
    useSession.mockReturnValue({
      data: { user: { id: "user-ada" } },
      status: "authenticated",
    });
    // The Wallapop fixture normalises to this id.
    vi.mocked(listFavorites).mockResolvedValue({
      success: true,
      data: [makeFavoriteInput({ id: "wallapop-abc123" })],
    });

    renderWithI18n(<MapView initialQuery="case-saved-listing" />);
    await screen.findByText(WALLAPOP_TITLE);

    // Before this criterion existed, MapView passed no isFavorite at all, so a
    // saved car came back from a search looking unsaved.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove from favorites" }),
      ).toBeInTheDocument(),
    );
  });

  it("FAV-16: leaves listings unsaved for a signed-out visitor", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    // Call history accumulates across this file; the assertion below is about
    // what this render did, not what the previous test did.
    vi.mocked(listFavorites).mockClear();

    renderWithI18n(<MapView initialQuery="case-signed-out" />);
    await screen.findByText(WALLAPOP_TITLE);

    expect(
      screen.queryByRole("button", { name: "Remove from favorites" }),
    ).not.toBeInTheDocument();
    expect(listFavorites).not.toHaveBeenCalled();
  });
});
