import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { OwnCard } from "./OwnCard";

// docs/specs/motion.md (MOTION-27): the own card's email line follows the
// input that caused a saved name to appear: at once after a key, a 180ms
// cross-fade after a pointer.

const BASE = {
  name: null,
  email: "ada@example.com",
  favoritesCount: 3,
  alertsCount: 1,
  createdAt: new Date("2026-01-15"),
  onChangeName: vi.fn(),
};

function expectOpaque(element: HTMLElement) {
  const opacity = element.style.opacity;
  expect(opacity === "" || Number(opacity) >= 1).toBe(true);
}

describe("MOTION-27: OwnCard — the email line", () => {
  it("MOTION-27: the email line appears with no inline opacity below 1 after a key sets the name", async () => {
    await withAnimations(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      const { rerender } = renderWithI18n(<OwnCard {...BASE} />);

      rerender(<OwnCard {...BASE} name="Ada" />);

      expectOpaque(screen.getByText("ada@example.com"));
    });
  });

  it("MOTION-27: the email line still fades in after a pointer sets the name, with an inline opacity below 1 right after", async () => {
    await withAnimations(async () => {
      window.dispatchEvent(new PointerEvent("pointerdown"));
      const { rerender } = renderWithI18n(<OwnCard {...BASE} />);

      rerender(<OwnCard {...BASE} name="Ada" />);

      expect(Number(screen.getByText("ada@example.com").style.opacity)).toBeLessThan(1);
    });
  });
});
