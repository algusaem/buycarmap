import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { EmailDialog } from "./EmailDialog";

// docs/specs/motion.md (MOTION-27): the email dialog's swap from the form to
// «sent» follows the input that caused it: at once after a key, a 180ms
// cross-fade after a pointer.
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const requestEmailChange = vi.fn();
vi.mock("@/server/email-verification/actions", () => ({
  requestEmailChange: (...args: unknown[]) => requestEmailChange(...args),
}));

beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
  requestEmailChange.mockReset();
});

function renderDialog() {
  return renderWithI18n(
    <EmailDialog open isPhone={false} returnFocusRef={{ current: null }} onClose={vi.fn()} />,
  );
}

function expectOpaque(element: HTMLElement) {
  const opacity = element.style.opacity;
  expect(opacity === "" || Number(opacity) >= 1).toBe(true);
}

describe("MOTION-27: EmailDialog — the form to «sent»", () => {
  it("MOTION-27: Enter in the password field shows the sent notice with no inline opacity below 1", async () => {
    requestEmailChange.mockResolvedValue({ success: true });
    await withAnimations(async (clock) => {
      renderDialog();
      await userEvent.type(screen.getByLabelText("New email address"), "new@example.com");

      await userEvent.type(screen.getByLabelText("Current password"), "current-pw{Enter}");
      await waitFor(() => expect(requestEmailChange).toHaveBeenCalledOnce());
      // `AnimatePresence mode="wait"`: the outgoing form's exit must finish
      // before the next state mounts — real animations are frozen by
      // `withAnimations`, so the clock has to be moved past it by hand.
      await clock.finish();

      const closeButton = await screen.findByRole("button", { name: "Close" });
      expectOpaque(closeButton.parentElement as HTMLElement);
    });
  });

  it("MOTION-27: pressing «Change email» still fades the sent notice in, with an inline opacity below 1 right after", async () => {
    requestEmailChange.mockResolvedValue({ success: true });
    await withAnimations(async (clock) => {
      renderDialog();
      await userEvent.type(screen.getByLabelText("New email address"), "new@example.com");
      await userEvent.type(screen.getByLabelText("Current password"), "current-pw");

      await userEvent.click(screen.getByRole("button", { name: "Change email" }));
      await waitFor(() => expect(requestEmailChange).toHaveBeenCalledOnce());
      await clock.finish();

      const closeButton = await screen.findByRole("button", { name: "Close" });
      expect(Number((closeButton.parentElement as HTMLElement).style.opacity)).toBeLessThan(1);
    });
  });
});
