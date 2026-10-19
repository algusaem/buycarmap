import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import en from "@/messages/en.json";
import { LoadingMore, MapPill, ResultsStatus } from "./ResultsStates";

// docs/specs/motion.md (Key MOTION, Approved), MOTION-8: the map's results
// list never animates — «Cargando…» under the list and the desktop status
// pill over the map appear and leave with no fade.

describe("MOTION-8: LoadingMore — no fade", () => {
  it("MOTION-8: clearing loading removes it in the same tick, with no exit to wait for", async () => {
    await withAnimations(async () => {
      const { rerender } = renderWithI18n(<LoadingMore loading />);
      expect(screen.getByText("Loading…")).toBeInTheDocument();

      rerender(<LoadingMore loading={false} />);

      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });
  });
});

describe("MOTION-8: MapPill (the desktop status pill) — no fade", () => {
  it("MOTION-8: clearing its text removes the pill in the same tick, with no exit to wait for", async () => {
    await withAnimations(async () => {
      const { rerender } = renderWithI18n(<MapPill text="Finding cars…" live />);
      expect(screen.getByText("Finding cars…")).toBeInTheDocument();

      rerender(<MapPill text={undefined} live />);

      // The live region itself stays mounted, so its next text is announced;
      // the pill inside it is what leaves.
      expect(screen.queryByText("Finding cars…")).not.toBeInTheDocument();
    });
  });
});

// docs/specs/motion.md (MOTION-8): the list's loading placeholder gives way
// to the empty or the error state at once, with no fade between them.
describe("MOTION-8: ResultsStatus — loading switches to empty or error in the same tick", () => {
  const HANDLERS = {
    radiusKm: 50,
    hasFilters: true,
    onRetry: vi.fn(),
    onWiden: vi.fn(),
    onClearFilters: vi.fn(),
    onAllSpain: vi.fn(),
  };

  it("MOTION-8: loading → empty: the placeholder is gone and the empty state is there in the same tick", async () => {
    await withAnimations(async () => {
      const { rerender } = renderWithI18n(<ResultsStatus state="loading" {...HANDLERS} />);
      expect(screen.getByText(en.mapStates.loading)).toBeInTheDocument();

      rerender(<ResultsStatus state="empty" {...HANDLERS} />);

      expect(screen.queryByText(en.mapStates.loading)).not.toBeInTheDocument();
      expect(screen.getByText(en.mapStates.emptyLine)).toBeInTheDocument();
    });
  });

  it("MOTION-8: loading → error: the placeholder is gone and the error state is there in the same tick", async () => {
    await withAnimations(async () => {
      const { rerender } = renderWithI18n(<ResultsStatus state="loading" {...HANDLERS} />);
      expect(screen.getByText(en.mapStates.loading)).toBeInTheDocument();

      rerender(<ResultsStatus state="error" {...HANDLERS} />);

      expect(screen.queryByText(en.mapStates.loading)).not.toBeInTheDocument();
      expect(screen.getByText(en.mapStates.errorLine)).toBeInTheDocument();
    });
  });
});
