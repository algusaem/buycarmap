import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";

// I18nProvider calls useRouter() for its locale-switch refresh.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  usePathname: () => "/favorites",
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));
vi.mock("maplibre-gl", () => import("@/test/utils/maplibre"));

import FavoritesError from "./error";

// PLAT-14 (docs/specs/core-platform.md): /favorites gets an error.tsx that
// shows a translated message and a retry button, instead of the read
// silently turning into an empty list (issue #48).
//
// Amended by docs/specs/redesign-saved.md (SAVED-32): the error file is the
// page-error state of F0-estado-error-pagina, its retry unchanged.

describe("FavoritesError", () => {
  it("PLAT-14: shows a retry control that calls reset", async () => {
    const reset = vi.fn();
    renderWithI18n(<FavoritesError error={new Error("x")} reset={reset} />);

    const retry = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(retry);

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("PLAT-14: retry also refreshes the route's server data", async () => {
    refresh.mockClear();
    const reset = vi.fn();
    renderWithI18n(<FavoritesError error={new Error("x")} reset={reset} />);

    const retry = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(retry);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("PLAT-14: never shows the raw error message", () => {
    renderWithI18n(<FavoritesError error={new Error("x")} reset={vi.fn()} />);

    expect(screen.queryByText("x")).not.toBeInTheDocument();
  });
});

describe("SAVED-32: the page-error state", () => {
  it("SAVED-32: «¿Se ha roto algo?» over «No es culpa tuya» is the page's h1, over its line", () => {
    renderWithI18n(<FavoritesError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("¿Se ha roto algo?");
    expect(headings[0]).toHaveTextContent("No es culpa tuya");
    expect(
      screen.getByText(
        "Esta página no ha cargado. Vuelve a intentarlo y, si sigue, vuelve al mapa.",
      ),
    ).toBeInTheDocument();
  });

  it("SAVED-32: «Reintentar» is a button that refreshes the route's server data and resets the boundary", async () => {
    refresh.mockClear();
    const reset = vi.fn();
    renderWithI18n(<FavoritesError error={new Error("x")} reset={reset} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("SAVED-32: «Volver al mapa» is a link to /map", () => {
    renderWithI18n(<FavoritesError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

    expect(screen.getByRole("link", { name: "Volver al mapa" })).toHaveAttribute("href", "/map");
  });

  it("SAVED-32: shows no «Guardados» heading, no chips and not the thrown error", () => {
    renderWithI18n(
      <FavoritesError error={new Error("relation favorites does not exist")} reset={vi.fn()} />,
      { locale: "es" },
    );

    expect(screen.queryByRole("heading", { name: "Guardados" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recientes" })).not.toBeInTheDocument();
    expect(screen.queryByText(/relation favorites does not exist/)).not.toBeInTheDocument();
  });

  it("SAVED-32: at desktop width the map region beside it shows no pin and no pill", async () => {
    const { container } = renderWithI18n(
      <FavoritesError error={new Error("x")} reset={vi.fn()} />,
      { locale: "es" },
    );

    expect(
      await screen.findByRole("region", { name: "Mapa de tus guardados" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".maplibregl-marker")).toBeNull();
    expect(screen.queryByText("Tus guardados en el mapa")).not.toBeInTheDocument();
    expect(screen.queryByText("Aquí saldrán tus guardados")).not.toBeInTheDocument();
  });

  it("SAVED-32: the map region is hidden below lg by CSS", () => {
    renderWithI18n(<FavoritesError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

    // The region is drawn at every width and CSS hides it below `lg`
    // (2026-10-15): jsdom applies no CSS, so it is found by its classes, as
    // app/favorites/loading.test.tsx finds the loading compositions.
    expect(screen.getByRole("region", { name: "Mapa de tus guardados" })).toHaveClass(
      "hidden",
      "lg:flex",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
