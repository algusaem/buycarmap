import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { SourceBadge } from "./SourceBadge";

describe("SourceBadge", () => {
  it("renders the branded label for a known source", () => {
    render(<SourceBadge source="Coches.net" />);
    expect(screen.getByText("coches.net")).toBeInTheDocument();
  });

  it("renders the branded label for Milanuncios", () => {
    render(<SourceBadge source="Milanuncios" />);
    expect(screen.getByText("Milanuncios")).toBeInTheDocument();
  });

  it("falls back to the raw source name when unknown", () => {
    render(<SourceBadge source="Autoscout24" />);
    expect(screen.getByText("Autoscout24")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<SourceBadge source="Wallapop" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

// LOOK-15 (docs/specs/redesign-foundation.md): the badge looks the same for
// every source — only the text (the source's display name) differs. Today
// each source gets its own brand colour (SOURCE_STYLES in ./SourceBadge.tsx),
// so the three class lists differ; this is the failing spec.
describe("LOOK-15: the source badge looks the same for every source", () => {
  it("LOOK-15: Wallapop, Coches.net and Milanuncios share one class list and each shows its own display name", () => {
    const { container: wallapopContainer } = render(<SourceBadge source="Wallapop" />);
    const { container: cochesnetContainer } = render(<SourceBadge source="Coches.net" />);
    const { container: milanunciosContainer } = render(<SourceBadge source="Milanuncios" />);

    const wallapopBadge = wallapopContainer.firstElementChild;
    const cochesnetBadge = cochesnetContainer.firstElementChild;
    const milanunciosBadge = milanunciosContainer.firstElementChild;

    expect(wallapopBadge?.className).toBe(cochesnetBadge?.className);
    expect(cochesnetBadge?.className).toBe(milanunciosBadge?.className);

    expect(within(wallapopContainer).getByText("Wallapop")).toBeInTheDocument();
    expect(within(cochesnetContainer).getByText("coches.net")).toBeInTheDocument();
    expect(within(milanunciosContainer).getByText("Milanuncios")).toBeInTheDocument();
  });
});
