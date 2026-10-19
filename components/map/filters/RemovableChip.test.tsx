import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { RemovableChip } from "./RemovableChip";

// docs/specs/motion.md (Key MOTION, Approved), MOTION-17: the brand chip's
// «Quitar» button gains a hover and a press state, in the state transition.
describe("MOTION-17: RemovableChip — hover and press on «Quitar»", () => {
  it("MOTION-17: «Quitar Toyota» carries hover:bg-on-violet/15 and active:scale-97, off under reduced motion", () => {
    renderWithI18n(<RemovableChip label="Toyota" onRemove={vi.fn()} />, { locale: "es" });

    const className = screen.getByRole("button", { name: "Quitar Toyota" }).className;
    expect(className).toContain("hover:bg-on-violet/15");
    expect(className).toContain("active:scale-97");
    expect(className).toContain("motion-reduce:active:scale-none");
    expect(className).toMatch(/transition-\[[^\]]+\]/);
  });
});
