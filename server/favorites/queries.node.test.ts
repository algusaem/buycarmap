import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/favorites/service", () => ({ findFavorites: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { findFavorites } from "@/server/favorites/service";
import { listFavoritesForPage } from "./queries";

const ADA = { id: "user-ada", email: "ada@example.com" };

const LISTING = {
  id: "wallapop-1",
  image: "https://example.com/car.jpg",
  title: "Audi A3",
  subtitle: "Sportback",
  price: 18000,
  mileage: 90000,
  year: 2017,
  fuel: "gasoline",
  brand: "Audi",
  model: "A3",
  location: "Madrid",
  source: "wallapop" as const,
  lat: 40.4168,
  lng: -3.7038,
  url: "https://example.com/listing/1",
};

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(findFavorites).mockReset();
  vi.mocked(redirect).mockClear();
});

describe("listFavoritesForPage", () => {
  it("LAYOUT-11: with no session, redirects to /login?callbackUrl=%2Ffavorites and reads nothing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await expect(listFavoritesForPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=%2Ffavorites");
    expect(findFavorites).not.toHaveBeenCalled();
  });

  it("LAYOUT-11: with a session, reads with the session user's id and no other", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ADA);
    vi.mocked(findFavorites).mockResolvedValue([LISTING]);

    const favorites = await listFavoritesForPage();

    expect(favorites).toEqual([LISTING]);
    expect(findFavorites).toHaveBeenCalledTimes(1);
    expect(findFavorites).toHaveBeenCalledWith("user-ada");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("PLAT-14: with a session, a failed read rejects instead of resolving to an empty list", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(ADA);
    vi.mocked(findFavorites).mockRejectedValue(new Error("db down"));

    await expect(listFavoritesForPage()).rejects.toThrow("db down");

    expect(redirect).not.toHaveBeenCalled();
  });
});
