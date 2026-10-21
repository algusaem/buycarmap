import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import en from "@/messages/en.json";
import { LoadingMore, MapPill, ResultsStatus, StatusPill } from "./ResultsStates";

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

// docs/specs/redesign-map.md (MAPUI-68, worked example «What the status
// says»). The status pill is the page's one polite live region at both
// widths: it says the count it never draws once the cars are listed, and at
// phone width its text is there only for a screen reader. jsdom applies no
// CSS, so «not drawn» is read off the classes that hide it: `sr-only`
// everywhere, `max-lg:sr-only` below `lg`.
describe("MAPUI-68: StatusPill — the page's polite status at both widths", () => {
  const PILL = { radiusKm: 50, canWiden: false, hasFilters: true };

  it.each([
    { count: 1, hasMore: false, said: "1 coche" },
    { count: 3, hasMore: false, said: "3 coches" },
    { count: 40, hasMore: true, said: "Más de 40 coches" },
    { count: 1, hasMore: true, said: "Más de 1 coche" },
  ])(
    "MAPUI-68: listed with $count cars (more pages: $hasMore), it says «$said» without drawing it",
    ({ count, hasMore, said }) => {
      renderWithI18n(<StatusPill state="ready" count={count} hasMore={hasMore} {...PILL} />, {
        locale: "es",
      });

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(said);
      expect(screen.getByText(said)).toHaveClass("sr-only");
    },
  );

  it("MAPUI-68: while loading it says «Buscando coches…», drawn from lg and only for a screen reader below it", () => {
    renderWithI18n(<StatusPill state="loading" count={0} hasMore={false} {...PILL} />, {
      locale: "es",
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Buscando coches…");
    expect(screen.getByText("Buscando coches…")).toHaveClass("max-lg:sr-only");
    expect(screen.getByText("Buscando coches…")).not.toHaveClass("sr-only");
    // The live region itself is never display: none at phone width.
    expect(status).not.toHaveClass("max-lg:hidden");
  });

  it("MAPUI-68: with a model filter, no place and no cars it says «Ningún coche con estos filtros»; failed, «Sin conexión con los anuncios»", () => {
    const { rerender } = renderWithI18n(
      <StatusPill state="empty" count={0} hasMore={false} {...PILL} />,
      { locale: "es" },
    );
    expect(screen.getByRole("status")).toHaveTextContent("Ningún coche con estos filtros");

    rerender(<StatusPill state="error" count={0} hasMore={false} {...PILL} />);
    expect(screen.getByRole("status")).toHaveTextContent("Sin conexión con los anuncios");
  });

  it("MAPUI-68: loading then listed is one live region, so the count is announced as a change", () => {
    const { rerender } = renderWithI18n(
      <StatusPill state="loading" count={0} hasMore={false} {...PILL} />,
      { locale: "es" },
    );
    const status = screen.getByRole("status");

    rerender(<StatusPill state="ready" count={3} hasMore={false} {...PILL} />);

    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("3 coches");
    expect(status).not.toHaveTextContent("Buscando coches…");
  });

  it("MAPUI-68: in English the count reads «3 cars» and «More than 40 cars»", () => {
    const { rerender } = renderWithI18n(
      <StatusPill state="ready" count={3} hasMore={false} {...PILL} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("3 cars");

    rerender(<StatusPill state="ready" count={40} hasMore {...PILL} />);
    expect(screen.getByRole("status")).toHaveTextContent("More than 40 cars");
  });
});
