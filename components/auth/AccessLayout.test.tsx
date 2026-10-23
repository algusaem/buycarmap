import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessLink } from "./AccessLayout";

// docs/specs/motion.md (MOTION-25): the access pages' own text links
// («Entrar», «Volver a entrar») keep their hover to lime and gain the same
// press as the other access-page links.
describe("MOTION-25: AccessLink — hover and press", () => {
  it("MOTION-25: carries hover:text-lime, active:scale-97, motion-reduce:active:scale-none and a scale transition", () => {
    render(<AccessLink href="/login">Entrar</AccessLink>);

    const classes = screen.getByRole("link", { name: "Entrar" }).className.split(/\s+/);
    expect(classes).toContain("hover:text-lime");
    expect(classes).toContain("active:scale-97");
    expect(classes).toContain("motion-reduce:active:scale-none");
    expect(
      classes.some(
        (className) => className.startsWith("transition-") && className.includes("scale"),
      ),
    ).toBe(true);
  });
});
