import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";

// docs/specs/redesign-pages.md (PAGES-57; amends FRONT-14, PLAT-14):
// /account's error.tsx is the page-error state (components/ui/PageError.tsx),
// the same shared line and «Reintentar» as app/favorites/error.tsx and
// app/map/error.tsx, plus «Volver al mapa»; it shows no «Cuenta» heading, no
// card and never the thrown error. PAGES-57 also names an empty map beside
// it at desktop width, the way PAGES-65/PAGES-68 do for the not-found and
// root error pages; the spec gives it no accessible name for /account, so
// that part is not asserted here.

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  usePathname: () => "/account",
}));
vi.mock("next/image", () => import("@/test/mocks/next-image"));

import AccountError from "./error";

describe("PAGES-57: /account's error.tsx", () => {
  it("PAGES-57: «¿Se ha roto algo?» over «No es culpa tuya» is the page's h1, over the shared line", () => {
    renderWithI18n(<AccountError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

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

  it("PAGES-57: «Reintentar» refreshes the route's server data and resets the boundary", async () => {
    refresh.mockClear();
    const reset = vi.fn();
    renderWithI18n(<AccountError error={new Error("x")} reset={reset} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("PAGES-57: «Volver al mapa» is a link to /map", () => {
    renderWithI18n(<AccountError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

    expect(screen.getByRole("link", { name: "Volver al mapa" })).toHaveAttribute("href", "/map");
  });

  it("PAGES-57: shows no «Cuenta» heading, no card and never the thrown error", () => {
    renderWithI18n(
      <AccountError error={new Error("relation users does not exist")} reset={vi.fn()} />,
      { locale: "es" },
    );

    expect(screen.queryByRole("heading", { name: "Cuenta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByText(/relation users does not exist/)).not.toBeInTheDocument();
  });
});

// docs/specs/redesign-pages.md (PAGES-57): at desktop width the empty map sits
// beside the state, drawn for the eye only, with no region to name (CSS shows
// it from `lg`).
describe("PAGES-57: the empty map beside /account's error", () => {
  it("PAGES-57: the page's main holds a decorative map column shown from lg, with the pages header's 32px sides", () => {
    renderWithI18n(<AccountError error={new Error("x")} reset={vi.fn()} />, { locale: "es" });

    const main = screen.getByRole("main");
    const map = main.querySelector(':scope > div[aria-hidden="true"]');
    expect(map).not.toBeNull();
    expect(map).toHaveClass("hidden", "lg:flex");
    expect(main.firstElementChild).toHaveClass("lg:px-8");
  });
});

describe("PAGES-57: /account's error accessibility", () => {
  it("PAGES-57: has no accessibility violations", async () => {
    const { container } = renderWithI18n(<AccountError error={new Error("x")} reset={vi.fn()} />, {
      locale: "es",
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
