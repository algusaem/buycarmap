import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { makeFavoriteInput } from "@/test/fixtures/favorites";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/session";
import { listFavorites, removeFavorite, saveFavorite } from "./actions";

let ADA: { id: string; email: string };
let GRACE: { id: string; email: string };

function signedInAs(user: { id: string; email: string }) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

function signedOut() {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
}

async function forUser(userId: string) {
  return prisma.favorite.findMany({ where: { userId } });
}

beforeEach(async () => {
  ADA = await createUser({ email: "ada@example.com" });
  GRACE = await createUser({ email: "grace@example.com" });
  vi.mocked(getCurrentUser).mockReset();
});

describe("saveFavorite", () => {
  it("FAV-1: records a saved listing against the signed-in user", async () => {
    signedInAs(ADA);
    const listing = makeFavoriteInput();

    const result = await saveFavorite(listing);

    expect(result).toEqual({ ok: true, value: undefined });
    const stored = await forUser(ADA.id);
    expect(stored).toHaveLength(1);
    // The snapshot is the point (spec › Decisions and rationale): the row has to be renderable on its
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

    expect(result.ok && result.value.map((row) => row.id)).toEqual(["wallapop-abc123"]);
  });

  it("FAV-2: saving the same listing twice leaves exactly one record", async () => {
    signedInAs(ADA);
    const listing = makeFavoriteInput();

    const first = await saveFavorite(listing);
    const second = await saveFavorite(listing);

    expect(first).toEqual({ ok: true, value: undefined });
    expect(second).toEqual({ ok: true, value: undefined });
    expect(await forUser(ADA.id)).toHaveLength(1);
  });

  it("FAV-5: a caller with no session saves nothing (PLAT-11)", async () => {
    signedOut();

    const result = await saveFavorite(makeFavoriteInput());

    expect(result).toEqual({
      ok: false,
      error: { code: "unauthenticated", messageKey: "favoriteErrors.unauthenticated" },
    });
    expect(await prisma.favorite.count()).toBe(0);
  });

  it("FAV-7: rejects a listing from an unrecognised source (PLAT-11)", async () => {
    signedInAs(ADA);

    const result = await saveFavorite(makeFavoriteInput({ source: "Craigslist" }));

    expect(result).toEqual({
      ok: false,
      error: { code: "invalidListing", messageKey: "favoriteErrors.invalidListing" },
    });
    expect(await prisma.favorite.count()).toBe(0);
  });

  it("FAV-7: rejects a listing with a blank id and writes nothing", async () => {
    signedInAs(ADA);

    const result = await saveFavorite(makeFavoriteInput({ id: "   " }));

    expect(result).toEqual({
      ok: false,
      error: { code: "invalidListing", messageKey: "favoriteErrors.invalidListing" },
    });
    expect(await prisma.favorite.count()).toBe(0);
  });

  it("FAV-7: rejects a listing with no title", async () => {
    signedInAs(ADA);

    const result = await saveFavorite(makeFavoriteInput({ title: "" }));

    expect(result).toEqual({
      ok: false,
      error: { code: "invalidListing", messageKey: "favoriteErrors.invalidListing" },
    });
    expect(await prisma.favorite.count()).toBe(0);
  });
});

describe("removeFavorite", () => {
  it("FAV-3: removes the listing and leaves the user's others alone", async () => {
    signedInAs(ADA);
    await saveFavorite(makeFavoriteInput());
    await saveFavorite(makeFavoriteInput({ id: "cochesnet-99", source: "Coches.net" }));

    const result = await removeFavorite("wallapop-abc123");

    expect(result).toEqual({ ok: true, value: undefined });
    expect((await forUser(ADA.id)).map((row) => row.listingId)).toEqual(["cochesnet-99"]);
  });

  it("FAV-4: removing something that was never saved reports success", async () => {
    signedInAs(ADA);

    const result = await removeFavorite("wallapop-never-saved");

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("FAV-5: a caller with no session removes nothing (PLAT-11)", async () => {
    await prisma.favorite.create({
      data: { user: { connect: { id: ADA.id } }, listingId: "wallapop-abc123", ...toSnapshot() },
    });
    signedOut();

    const result = await removeFavorite("wallapop-abc123");

    expect(result).toEqual({
      ok: false,
      error: { code: "unauthenticated", messageKey: "favoriteErrors.unauthenticated" },
    });
    expect(await forUser(ADA.id)).toHaveLength(1);
  });

  it("FAV-6 / TEST-8: one user cannot remove another user's saved listing", async () => {
    await prisma.favorite.create({
      data: { user: { connect: { id: ADA.id } }, listingId: "wallapop-abc123", ...toSnapshot() },
    });
    signedInAs(GRACE);

    const result = await removeFavorite("wallapop-abc123");

    // Grace is told nothing went wrong - she has no such favorite, and whether
    // Ada does is none of her business - but Ada's row survives.
    expect(result).toEqual({ ok: true, value: undefined });
    expect(await forUser(ADA.id)).toHaveLength(1);
  });
});

describe("listFavorites", () => {
  it("FAV-8 / TEST-8: returns only the caller's own saved listings", async () => {
    await prisma.favorite.create({
      data: {
        user: { connect: { id: GRACE.id } },
        listingId: "wallapop-graces-car",
        ...toSnapshot(),
      },
    });
    signedInAs(ADA);
    await saveFavorite(makeFavoriteInput());

    const result = await listFavorites();

    expect(result.ok && result.value.map((row) => row.id)).toEqual(["wallapop-abc123"]);
  });

  it("FAV-8: returns them newest first", async () => {
    signedInAs(ADA);
    await saveFavorite(makeFavoriteInput({ id: "wallapop-first" }));
    await saveFavorite(makeFavoriteInput({ id: "wallapop-second" }));
    await saveFavorite(makeFavoriteInput({ id: "wallapop-third" }));

    const result = await listFavorites();

    expect(result.ok && result.value.map((row) => row.id)).toEqual([
      "wallapop-third",
      "wallapop-second",
      "wallapop-first",
    ]);
  });

  it("FAV-8: an empty list is a success, not an error", async () => {
    signedInAs(ADA);

    const result = await listFavorites();

    expect(result).toEqual({ ok: true, value: [] });
  });

  it("FAV-5: a caller with no session gets nothing back (PLAT-11)", async () => {
    await prisma.favorite.create({
      data: { user: { connect: { id: ADA.id } }, listingId: "wallapop-abc123", ...toSnapshot() },
    });
    signedOut();

    const result = await listFavorites();

    expect(result).toEqual({
      ok: false,
      error: { code: "unauthenticated", messageKey: "favoriteErrors.unauthenticated" },
    });
  });
});

/** The snapshot columns saveFavorite would have written, for rows seeded directly. */
function toSnapshot() {
  const { id: _id, ...snapshot } = makeFavoriteInput();
  return snapshot;
}
