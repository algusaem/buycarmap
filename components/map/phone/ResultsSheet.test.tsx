import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { makeFavoriteInput } from "@/test/fixtures/favorites";
import { ResultsSheet, type ResultsSheetProps } from "./ResultsSheet";

const LISTINGS = [
  makeFavoriteInput({ id: "a", title: "Audi A3 2.0 TDI" }),
  makeFavoriteInput({ id: "b", title: "Seat Leon FR" }),
];

const BASE: ResultsSheetProps = {
  heading: "2 COCHES",
  position: "peeked",
  onPositionChange: vi.fn(),
  listings: LISTINGS,
  onCreateAlert: vi.fn(),
};

describe("MAPUI-23: ResultsSheet — the three positions", () => {
  it("MAPUI-23: peeked shows the title only, with no cards", () => {
    renderWithI18n(<ResultsSheet {...BASE} position="peeked" />, { locale: "es" });

    expect(screen.getByText("2 COCHES")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("MAPUI-23: middle shows the first card", () => {
    renderWithI18n(<ResultsSheet {...BASE} position="middle" />, { locale: "es" });

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Audi A3 2.0 TDI")).toBeInTheDocument();
  });

  it("MAPUI-23: full shows the whole list", () => {
    renderWithI18n(<ResultsSheet {...BASE} position="full" />, { locale: "es" });

    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
});

describe("MAPUI-23: ResultsSheet — the full position's bottom padding (design accepted 2026-10-14)", () => {
  it("MAPUI-23: at full the body clears the home indicator with pb-sheet-full-bottom", () => {
    const { container } = renderWithI18n(<ResultsSheet {...BASE} position="full" />, {
      locale: "es",
    });

    expect(container.querySelector(".pb-sheet-full-bottom")).not.toBeNull();
    expect(container.querySelector(".pb-6")).toBeNull();
  });

  it("MAPUI-23: at middle the body keeps the plain pb-6, not the full-position token", () => {
    const { container } = renderWithI18n(<ResultsSheet {...BASE} position="middle" />, {
      locale: "es",
    });

    expect(container.querySelector(".pb-6")).not.toBeNull();
    expect(container.querySelector(".pb-sheet-full-bottom")).toBeNull();
  });
});

describe("MAPUI-23: ResultsSheet — the handle", () => {
  it("MAPUI-23: aria-expanded is true only when full", () => {
    renderWithI18n(<ResultsSheet {...BASE} position="full" />, { locale: "es" });
    expect(
      screen.getByRole("button", { name: /^(results list|lista de resultados)$/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("MAPUI-23: aria-expanded is false when peeked", () => {
    renderWithI18n(<ResultsSheet {...BASE} position="peeked" />, { locale: "es" });
    expect(
      screen.getByRole("button", { name: /^(results list|lista de resultados)$/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("MAPUI-23: toggles between full and peeked", async () => {
    const onPositionChange = vi.fn();
    renderWithI18n(
      <ResultsSheet {...BASE} position="peeked" onPositionChange={onPositionChange} />,
      { locale: "es" },
    );

    await userEvent.click(
      screen.getByRole("button", { name: /^(results list|lista de resultados)$/i }),
    );

    expect(onPositionChange).toHaveBeenCalledWith("full");
  });
});

describe("MAPUI-23: ResultsSheet — Crear alerta under the title", () => {
  it("MAPUI-23: shows Crear alerta under the title and calls onCreateAlert", async () => {
    const onCreateAlert = vi.fn();
    renderWithI18n(<ResultsSheet {...BASE} onCreateAlert={onCreateAlert} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Crear alerta" }));

    expect(onCreateAlert).toHaveBeenCalledTimes(1);
  });
});

describe("MAPUI-23: ResultsSheet — accessibility", () => {
  it.each(["peeked", "middle", "full"] as const)(
    "MAPUI-23: the sheet %s has no axe violations",
    async (position) => {
      const { container } = renderWithI18n(<ResultsSheet {...BASE} position={position} />, {
        locale: "es",
      });

      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
