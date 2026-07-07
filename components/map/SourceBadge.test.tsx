import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { SourceBadge } from "./SourceBadge";

describe("SourceBadge", () => {
  it("renders the branded label for a known source", () => {
    render(<SourceBadge source="Coches.net" />);
    expect(screen.getByText("coches.net")).toBeInTheDocument();
  });

  it("falls back to the raw source name when unknown", () => {
    render(<SourceBadge source="Milanuncios" />);
    expect(screen.getByText("Milanuncios")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<SourceBadge source="Wallapop" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
