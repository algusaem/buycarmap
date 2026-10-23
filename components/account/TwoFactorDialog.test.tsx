import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations, type MotionClock } from "@/test/utils/animations";
import type { ShownCodes } from "@/lib/hooks/useAccountPage";
import { TwoFactorDialog } from "./TwoFactorDialog";

// docs/specs/motion.md (MOTION-27): the two-factor dialog's steps — password
// to setup, and setup to the recovery codes — follow the input that caused
// the change: at once after a key, a 180ms cross-fade after a pointer.
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const startTwoFactorSetup = vi.fn();
const confirmTwoFactorSetup = vi.fn();
const regenerateRecoveryCodes = vi.fn();
const disableTwoFactor = vi.fn();
vi.mock("@/server/two-factor/actions", () => ({
  startTwoFactorSetup: (...args: unknown[]) => startTwoFactorSetup(...args),
  confirmTwoFactorSetup: (...args: unknown[]) => confirmTwoFactorSetup(...args),
  regenerateRecoveryCodes: (...args: unknown[]) => regenerateRecoveryCodes(...args),
  disableTwoFactor: (...args: unknown[]) => disableTwoFactor(...args),
}));

const SETUP_RESULT = {
  success: true,
  otpauthUri: "otpauth://totp/BuyCarMap:ada@example.com?secret=JBSWY3DPEHPK3PXP",
  secret: "JBSWY3DPEHPK3PXP",
  recoveryCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`),
};

beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
  startTwoFactorSetup.mockReset();
  confirmTwoFactorSetup.mockReset();
  regenerateRecoveryCodes.mockReset();
  disableTwoFactor.mockReset();
});

/** The dialog with `codes` held outside it, as the real account page does. */
function Harness() {
  const [codes, setCodes] = useState<ShownCodes | null>(null);
  return (
    <TwoFactorDialog
      open
      isPhone={false}
      returnFocusRef={{ current: null }}
      enabled={false}
      codes={codes}
      onClose={vi.fn()}
      onCodes={setCodes}
      onCodesSaved={vi.fn()}
      onDisabled={vi.fn()}
    />
  );
}

/** `expectOpaque` of the FieldMessage/CreateAlert MOTION-23 tests: no inline opacity below 1. */
function expectOpaque(element: HTMLElement) {
  const opacity = element.style.opacity;
  expect(opacity === "" || Number(opacity) >= 1).toBe(true);
}

describe("MOTION-27: TwoFactorDialog — the password step to the setup step", () => {
  it("MOTION-27: Enter in the password field shows the setup step with no inline opacity below 1", async () => {
    startTwoFactorSetup.mockResolvedValue(SETUP_RESULT);
    await withAnimations(async (clock) => {
      renderWithI18n(<Harness />);

      await userEvent.type(screen.getByLabelText("Your password"), "current-pw{Enter}");
      await waitFor(() => expect(startTwoFactorSetup).toHaveBeenCalledOnce());
      // `AnimatePresence mode="wait"`: the outgoing password form's exit must
      // finish before the setup step mounts — real animations are frozen by
      // `withAnimations`, so the clock has to be moved past it by hand.
      await clock.finish();

      const secretField = await screen.findByRole("textbox", {
        name: "Can't scan? Enter this key manually",
      });
      const container = secretField.closest("form")?.parentElement;
      if (!container) throw new Error("expected the setup step's container");
      expectOpaque(container as HTMLElement);
    });
  });

  it("MOTION-27: pressing «Set up two-factor» still fades the setup step in, with an inline opacity below 1 right after", async () => {
    startTwoFactorSetup.mockResolvedValue(SETUP_RESULT);
    await withAnimations(async (clock) => {
      renderWithI18n(<Harness />);
      await userEvent.type(screen.getByLabelText("Your password"), "current-pw");

      await userEvent.click(screen.getByRole("button", { name: "Set up two-factor" }));
      await waitFor(() => expect(startTwoFactorSetup).toHaveBeenCalledOnce());
      await clock.finish();

      const secretField = await screen.findByRole("textbox", {
        name: "Can't scan? Enter this key manually",
      });
      const container = secretField.closest("form")?.parentElement;
      if (!container) throw new Error("expected the setup step's container");
      expect(Number((container as HTMLElement).style.opacity)).toBeLessThan(1);
    });
  });
});

describe("MOTION-27: TwoFactorDialog — the setup step to the recovery codes", () => {
  /** Reaches the setup step with a key submit, letting its own cross-fade finish first. */
  async function arriveAtSetup(clock: MotionClock) {
    startTwoFactorSetup.mockResolvedValue(SETUP_RESULT);
    renderWithI18n(<Harness />);
    await userEvent.type(screen.getByLabelText("Your password"), "current-pw{Enter}");
    await waitFor(() => expect(startTwoFactorSetup).toHaveBeenCalledOnce());
    await clock.finish();
    await screen.findByRole("textbox", { name: "Enter the 6-digit code" });
  }

  it("MOTION-27: Enter in the code field shows the recovery codes with no inline opacity below 1", async () => {
    confirmTwoFactorSetup.mockResolvedValue({ success: true });
    await withAnimations(async (clock) => {
      await arriveAtSetup(clock);

      await userEvent.type(
        screen.getByRole("textbox", { name: "Enter the 6-digit code" }),
        "123456{Enter}",
      );
      await waitFor(() => expect(confirmTwoFactorSetup).toHaveBeenCalledOnce());
      // `AnimatePresence mode="wait"` at the dialog's own level: the setup
      // step's exit must finish before the recovery codes mount.
      await clock.finish();

      const list = await screen.findByRole("list");
      expectOpaque(list.parentElement as HTMLElement);
    });
  });

  it("MOTION-27: pressing «Turn on two-factor» still fades the recovery codes in, with an inline opacity below 1 right after", async () => {
    confirmTwoFactorSetup.mockResolvedValue({ success: true });
    await withAnimations(async (clock) => {
      await arriveAtSetup(clock);
      await userEvent.type(
        screen.getByRole("textbox", { name: "Enter the 6-digit code" }),
        "123456",
      );

      await userEvent.click(screen.getByRole("button", { name: "Turn on two-factor" }));
      await waitFor(() => expect(confirmTwoFactorSetup).toHaveBeenCalledOnce());
      await clock.finish();

      const list = await screen.findByRole("list");
      expect(Number((list.parentElement as HTMLElement).style.opacity)).toBeLessThan(1);
    });
  });
});
