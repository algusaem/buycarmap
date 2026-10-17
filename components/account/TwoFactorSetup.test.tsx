import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { confirmTwoFactorSetup } from "@/server/two-factor/actions";
import { TwoFactorSetup } from "./TwoFactorSetup";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/server/two-factor/actions", () => ({
  confirmTwoFactorSetup: vi.fn(),
}));

// Deliberately NOT mocking react-qr-code here. Flow tests may stub it
// to keep those tests about the flow; this file exists to prove the dependency
// itself renders in this environment, which a stub can never show.
const URI = "otpauth://totp/BuyCarMap:ada@example.com?secret=JBSWY3DPEHPK3PXP";

describe("TwoFactorSetup QR rendering", () => {
  it("renders a real SVG QR code from the otpauth URI", () => {
    const { container } = renderWithI18n(
      <TwoFactorSetup otpauthUri={URI} secret="JBSWY3DPEHPK3PXP" onConfirmed={vi.fn()} />,
    );

    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    if (!svg) throw new Error("expected the QR code svg to be rendered");
    // A QR is drawn as many small rects; an empty or failed render would not
    // produce them.
    expect(svg.querySelectorAll("path, rect").length).toBeGreaterThan(1);
  });

  it("renders on a light plate, which scanners need: the `text` token, the modules in `bg` (PAGES-44)", () => {
    const { container } = renderWithI18n(
      <TwoFactorSetup otpauthUri={URI} secret="JBSWY3DPEHPK3PXP" onConfirmed={vi.fn()} />,
    );

    // The app is dark by default; a QR on a dark surface fails to scan. The
    // plate is the `text` token rather than pure white, which the system bans
    // (docs/specs/redesign-pages.md, Decisions › Taken by the design).
    expect(container.querySelector(".bg-text")).not.toBeNull();
  });

  it("PAGES-44: shows the secret for anyone who cannot scan, in a read-only field selected whole", () => {
    renderWithI18n(
      <TwoFactorSetup otpauthUri={URI} secret="JBSWY3DPEHPK3PXP" onConfirmed={vi.fn()} />,
    );

    const key = screen.getByRole("textbox", { name: "Can't scan? Enter this key manually" });
    expect(key).toHaveValue("JBSWY3DPEHPK3PXP");
    expect(key).toHaveAttribute("readonly");
    // PAGES-76: the step opens with the focus on its first control, the key, selected whole.
    expect(key).toHaveFocus();
    expect((key as HTMLInputElement).selectionStart).toBe(0);
    expect((key as HTMLInputElement).selectionEnd).toBe("JBSWY3DPEHPK3PXP".length);
  });

  it("PAGES-44: «Turn on two-factor» is enabled before a code is typed; an empty code is the error under the code field and sends nothing", async () => {
    vi.mocked(confirmTwoFactorSetup).mockReset();
    renderWithI18n(
      <TwoFactorSetup otpauthUri={URI} secret="JBSWY3DPEHPK3PXP" onConfirmed={vi.fn()} />,
    );

    const submit = screen.getByRole("button", { name: "Turn on two-factor" });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    const code = screen.getByRole("textbox", { name: "Enter the 6-digit code" });
    expect(code).toHaveAttribute("name", "code");
    expect(code).toHaveAttribute("spellcheck", "false");
    expect(
      await screen.findByText("That code isn't valid. Check your app and try again."),
    ).toBeInTheDocument();
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(confirmTwoFactorSetup).not.toHaveBeenCalled();
  });

  it("PAGES-44: a code the server refuses is the error under the code field, which takes the focus", async () => {
    vi.mocked(confirmTwoFactorSetup).mockReset();
    vi.mocked(confirmTwoFactorSetup).mockResolvedValue({ success: false, error: "totpInvalid" });
    renderWithI18n(
      <TwoFactorSetup otpauthUri={URI} secret="JBSWY3DPEHPK3PXP" onConfirmed={vi.fn()} />,
    );

    const code = screen.getByRole("textbox", { name: "Enter the 6-digit code" });
    await userEvent.type(code, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Turn on two-factor" }));

    await waitFor(() => expect(confirmTwoFactorSetup).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("That code isn't valid. Check your app and try again."),
    ).toBeInTheDocument();
    expect(code).toHaveFocus();
  });
});
