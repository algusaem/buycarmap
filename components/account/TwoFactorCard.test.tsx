import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { TwoFactorCard } from "./TwoFactorCard";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const startTwoFactorSetup = vi.fn();
const confirmTwoFactorSetup = vi.fn();
const disableTwoFactor = vi.fn();
const regenerateRecoveryCodes = vi.fn();
vi.mock("@/app/actions/two-factor", () => ({
  startTwoFactorSetup: (...a: unknown[]) => startTwoFactorSetup(...a),
  confirmTwoFactorSetup: (...a: unknown[]) => confirmTwoFactorSetup(...a),
  disableTwoFactor: (...a: unknown[]) => disableTwoFactor(...a),
  regenerateRecoveryCodes: (...a: unknown[]) => regenerateRecoveryCodes(...a),
}));

// react-qr-code renders an SVG via canvas-adjacent APIs jsdom lacks; the QR
// image itself is not what these tests are about.
vi.mock("react-qr-code", () => ({
  default: ({ value }: { value: string }) => <div data-testid="qr-code" data-value={value} />,
}));

const CODES = Array.from({ length: 10 }, (_, i) => `AAAAA-BBBBB-CCCC${i}`);

beforeEach(() => {
  refresh.mockReset();
  startTwoFactorSetup.mockReset();
  confirmTwoFactorSetup.mockReset();
  disableTwoFactor.mockReset();
  regenerateRecoveryCodes.mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("TwoFactorCard availability", () => {
  it("explains itself when the server has no encryption key", () => {
    renderWithI18n(<TwoFactorCard isEnabled={false} isAvailable={false} />);

    expect(screen.getByText(/missing its encryption key/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set up two-factor/i })).not.toBeInTheDocument();
  });

  it("shows the current state when available", () => {
    renderWithI18n(<TwoFactorCard isEnabled isAvailable />);

    // Word plus icon, never colour alone.
    expect(screen.getByText("On")).toBeInTheDocument();
  });
});

describe("TwoFactorCard enrolment", () => {
  it("shows the QR and the manual key after starting", async () => {
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/BuyCarMap:ada@example.com?secret=ABC",
      secret: "ABCDEFGHIJKLMNOP",
    });
    renderWithI18n(<TwoFactorCard isEnabled={false} isAvailable />);

    await userEvent.click(screen.getByRole("button", { name: /set up two-factor/i }));

    expect(await screen.findByTestId("qr-code")).toHaveAttribute(
      "data-value",
      "otpauth://totp/BuyCarMap:ada@example.com?secret=ABC",
    );
    // The manual key matters: not everyone can scan.
    expect(screen.getByText("ABCDEFGHIJKLMNOP")).toBeInTheDocument();
  });

  it("surfaces a rejection from the server", async () => {
    startTwoFactorSetup.mockResolvedValue({
      success: false,
      error: "totpAlreadyEnabled",
    });
    renderWithI18n(<TwoFactorCard isEnabled={false} isAvailable />);

    await userEvent.click(screen.getByRole("button", { name: /set up two-factor/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Two-factor authentication is already on"),
    );
  });

  it("keeps the setup open and reports a bad code", async () => {
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/x",
      secret: "ABCDEFGH",
    });
    confirmTwoFactorSetup.mockResolvedValue({
      success: false,
      error: "totpInvalid",
    });
    renderWithI18n(<TwoFactorCard isEnabled={false} isAvailable />);

    await userEvent.click(screen.getByRole("button", { name: /set up two-factor/i }));
    await userEvent.type(await screen.findByLabelText(/enter the 6-digit code/i), "000000");
    await userEvent.click(screen.getByRole("button", { name: /turn on two-factor/i }));

    expect(await screen.findByText(/that code isn't valid/i)).toBeInTheDocument();
    // Still on the setup step, so the user can retype without rescanning.
    expect(screen.getByTestId("qr-code")).toBeInTheDocument();
  });

  it("shows recovery codes once the code is accepted", async () => {
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/x",
      secret: "ABCDEFGH",
    });
    confirmTwoFactorSetup.mockResolvedValue({
      success: true,
      recoveryCodes: CODES,
    });
    renderWithI18n(<TwoFactorCard isEnabled={false} isAvailable />);

    await userEvent.click(screen.getByRole("button", { name: /set up two-factor/i }));
    await userEvent.type(await screen.findByLabelText(/enter the 6-digit code/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /turn on two-factor/i }));

    expect(await screen.findByText(/save your recovery codes/i)).toBeInTheDocument();
    for (const code of CODES) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
  });
});

describe("TwoFactorCard recovery codes", () => {
  async function reachRecoveryCodes() {
    startTwoFactorSetup.mockResolvedValue({
      success: true,
      otpauthUri: "otpauth://totp/x",
      secret: "ABCDEFGH",
    });
    confirmTwoFactorSetup.mockResolvedValue({
      success: true,
      recoveryCodes: CODES,
    });
    renderWithI18n(<TwoFactorCard isEnabled={false} isAvailable />);

    await userEvent.click(screen.getByRole("button", { name: /set up two-factor/i }));
    await userEvent.type(await screen.findByLabelText(/enter the 6-digit code/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /turn on two-factor/i }));
    await screen.findByText(/save your recovery codes/i);
  }

  it("cannot be dismissed before the codes have been copied", async () => {
    // They are shown exactly once; a reflexive click would lose them.
    await reachRecoveryCodes();

    expect(screen.getByRole("button", { name: /i've saved them/i })).toBeDisabled();
  });

  it("enables dismissal after copying", async () => {
    await reachRecoveryCodes();

    await userEvent.click(screen.getByRole("button", { name: /copy codes/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CODES.join("\n"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /i've saved them/i })).toBeEnabled(),
    );
  });

  it("unblocks dismissal even when the clipboard is denied", async () => {
    // Firefox and Safari refuse clipboard access in several situations. Gating
    // the dismiss button on a successful copy trapped those users on a panel
    // that is never shown again.
    await reachRecoveryCodes();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    await userEvent.click(screen.getByRole("button", { name: /copy codes/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /i've saved them/i })).toBeEnabled(),
    );
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't copy automatically. Select the codes above and copy them by hand.",
    );
  });

  it("closes the panel and refreshes once the codes are acknowledged", async () => {
    // Nothing else asserted the dismissal actually works. A broken handler
    // would strand the user on the panel exactly like the clipboard bug did,
    // and the card would never show its enabled state.
    await reachRecoveryCodes();
    await userEvent.click(screen.getByRole("button", { name: /copy codes/i }));
    await userEvent.click(screen.getByRole("button", { name: /i've saved them/i }));

    await waitFor(() =>
      expect(screen.queryByText(/save your recovery codes/i)).not.toBeInTheDocument(),
    );
    // The card re-reads its enabled state from the server component.
    expect(refresh).toHaveBeenCalled();
  });

  it("warns that this is the only time they are shown", async () => {
    await reachRecoveryCodes();

    expect(screen.getByText(/only time they're shown/i)).toBeInTheDocument();
  });
});

describe("TwoFactorCard when enabled", () => {
  it("requires both a password and a code to turn off", async () => {
    renderWithI18n(<TwoFactorCard isEnabled isAvailable />);

    const disable = screen.getByRole("button", { name: /turn off two-factor/i });
    expect(disable).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/your password/i), "hunter2");
    expect(disable).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/enter the 6-digit code/i), "123456");
    expect(disable).toBeEnabled();
  });

  it("submits both fields when turning off", async () => {
    disableTwoFactor.mockResolvedValue({ success: true });
    renderWithI18n(<TwoFactorCard isEnabled isAvailable />);

    await userEvent.type(screen.getByLabelText(/your password/i), "hunter2");
    await userEvent.type(screen.getByLabelText(/enter the 6-digit code/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /turn off two-factor/i }));

    await waitFor(() => expect(disableTwoFactor).toHaveBeenCalledOnce());
    const submitted = disableTwoFactor.mock.calls[0][0] as FormData;
    expect(submitted.get("currentPassword")).toBe("hunter2");
    expect(submitted.get("code")).toBe("123456");
  });

  it("regenerates codes with the password alone", async () => {
    // Losing the codes is the usual reason to be here, so demanding the
    // authenticator too would lock out exactly the person this helps.
    regenerateRecoveryCodes.mockResolvedValue({
      success: true,
      recoveryCodes: CODES,
    });
    renderWithI18n(<TwoFactorCard isEnabled isAvailable />);

    await userEvent.type(screen.getByLabelText(/your password/i), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: /generate new recovery codes/i }));

    expect(await screen.findByText(/save your recovery codes/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<TwoFactorCard isEnabled isAvailable />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
