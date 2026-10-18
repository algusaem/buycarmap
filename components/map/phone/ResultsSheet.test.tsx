import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { makeFavoriteInput } from "@/test/fixtures/favorite-listings";
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

/** Lets Motion's frame loop run, as a real pointer sequence spans frames. */
function nextFrames() {
  return act(() => new Promise((resolve) => setTimeout(resolve, 60)));
}

/** A mouse pointer event at `y`, as Motion's pan gesture reads it. */
function pointerAt(y: number) {
  return { clientY: y, pageY: y, button: 0, isPrimary: true, pointerType: "mouse" };
}

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
});

describe("MAPUI-58: ResultsSheet — the handle moves one position up on each press", () => {
  // MAPUI-23 amended by MAPUI-58 (2026-10-17, #133): each press moves the
  // sheet one position up (peeked -> middle -> full -> peeked), not straight
  // between full and peeked.
  it.each([
    ["peeked", "middle"],
    ["middle", "full"],
    ["full", "peeked"],
  ] as const)(
    "MAPUI-23, MAPUI-58: a click on the handle at %s calls onPositionChange once with %s",
    async (start, next) => {
      const onPositionChange = vi.fn();
      renderWithI18n(
        <ResultsSheet {...BASE} position={start} onPositionChange={onPositionChange} />,
        { locale: "es" },
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^(results list|lista de resultados)$/i }),
      );

      expect(onPositionChange).toHaveBeenCalledTimes(1);
      expect(onPositionChange).toHaveBeenCalledWith(next);
    },
  );

  it("MAPUI-58: Enter on the handle at middle calls onPositionChange with full", async () => {
    const onPositionChange = vi.fn();
    renderWithI18n(
      <ResultsSheet {...BASE} position="middle" onPositionChange={onPositionChange} />,
      { locale: "es" },
    );

    screen.getByRole("button", { name: /^(results list|lista de resultados)$/i }).focus();
    await userEvent.keyboard("{Enter}");

    expect(onPositionChange).toHaveBeenCalledWith("full");
  });

  it("MAPUI-58: Space on the handle at peeked calls onPositionChange with middle", async () => {
    const onPositionChange = vi.fn();
    renderWithI18n(
      <ResultsSheet {...BASE} position="peeked" onPositionChange={onPositionChange} />,
      { locale: "es" },
    );

    screen.getByRole("button", { name: /^(results list|lista de resultados)$/i }).focus();
    await userEvent.keyboard(" ");

    expect(onPositionChange).toHaveBeenCalledWith("middle");
  });

  it.each(["peeked", "middle"] as const)(
    "MAPUI-58: aria-expanded stays false at %s",
    (position) => {
      renderWithI18n(<ResultsSheet {...BASE} position={position} />, { locale: "es" });

      expect(
        screen.getByRole("button", { name: /^(results list|lista de resultados)$/i }),
      ).toHaveAttribute("aria-expanded", "false");
    },
  );
});

describe("MAPUI-59: ResultsSheet — a drag never starts from the list, and the draggable areas opt out of the browser's own scroll", () => {
  it("MAPUI-59: a downward pointerdown/move/up on the middle sheet's card calls no onPositionChange", async () => {
    const onPositionChange = vi.fn();
    renderWithI18n(
      <ResultsSheet {...BASE} position="middle" onPositionChange={onPositionChange} />,
      { locale: "es" },
    );

    const [card] = screen.getAllByRole("article");
    fireEvent.pointerDown(card, pointerAt(100));
    await nextFrames();
    fireEvent.pointerMove(card, pointerAt(200));
    await nextFrames();
    fireEvent.pointerUp(card, pointerAt(200));
    await nextFrames();

    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it("MAPUI-59: the same downward pointerdown/move/up on the middle sheet's title does call onPositionChange (the control for the list test above)", async () => {
    const onPositionChange = vi.fn();
    renderWithI18n(
      <ResultsSheet {...BASE} position="middle" onPositionChange={onPositionChange} />,
      { locale: "es" },
    );

    const heading = screen.getByRole("heading", { level: 1 });
    fireEvent.pointerDown(heading, pointerAt(100));
    await nextFrames();
    fireEvent.pointerMove(heading, pointerAt(200));
    await nextFrames();
    fireEvent.pointerUp(heading, pointerAt(200));
    await nextFrames();

    expect(onPositionChange).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-59: the handle strip and the title carry touch-action: none (touch-none)", () => {
    renderWithI18n(<ResultsSheet {...BASE} position="middle" />, { locale: "es" });

    const strip = screen.getByTestId("results-sheet-handle-strip");
    const heading = screen.getByRole("heading", { level: 1 });

    expect(strip.className).toContain("touch-none");
    expect(heading.className).toContain("touch-none");
  });

  it("MAPUI-59: at full the sheet itself sets no inline touch-action, so the list keeps the browser's own scroll", () => {
    renderWithI18n(<ResultsSheet {...BASE} position="full" />, { locale: "es" });

    expect(screen.getByTestId("results-sheet").style.touchAction).toBe("");
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
