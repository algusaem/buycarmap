import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { makeFavoriteInput } from "@/test/fixtures/favorites";
import type { CarListing } from "@/interfaces/listing";
import { CarListingCard } from "./CarListingCard";

// next/image needs the Next runtime; a plain img is enough for behaviour tests.
vi.mock("next/image", () => import("@/test/mocks/next-image"));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/map",
}));

const useSession = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => useSession() },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/server/favorites/actions", () => ({
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

import { toast } from "sonner";
import { removeFavorite, saveFavorite } from "@/server/favorites/actions";

const listing: CarListing = {
  id: "wallapop-1",
  image: "https://cdn.example.com/car.jpg",
  title: "Audi A3 2.0 TDI",
  subtitle: "Great condition",
  price: 14500,
  mileage: 95000,
  year: 2018,
  fuel: "gasoil",
  brand: "Audi",
  model: "A3",
  location: "Madrid",
  source: "Wallapop",
  lat: 40.4,
  lng: -3.7,
  url: "https://es.wallapop.com/item/audi-a3-1",
};

const ADD = "Add to favorites";
const REMOVE = "Remove from favorites";
const favoriteControl = () => screen.getByRole("button", { name: new RegExp(`${ADD}|${REMOVE}`) });

beforeEach(() => {
  vi.mocked(saveFavorite).mockReset();
  vi.mocked(removeFavorite).mockReset();
  vi.mocked(toast.error).mockClear();
  push.mockReset();
  useSession.mockReturnValue({
    data: { user: { id: "user-ada" } },
    isPending: false,
  });
});

describe("CarListingCard", () => {
  it("renders the title, locale-formatted price, and links out to the source", () => {
    renderWithI18n(<CarListingCard {...listing} />);

    expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
    // FRONT-10/FRONT-11 (docs/specs/core-frontend.md): renderWithI18n renders
    // English, and formatPrice is now locale-aware — en-US groups with a comma.
    expect(screen.getByText(/14,500/)).toBeInTheDocument();

    const [link] = screen.getAllByRole("link");
    expect(link).toHaveAttribute("href", listing.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the fallback icon instead of an image when there is no image", () => {
    renderWithI18n(<CarListingCard {...listing} image="" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("omits year and mileage separators when those fields are empty", () => {
    renderWithI18n(<CarListingCard {...listing} year={0} mileage={0} />);
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<CarListingCard {...listing} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("CarListingCard favorites", () => {
  it("FAV-9: renders an already-saved listing in the saved state without asking the server", () => {
    renderWithI18n(<CarListingCard {...listing} isFavorite />);

    expect(favoriteControl()).toHaveAccessibleName(REMOVE);
    expect(saveFavorite).not.toHaveBeenCalled();
    expect(removeFavorite).not.toHaveBeenCalled();
  });

  it("FAV-10: flips the control before the save has come back", async () => {
    // Deliberately never resolved: the assertion is about what the user sees
    // while the request is still in flight.
    vi.mocked(saveFavorite).mockReturnValue(
      new Promise(() => {
        /* deliberately never settles */
      }),
    );
    renderWithI18n(<CarListingCard {...listing} />);

    await userEvent.click(favoriteControl());

    expect(favoriteControl()).toHaveAccessibleName(REMOVE);
    expect(saveFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ id: "wallapop-1", title: "Audi A3 2.0 TDI" }),
    );
  });

  it("FAV-10: unsaving an already-saved listing calls through to removal", async () => {
    vi.mocked(removeFavorite).mockResolvedValue({ ok: true, value: undefined });
    renderWithI18n(<CarListingCard {...listing} isFavorite />);

    await userEvent.click(favoriteControl());

    expect(removeFavorite).toHaveBeenCalledWith("wallapop-1");
    expect(favoriteControl()).toHaveAccessibleName(ADD);
  });

  it("FAV-11: puts the control back and warns when the save fails", async () => {
    vi.mocked(saveFavorite).mockResolvedValue({
      ok: false,
      error: { code: "invalidListing", messageKey: "favoriteErrors.invalidListing" },
    });
    renderWithI18n(<CarListingCard {...listing} />);

    await userEvent.click(favoriteControl());

    expect(favoriteControl()).toHaveAccessibleName(ADD);
    expect(toast.error).toHaveBeenCalled();
  });

  it("PLAT-13: an unauthenticated save shows the translated messageKey copy", async () => {
    vi.mocked(saveFavorite).mockResolvedValue({
      ok: false,
      error: { code: "unauthenticated", messageKey: "favoriteErrors.unauthenticated" },
    });
    renderWithI18n(<CarListingCard {...listing} />);

    await userEvent.click(favoriteControl());

    expect(toast.error).toHaveBeenCalledWith("Please sign in to save favorites.");
  });

  it("FAV-11: puts the control back when the save throws", async () => {
    vi.mocked(saveFavorite).mockRejectedValue(new Error("network down"));
    renderWithI18n(<CarListingCard {...listing} isFavorite={false} />);

    await userEvent.click(favoriteControl());

    expect(favoriteControl()).toHaveAccessibleName(ADD);
    expect(toast.error).toHaveBeenCalled();
  });

  it("PLAT-12: a thrown/unexpected save shows the generic error toast copy", async () => {
    // PLAT-12 (docs/specs/core-platform.md): once saveFavorite throws instead
    // of returning an `unexpected` Result error, the toast still reads the
    // same generic copy it reads today (en.authErrors.generic ===
    // en.alertErrors.unexpected === "Something went wrong. Please try again.").
    vi.mocked(saveFavorite).mockRejectedValue(new Error("connection refused"));
    renderWithI18n(<CarListingCard {...listing} isFavorite={false} />);

    await userEvent.click(favoriteControl());

    expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again.");
  });

  it("FAV-12: sends a signed-out visitor to sign in, and back again afterwards", async () => {
    useSession.mockReturnValue({ data: null, isPending: false });
    renderWithI18n(<CarListingCard {...listing} />);

    await userEvent.click(favoriteControl());

    expect(push).toHaveBeenCalledWith("/login?callbackUrl=%2Fmap");
    expect(saveFavorite).not.toHaveBeenCalled();
  });

  it("FAV-12: does not pretend the listing was saved", async () => {
    useSession.mockReturnValue({ data: null, isPending: false });
    renderWithI18n(<CarListingCard {...listing} />);

    await userEvent.click(favoriteControl());

    expect(favoriteControl()).toHaveAccessibleName(ADD);
  });

  it("FAV-18: does not send a signed-in user to sign-in while the session is still loading", async () => {
    // `useSession` reports "loading" before the session request resolves. A
    // guard of `status !== "authenticated"` treats that as signed out, so a
    // click in that window pushed an already-signed-in user to /login — which
    // proxy.ts then bounces to "/" because /login is guest-only and they hold a
    // valid token. The user lands on the home page and the click is lost.
    // Found by e2e/favorites.spec.ts FAV-3, which was flaky 2 runs in 3 because
    // /favorites is server-rendered and therefore clickable immediately.
    useSession.mockReturnValue({ data: null, isPending: true });
    renderWithI18n(<CarListingCard {...listing} />);

    await userEvent.click(favoriteControl());

    expect(push).not.toHaveBeenCalled();
  });

  it("FAV-18: does not report the listing as saved while the session is still loading", async () => {
    useSession.mockReturnValue({ data: null, isPending: true });
    renderWithI18n(<CarListingCard {...listing} />);

    await userEvent.click(favoriteControl());

    // Neither optimistically flipped nor written: the outcome is genuinely
    // unknown until the session resolves, so claiming either would be a lie.
    expect(favoriteControl()).toHaveAccessibleName(ADD);
    expect(saveFavorite).not.toHaveBeenCalled();
  });
});

describe("CarListingCard favorites input", () => {
  it("FAV-1: sends the whole listing so it can be rendered back later", async () => {
    vi.mocked(saveFavorite).mockResolvedValue({ ok: true, value: undefined });
    const full = makeFavoriteInput({ id: "wallapop-1" });
    renderWithI18n(<CarListingCard {...full} />);

    await userEvent.click(favoriteControl());

    expect(saveFavorite).toHaveBeenCalledWith(full);
  });
});

describe("CarListingCard saved-state sync", () => {
  it("FAV-16: adopts the saved state when it arrives after mount", () => {
    // The saved set is fetched separately and lands after the card has already
    // rendered. Seeding useState once would leave an already-saved car showing
    // as unsaved forever, which is the bug this criterion exists for.
    const { rerender } = renderWithI18n(<CarListingCard {...listing} isFavorite={false} />);
    expect(favoriteControl()).toHaveAccessibleName(ADD);

    rerender(<CarListingCard {...listing} isFavorite />);

    expect(favoriteControl()).toHaveAccessibleName(REMOVE);
  });

  it("FAV-16: does not undo a toggle the user just made", async () => {
    vi.mocked(saveFavorite).mockResolvedValue({ ok: true, value: undefined });
    const { rerender } = renderWithI18n(<CarListingCard {...listing} isFavorite={false} />);

    await userEvent.click(favoriteControl());
    expect(favoriteControl()).toHaveAccessibleName(REMOVE);

    // A re-render carrying the same prop value must not reset the local
    // optimistic state back to unsaved.
    rerender(<CarListingCard {...listing} isFavorite={false} />);

    expect(favoriteControl()).toHaveAccessibleName(REMOVE);
  });

  it("FAV-16: reports the change so the parent's saved set stays in step", async () => {
    vi.mocked(saveFavorite).mockResolvedValue({ ok: true, value: undefined });
    const onFavoriteChange = vi.fn();
    renderWithI18n(<CarListingCard {...listing} onFavoriteChange={onFavoriteChange} />);

    await userEvent.click(favoriteControl());

    expect(onFavoriteChange).toHaveBeenCalledWith("wallapop-1", true);
  });

  it("FAV-11: tells the parent to roll back when the save fails", async () => {
    vi.mocked(saveFavorite).mockResolvedValue({
      ok: false,
      error: { code: "invalidListing", messageKey: "favoriteErrors.invalidListing" },
    });
    const onFavoriteChange = vi.fn();
    renderWithI18n(<CarListingCard {...listing} onFavoriteChange={onFavoriteChange} />);

    await userEvent.click(favoriteControl());

    expect(onFavoriteChange).toHaveBeenLastCalledWith("wallapop-1", false);
  });
});
