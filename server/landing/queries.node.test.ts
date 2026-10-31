import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CarListing } from "@/interfaces/listing";

// docs/specs/redesign-entry.md (ENTRY-35, ENTRY-36). getLandingPool wraps one
// searchRound({}, EMPTY_SEARCH_CURSORS) call in unstable_cache(["landing-pool"],
// { revalidate: 3600 }), filters to listings with a photo and a price, and
// THROWS when none remain so an empty result is never cached; getLandingPool
// itself catches that and resolves to []. searchRound (server/search/service.ts)
// is the boundary mocked here — it is the one server-side fan-out to the three
// marketplaces (FRONT-1), so MSW is not needed. unstable_cache is mocked as a
// passthrough that still records its call, so the function it wraps (the one
// that throws) can be exercised directly from that recorded call.
vi.mock("next/cache", () => ({ unstable_cache: vi.fn((fn: unknown) => fn) }));
vi.mock("@/server/search/service", () => ({ searchRound: vi.fn() }));

import { unstable_cache } from "next/cache";
import { EMPTY_SEARCH_CURSORS } from "@/server/search/schema";
import { searchRound } from "@/server/search/service";
import { getLandingPool, getPreviewListings } from "./queries";

function listing(overrides: Partial<CarListing> = {}): CarListing {
  return {
    id: "wallapop-1",
    image: "https://cdn.wallapop.com/img1-big.jpg",
    title: "Audi A3 2.0 TDI",
    subtitle: "",
    price: 14500,
    mileage: 95000,
    year: 2018,
    fuel: "gasoil",
    brand: "Audi",
    model: "A3",
    location: "Madrid",
    source: "Wallapop",
    lat: 40.4168,
    lng: -3.7038,
    url: "https://es.wallapop.com/item/audi-a3-1",
    ...overrides,
  };
}

const NO_MORE = { Wallapop: false, "Coches.net": false, Milanuncios: false } as const;

const mockedSearchRound = vi.mocked(searchRound);

beforeEach(() => {
  // Only searchRound is reset between tests. unstable_cache is never cleared:
  // it is called once, at this file's import of server/landing/queries.ts, and
  // that one recorded call is what the "revalidate" and "the cached function
  // itself" cases below read.
  mockedSearchRound.mockReset();
});

describe("ENTRY-35: getLandingPool", () => {
  it("ENTRY-35: calls searchRound once, with {} and EMPTY_SEARCH_CURSORS", async () => {
    mockedSearchRound.mockResolvedValue({
      listings: [listing()],
      cursors: EMPTY_SEARCH_CURSORS,
      hasMore: NO_MORE,
      failedSources: [],
    });

    await getLandingPool();

    expect(mockedSearchRound).toHaveBeenCalledTimes(1);
    expect(mockedSearchRound).toHaveBeenCalledWith({}, EMPTY_SEARCH_CURSORS);
  });

  it("ENTRY-35: keeps only the listings with a photo and a price (3 in, 1 out)", async () => {
    const kept1 = listing({
      id: "kept-1",
      image: "https://cdn.wallapop.com/kept-1.jpg",
      price: 9400,
    });
    const droppedNoPrice = listing({
      id: "dropped-no-price",
      image: "https://cdn.wallapop.com/dropped.jpg",
      price: 0,
    });
    const kept2 = listing({
      id: "kept-2",
      image: "https://cdn.wallapop.com/kept-2.jpg",
      price: 14500,
    });
    const kept3 = listing({
      id: "kept-3",
      image: "https://cdn.wallapop.com/kept-3.jpg",
      price: 16500,
    });

    mockedSearchRound.mockResolvedValue({
      listings: [kept1, droppedNoPrice, kept2, kept3],
      cursors: EMPTY_SEARCH_CURSORS,
      hasMore: NO_MORE,
      failedSources: [],
    });

    const pool = await getLandingPool();

    expect(pool.map((item) => item.id)).toEqual(["kept-1", "kept-2", "kept-3"]);
  });

  it("ENTRY-35: unstable_cache was called with the landing-pool key and a one-hour revalidate", () => {
    const recordedCall = vi.mocked(unstable_cache).mock.calls[0];
    expect(recordedCall?.[1]).toEqual(["landing-pool"]);
    expect(recordedCall?.[2]).toEqual({ revalidate: 3600 });
  });
});

describe("ENTRY-36: getLandingPool on a failed search or an empty pool", () => {
  it("ENTRY-36: searchRound rejecting resolves to [], and the cached function itself rejects (proving emptiness is not cached)", async () => {
    mockedSearchRound.mockRejectedValue(new Error("upstream down"));

    await expect(getLandingPool()).resolves.toEqual([]);

    const cachedFn = vi.mocked(unstable_cache).mock.calls[0]?.[0] as
      | (() => Promise<CarListing[]>)
      | undefined;
    await expect(
      (async () => {
        if (!cachedFn) throw new Error("unstable_cache was never called");
        return cachedFn();
      })(),
    ).rejects.toThrow();
  });

  it("ENTRY-36: no listing with both a photo and a price resolves to [], and the cached function itself rejects (proving emptiness is not cached)", async () => {
    mockedSearchRound.mockResolvedValue({
      listings: [listing({ image: "" }), listing({ id: "no-price", price: 0 })],
      cursors: EMPTY_SEARCH_CURSORS,
      hasMore: NO_MORE,
      failedSources: [],
    });

    await expect(getLandingPool()).resolves.toEqual([]);

    const cachedFn = vi.mocked(unstable_cache).mock.calls[0]?.[0] as
      | (() => Promise<CarListing[]>)
      | undefined;
    await expect(
      (async () => {
        if (!cachedFn) throw new Error("unstable_cache was never called");
        return cachedFn();
      })(),
    ).rejects.toThrow();
  });
});

describe("ENTRY-34: getPreviewListings", () => {
  it("ENTRY-34: getPreviewListings hands back the whole pool, the picked listing first", async () => {
    const first = listing({ id: "pool-1", price: 14500 });
    const second = listing({ id: "pool-2", price: 9400 });
    const third = listing({ id: "pool-3", price: 16500 });

    mockedSearchRound.mockResolvedValue({
      listings: [first, second, third],
      cursors: EMPTY_SEARCH_CURSORS,
      hasMore: NO_MORE,
      failedSources: [],
    });

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    const picked = await getPreviewListings();

    expect(picked.map((item) => item.price)).toEqual([9400, 14500, 16500]);

    randomSpy.mockRestore();
  });
});
