import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wordmark } from "./Wordmark";

// docs/specs/motion.md (Key MOTION, Approved), MOTION-21: the wordmark link
// gains the header links' hover and press (MOTION-6), in the state
// transition.
describe("MOTION-21: Wordmark — hover and press", () => {
  it.each(["desktop", "phone"] as const)(
    "MOTION-21: the %s wordmark carries transition-[color,scale], hover:text-lime and active:scale-97, off under reduced motion",
    (size) => {
      render(<Wordmark size={size} />);

      const classes = screen.getByRole("link", { name: "BuyCarMap" }).className.split(/\s+/);
      expect(classes).toContain("transition-[color,scale]");
      expect(classes).toContain("hover:text-lime");
      expect(classes).toContain("active:scale-97");
      expect(classes).toContain("motion-reduce:active:scale-none");
    },
  );
});
