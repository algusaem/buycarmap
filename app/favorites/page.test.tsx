import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { ES_COPY } from "@/test/utils/copy";
import { makeSortExampleCar } from "@/test/fixtures/favorite-listings";

// docs/specs/redesign-saved.md (SAVED-1): the route's own frame around the
// list. `getTranslations` only resolves under the "react-server" condition
// Next.js sets at build time, absent here, so it is stubbed with the real
// Spanish messages (test/utils/copy.ts), as app/page.test.tsx does. The page
// query and the list are not this file's subject: the list is
// components/favorites/FavoritesList.test.tsx's, the query
// server/favorites/queries.integration.test.ts's.
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => ES_COPY.t),
}));
vi.mock("@/server/favorites/queries", () => ({
  listFavoritesForPage: vi.fn(async () => [makeSortExampleCar("A")]),
}));
vi.mock("@/components/favorites/FavoritesList", () => ({
  FavoritesList: ({ favorites }: { favorites: { id: string }[] }) => (
    <div data-testid="favorites-list" data-count={favorites.length} />
  ),
}));

import FavoritesPage, { generateMetadata } from "./page";

describe("SAVED-1: the /favorites route", () => {
  it("SAVED-1: the browser title is «Guardados · Buy Car Map»", async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe("Guardados · Buy Car Map");
  });

  it("SAVED-1: hands the list the saved cars, with no subtitle and no back link to /map", async () => {
    renderWithI18n(await FavoritesPage(), { locale: "es" });

    expect(screen.getByTestId("favorites-list")).toHaveAttribute("data-count", "1");
    expect(
      screen.queryByText("Los precios son del día en que los guardaste."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Volver al inicio" })).not.toBeInTheDocument();
    const toMap = screen
      .queryAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/map");
    expect(toMap).toEqual([]);
  });
});
