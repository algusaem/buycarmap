import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFavoriteStore,
  makeFavoriteInput,
} from "@/test/fixtures/favorites";

// The store is created per test in beforeEach; this indirection lets the module
// mock reach whichever one is current.
let store: ReturnType<typeof createFavoriteStore>;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    favorite: {
      create: (args: never) => store.client.create(args),
      upsert: (args: never) => store.client.upsert(args),
      deleteMany: (args: never) => store.client.deleteMany(args),
      findMany: (args: never) => store.client.findMany(args),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/session";
import { listFavorites, removeFavorite, saveFavorite } from "./favorites";

const ADA = { id: "user-ada", email: "ada@example.com" };
const GRACE = { id: "user-grace", email: "grace@example.com" };

function signedInAs(user: { id: string; email: string }) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

function signedOut() {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
}

beforeEach(() => {
  store = createFavoriteStore();
  vi.mocked(getCurrentUser).mockReset();
});

describe("saveFavorite", () => {
  it("FAV-1: records a saved listing against the signed-in user", async () => {
    signedInAs(ADA);
    const listing = makeFavoriteInput();

    const result = await saveFavorite(listing);

    expect(result.success).toBe(true);
    const stored = store.forUser(ADA.id);
    expect(stored).toHaveLength(1);
    // The snapshot is the point (spec §4): the row has to be renderable on its
    // own, without asking Wallapop anything.
    expect(stored[0]).toMatchObject({
      listingId: "wallapop-abc123",
      title: "Audi A3 2.0 TDI",
      price: 14500,
      mileage: 95000,
      source: "Wallapop",
      url: "https://es.wallapop.com/item/audi-a3-abc123",
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it("FAV-1: the saved listing is still readable on a later request", async () => {
    signedInAs(ADA);
    await saveFavorite(makeFavoriteInput());

    const result = await listFavorites();

    expect(result.data?.map((row) => row.id)).toEqual(["wallapop-abc123"]);
  });

  it("FAV-2: saving the same listing twice leaves exactly one record", async () => {
    signedInAs(ADA);
    const listing = makeFavoriteInput();

    const first = await saveFavorite(listing);
    const second = await saveFavorite(listing);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(store.forUser(ADA.id)).toHaveLength(1);
  });

  it("FAV-5: a caller with no session saves nothing", async () => {
    signedOut();

    const result = await saveFavorite(makeFavoriteInput());

    expect(result).toEqual({ success: false, error: "unauthenticated" });
    expect(store.all()).toHaveLength(0);
  });

  it("FAV-7: rejects a listing with a blank id and writes nothing", async () => {
    signedInAs(ADA);

    const result = await saveFavorite(makeFavoriteInput({ id: "   " }));

    expect(result).toEqual({ success: false, error: "invalidListing" });
    expect(store.all()).toHaveLength(0);
  });

  it("FAV-7: rejects a listing from an unrecognised source", async () => {
    signedInAs(ADA);

    const result = await saveFavorite(
      makeFavoriteInput({ source: "Craigslist" }),
    );

    expect(result).toEqual({ success: false, error: "invalidListing" });
    expect(store.all()).toHaveLength(0);
  });

  it("FAV-7: rejects a listing with no title", async () => {
    signedInAs(ADA);

    const result = await saveFavorite(makeFavoriteInput({ title: "" }));

    expect(result).toEqual({ success: false, error: "invalidListing" });
    expect(store.all()).toHaveLength(0);
  });
});

describe("removeFavorite", () => {
  it("FAV-3: removes the listing and leaves the user's others alone", async () => {
    signedInAs(ADA);
    await saveFavorite(makeFavoriteInput());
    await saveFavorite(
      makeFavoriteInput({ id: "cochesnet-99", source: "Coches.net" }),
    );

    const result = await removeFavorite("wallapop-abc123");

    expect(result.success).toBe(true);
    expect(store.forUser(ADA.id).map((row) => row.listingId)).toEqual([
      "cochesnet-99",
    ]);
  });

  it("FAV-4: removing something that was never saved reports success", async () => {
    signedInAs(ADA);

    const result = await removeFavorite("wallapop-never-saved");

    expect(result).toEqual({ success: true });
  });

  it("FAV-5: a caller with no session removes nothing", async () => {
    store.seedFor(ADA.id, makeFavoriteInput());
    signedOut();

    const result = await removeFavorite("wallapop-abc123");

    expect(result).toEqual({ success: false, error: "unauthenticated" });
    expect(store.forUser(ADA.id)).toHaveLength(1);
  });

  it("FAV-6: one user cannot remove another user's saved listing", async () => {
    store.seedFor(ADA.id, makeFavoriteInput());
    signedInAs(GRACE);

    const result = await removeFavorite("wallapop-abc123");

    // Grace is told nothing went wrong - she has no such favorite, and whether
    // Ada does is none of her business - but Ada's row survives.
    expect(result.success).toBe(true);
    expect(store.forUser(ADA.id)).toHaveLength(1);
  });
});

describe("listFavorites", () => {
  it("FAV-8: returns only the caller's own saved listings", async () => {
    store.seedFor(GRACE.id, makeFavoriteInput({ id: "wallapop-graces-car" }));
    signedInAs(ADA);
    await saveFavorite(makeFavoriteInput());

    const result = await listFavorites();

    expect(result.data?.map((row) => row.id)).toEqual(["wallapop-abc123"]);
  });

  it("FAV-8: returns them newest first", async () => {
    signedInAs(ADA);
    await saveFavorite(makeFavoriteInput({ id: "wallapop-first" }));
    await saveFavorite(makeFavoriteInput({ id: "wallapop-second" }));
    await saveFavorite(makeFavoriteInput({ id: "wallapop-third" }));

    const result = await listFavorites();

    expect(result.data?.map((row) => row.id)).toEqual([
      "wallapop-third",
      "wallapop-second",
      "wallapop-first",
    ]);
  });

  it("FAV-8: an empty list is a success, not an error", async () => {
    signedInAs(ADA);

    const result = await listFavorites();

    expect(result).toEqual({ success: true, data: [] });
  });

  it("FAV-5: a caller with no session gets nothing back", async () => {
    store.seedFor(ADA.id, makeFavoriteInput());
    signedOut();

    const result = await listFavorites();

    expect(result).toEqual({ success: false, error: "unauthenticated" });
  });
});
