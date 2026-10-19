import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { Avatar } from "./Avatar";

// docs/specs/motion.md (Key MOTION, Approved), MOTION-6: the avatar gains a
// hover state on pointer devices and a press state, in the state transition.
describe("MOTION-6: Avatar — hover and press", () => {
  it("MOTION-6: carries hover:brightness-92 and active:scale-97, off under reduced motion", () => {
    renderWithI18n(
      <Avatar name="Ada Lovelace" email="ada@example.com" size="desktop" current={false} />,
    );

    const className = screen.getByRole("link", { name: "Account" }).className;
    expect(className).toContain("hover:brightness-92");
    expect(className).toContain("active:scale-97");
    expect(className).toContain("motion-reduce:active:scale-none");
  });
});
