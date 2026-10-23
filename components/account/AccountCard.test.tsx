import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { withAnimations } from "@/test/utils/animations";
import { AccountCard } from "./AccountCard";

// docs/specs/motion.md (MOTION-27): the account cards' badge and actions
// follow the input that caused them to appear: at once after a key, a 180ms
// cross-fade after a pointer.

function expectOpaque(element: HTMLElement) {
  const opacity = element.style.opacity;
  expect(opacity === "" || Number(opacity) >= 1).toBe(true);
}

describe("MOTION-27: AccountCard — the badge", () => {
  it("MOTION-27: a badge added after a key is drawn with no inline opacity below 1", async () => {
    await withAnimations(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      const { rerender } = render(<AccountCard title="Email" />);

      rerender(<AccountCard title="Email" badge="Verified" />);

      expectOpaque(screen.getByText("Verified"));
    });
  });

  it("MOTION-27: a badge added after a pointer still fades in, with an inline opacity below 1 right after", async () => {
    await withAnimations(async () => {
      window.dispatchEvent(new PointerEvent("pointerdown"));
      const { rerender } = render(<AccountCard title="Email" />);

      rerender(<AccountCard title="Email" badge="Verified" />);

      expect(Number(screen.getByText("Verified").style.opacity)).toBeLessThan(1);
    });
  });
});

describe("MOTION-27: AccountCard — the actions", () => {
  it("MOTION-27: actions added after a key are drawn with no inline opacity below 1", async () => {
    await withAnimations(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      const { rerender } = render(<AccountCard title="Email" />);

      rerender(
        <AccountCard title="Email">
          <button type="button">Do it</button>
        </AccountCard>,
      );

      const container = screen.getByRole("button", { name: "Do it" }).parentElement;
      expectOpaque(container as HTMLElement);
    });
  });

  it("MOTION-27: actions added after a pointer still fade in, with an inline opacity below 1 right after", async () => {
    await withAnimations(async () => {
      window.dispatchEvent(new PointerEvent("pointerdown"));
      const { rerender } = render(<AccountCard title="Email" />);

      rerender(
        <AccountCard title="Email">
          <button type="button">Do it</button>
        </AccountCard>,
      );

      const container = screen.getByRole("button", { name: "Do it" }).parentElement;
      expect(Number((container as HTMLElement).style.opacity)).toBeLessThan(1);
    });
  });
});
