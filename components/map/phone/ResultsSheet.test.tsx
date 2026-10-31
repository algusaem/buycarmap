import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { makeFavoriteInput } from "@/test/fixtures/favorite-listings";
import { ResultsSheet, type ResultsSheetProps } from "./ResultsSheet";
import type { ResultsSheetPosition } from "@/lib/hooks/useMapPageState";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

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

describe("MAPUI-59: ResultsSheet — where a drag starts, and the draggable areas opt out of the browser's own scroll", () => {
  it("MAPUI-59: a downward pointerdown/move/up on the middle sheet's card calls onPositionChange once", async () => {
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

    expect(onPositionChange).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-59: at full, the same downward pointerdown/move/up on a card calls no onPositionChange", async () => {
    const onPositionChange = vi.fn();
    renderWithI18n(<ResultsSheet {...BASE} position="full" onPositionChange={onPositionChange} />, {
      locale: "es",
    });

    const [card] = screen.getAllByRole("article");
    fireEvent.pointerDown(card, pointerAt(100));
    await nextFrames();
    fireEvent.pointerMove(card, pointerAt(200));
    await nextFrames();
    fireEvent.pointerUp(card, pointerAt(200));
    await nextFrames();

    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it("MAPUI-59: a press on the middle sheet's card that does not move calls no onPositionChange", async () => {
    const onPositionChange = vi.fn();
    renderWithI18n(
      <ResultsSheet {...BASE} position="middle" onPositionChange={onPositionChange} />,
      { locale: "es" },
    );

    const [card] = screen.getAllByRole("article");
    fireEvent.pointerDown(card, pointerAt(100));
    await nextFrames();
    fireEvent.pointerUp(card, pointerAt(100));
    await nextFrames();

    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it("MAPUI-59: the same downward pointerdown/move/up on the middle sheet's title does call onPositionChange (the title drags at every position)", async () => {
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

  it("MAPUI-59: at peeked and middle the whole sheet carries touch-action: none, at full it does not", () => {
    const { unmount: unmountMiddle } = renderWithI18n(
      <ResultsSheet {...BASE} position="middle" />,
      { locale: "es" },
    );
    expect(screen.getByTestId("results-sheet").className).toContain("touch-none");
    unmountMiddle();

    const { unmount: unmountPeeked } = renderWithI18n(
      <ResultsSheet {...BASE} position="peeked" />,
      { locale: "es" },
    );
    expect(screen.getByTestId("results-sheet").className).toContain("touch-none");
    unmountPeeked();

    renderWithI18n(<ResultsSheet {...BASE} position="full" />, { locale: "es" });
    expect(screen.getByTestId("results-sheet").className).not.toContain("touch-none");
  });

  it("MAPUI-59: at full the sheet itself sets no inline touch-action, so the list keeps the browser's own scroll", () => {
    renderWithI18n(<ResultsSheet {...BASE} position="full" />, { locale: "es" });

    expect(screen.getByTestId("results-sheet").style.touchAction).toBe("");
  });
});

// docs/specs/redesign-map.md (MAPUI-59), worked example «Release point
// (MAPUI-59; bug fix, 2026-10-19)»: the sheet settles from where the finger
// left the screen, not from the edge last drawn, which lags (or leads) the
// finger when the browser skips frames.
describe("MAPUI-59: ResultsSheet — a drag settles from the finger's release point, not the edge last drawn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The sheet's drawn top edge, as its getBoundingClientRect reports it; set per step. */
  let drawnSheetTop = 0;

  /** Positions' top edges F = 0 (the sheet's area), M = 400 (the middle probe)
   * and P = 700 (the peeked probe, less a header 0 tall in jsdom), the boxes
   * measureTops reads (lib/hooks/useResultsSheetDrag.ts); the sheet itself
   * reports `drawnSheetTop`. Every other box stays at 0. */
  function stubTops() {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      let top = 0;
      if (this.getAttribute("data-testid") === "results-sheet") top = drawnSheetTop;
      else if (this.classList.contains("h-sheet-middle")) top = 400;
      else if (this.classList.contains("pb-3.5") && this.getAttribute("aria-hidden")) top = 700;
      return {
        top,
        bottom: top,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: top,
        toJSON() {
          return {};
        },
      } as DOMRect;
    });
  }

  /**
   * From middle (drawn at M = 400), presses the title at clientY 500, moves to
   * 600 and then `releaseY`, holds still there for two waits (so the release
   * speed is 0px/s, no flick: MAPUI-60), has the sheet report `drawnAtRelease`
   * as its drawn top, and lets go at `releaseY`.
   */
  async function dragFromMiddle(releaseY: number, drawnAtRelease: number) {
    const onPositionChange = vi.fn();
    stubTops();
    drawnSheetTop = 400;
    renderWithI18n(
      <ResultsSheet {...BASE} position="middle" onPositionChange={onPositionChange} />,
      { locale: "es" },
    );
    await nextFrames();

    const heading = screen.getByRole("heading", { level: 1 });
    fireEvent.pointerDown(heading, pointerAt(500));
    await nextFrames();
    fireEvent.pointerMove(heading, pointerAt(600));
    await nextFrames();
    fireEvent.pointerMove(heading, pointerAt(releaseY));
    await nextFrames();
    await nextFrames();
    drawnSheetTop = drawnAtRelease;
    fireEvent.pointerUp(heading, pointerAt(releaseY));
    await nextFrames();
    return onPositionChange;
  }

  it("MAPUI-59: the drawn top lagging the finger — press at 500, release at 680, drawn top still 420 — settles at peeked", async () => {
    // Finger travel: 680 − 500 = +180, so the release point is 400 + 180 = 580.
    // |580 − 700| = 120 < |580 − 400| = 180 → peeked. The lagging drawn top
    // would give |420 − 400| = 20 < |420 − 700| = 280 → middle (the bug).
    const onPositionChange = await dragFromMiddle(680, 420);

    expect(onPositionChange).toHaveBeenCalledWith("peeked");
  });

  it("MAPUI-59: the drawn top ahead of the finger — press at 500, release at 640, drawn top already 560 — stays at middle", async () => {
    // Finger travel: 640 − 500 = +140, so the release point is 400 + 140 = 540.
    // |540 − 400| = 140 < |540 − 700| = 160 → middle (no change). The drawn top
    // ahead of the finger would give |560 − 700| = 140 < |560 − 400| = 160 → peeked.
    const onPositionChange = await dragFromMiddle(640, 560);

    expect(onPositionChange).not.toHaveBeenCalled();
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

// docs/specs/motion.md (Key MOTION, Approved), MOTION-8: the map's results
// list never animates — the switch between a results state and the cards is
// immediate, and a card appearing or leaving carries no fade.
describe("MOTION-8: ResultsSheet — the list never animates", () => {
  it("MOTION-8: switching from a loading status to the cards shows them in the same tick, with no inline opacity below 1", async () => {
    await withAnimations(async () => {
      const { rerender } = renderWithI18n(
        <ResultsSheet {...BASE} position="full" status={<p aria-busy="true">Cargando…</p>} />,
        { locale: "es" },
      );

      rerender(<ResultsSheet {...BASE} position="full" status={undefined} />);

      const cards = screen.getAllByRole("article");
      expect(cards).toHaveLength(2);
      for (const card of cards) {
        const opacity = card.style.opacity;
        expect(opacity === "" || Number(opacity) >= 1).toBe(true);
      }
    });
  });

  it("MOTION-8: a card removed from listings is gone in the same tick, with no exit to wait for", async () => {
    await withAnimations(async () => {
      const { rerender } = renderWithI18n(<ResultsSheet {...BASE} position="full" />, {
        locale: "es",
      });
      expect(screen.getAllByRole("article")).toHaveLength(2);

      rerender(<ResultsSheet {...BASE} position="full" listings={[LISTINGS[1]]} />);

      expect(screen.getAllByRole("article")).toHaveLength(1);
    });
  });

  it("MOTION-8: at middle, switching from a loading status to the card shows it with no inline opacity below 1, and full then shows both cards in the same tick", async () => {
    await withAnimations(async () => {
      const { rerender } = renderWithI18n(
        <ResultsSheet {...BASE} position="middle" status={<p aria-busy="true">Cargando…</p>} />,
        { locale: "es" },
      );

      rerender(<ResultsSheet {...BASE} position="middle" status={undefined} />);

      // MAPUI-23: middle shows only the first card.
      const middleCards = screen.getAllByRole("article");
      expect(middleCards).toHaveLength(1);
      for (const card of middleCards) {
        const opacity = card.style.opacity;
        expect(opacity === "" || Number(opacity) >= 1).toBe(true);
      }

      rerender(<ResultsSheet {...BASE} position="full" status={undefined} />);

      // MAPUI-23: full shows the whole list, in the same tick — no exit to wait for.
      expect(screen.getAllByRole("article")).toHaveLength(2);
    });
  });
});

// docs/specs/motion.md (MOTION-14): Enter or Space on the handle moves the
// sheet to its next position at once; a pointer press still springs it.
describe("MOTION-14: ResultsSheet — the handle moves at once from the keyboard, but still springs for a pointer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function Harness({ initial }: { initial: ResultsSheetPosition }) {
    const [position, setPosition] = useState<ResultsSheetPosition>(initial);
    return <ResultsSheet {...BASE} position={position} onPositionChange={setPosition} />;
  }

  /** Gives the sheet's offsets real numbers (jsdom's own getBoundingClientRect
   * is always zero): full (the sheet's area) at 0, the middle probe at 400 and
   * the peeked probe at 700, the boxes measureTops reads
   * (lib/hooks/useResultsSheetDrag.ts). Every other box stays at 0. */
  function stubOffsets() {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      let top = 0;
      if (this.classList.contains("h-sheet-middle")) top = 400;
      else if (this.classList.contains("pb-3.5") && this.getAttribute("aria-hidden")) top = 700;
      return {
        top,
        bottom: top,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: top,
        toJSON() {
          return {};
        },
      } as DOMRect;
    });
  }

  it("MOTION-14: Enter on the handle moves the sheet to its next position at once, even with animations enabled", async () => {
    await withAnimations(async () => {
      stubOffsets();
      renderWithI18n(<Harness initial="middle" />, { locale: "es" });
      const handle = screen.getByRole("button", {
        name: /^(results list|lista de resultados)$/i,
      });
      await nextFrames();

      handle.focus();
      await userEvent.keyboard("{Enter}");

      // Full is offset 0: Motion draws a `y` of exactly 0 as `transform: none`.
      const sheet = screen.getByTestId("results-sheet");
      expect(sheet.style.transform).toMatch(/^(none|translateY\(0px\))$/);
    });
  });

  it("MOTION-14: Space on the handle moves the sheet to its next position at once, even with animations enabled", async () => {
    await withAnimations(async () => {
      stubOffsets();
      renderWithI18n(<Harness initial="middle" />, { locale: "es" });
      const handle = screen.getByRole("button", {
        name: /^(results list|lista de resultados)$/i,
      });
      await nextFrames();

      handle.focus();
      await userEvent.keyboard(" ");

      // Full is offset 0: Motion draws a `y` of exactly 0 as `transform: none`.
      const sheet = screen.getByTestId("results-sheet");
      expect(sheet.style.transform).toMatch(/^(none|translateY\(0px\))$/);
    });
  });

  /** The sheet's drawn `y`, in px: Motion draws a `y` of exactly 0 as `transform: none`. */
  function drawnOffset(sheet: HTMLElement): number {
    const match = sheet.style.transform.match(/translateY\((-?[\d.]+)px\)/);
    return match ? Number(match[1]) : 0;
  }

  it("MOTION-14: a pointer press still springs — from middle (400) to full (0) the sheet passes through an offset strictly between them", async () => {
    await withAnimations(async (clock) => {
      stubOffsets();
      renderWithI18n(<Harness initial="middle" />, { locale: "es" });
      const handle = screen.getByRole("button", {
        name: /^(results list|lista de resultados)$/i,
      });
      await nextFrames();
      const sheet = screen.getByTestId("results-sheet");
      expect(drawnOffset(sheet)).toBe(400);

      await userEvent.click(handle);

      // One frame into the spring: it has left middle and not reached full.
      await clock.advance(16);
      const offset = drawnOffset(sheet);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThan(400);
    });
  });

  it("MOTION-14: Enter mid-spring stops the spring and jumps to the next position exactly — a press at middle (400) springs towards full (0), Enter then lands on peeked (700)", async () => {
    await withAnimations(async (clock) => {
      stubOffsets();
      renderWithI18n(<Harness initial="middle" />, { locale: "es" });
      const handle = screen.getByRole("button", {
        name: /^(results list|lista de resultados)$/i,
      });
      await nextFrames();
      const sheet = screen.getByTestId("results-sheet");

      // MAPUI-58: middle → full on the press; the spring is caught a frame on its way.
      await userEvent.click(handle);
      await clock.advance(16);
      const offset = drawnOffset(sheet);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThan(400);

      // MAPUI-58: full → peeked on Enter, drawn at once.
      handle.focus();
      await userEvent.keyboard("{Enter}");

      expect(drawnOffset(sheet)).toBe(700);
      await nextFrames();
      expect(drawnOffset(sheet)).toBe(700);
    });
  });
});
