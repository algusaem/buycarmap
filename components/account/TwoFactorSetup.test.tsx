import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "@/test/utils/render";
import { TwoFactorSetup } from "./TwoFactorSetup";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/actions/two-factor", () => ({
  confirmTwoFactorSetup: vi.fn(),
}));

// Deliberately NOT mocking react-qr-code here. TwoFactorCard.test.tsx stubs it
// to keep those tests about the flow; this file exists to prove the dependency
// itself renders in this environment, which a stub can never show.
const URI = "otpauth://totp/BuyCarMap:ada@example.com?secret=JBSWY3DPEHPK3PXP";

describe("TwoFactorSetup QR rendering", () => {
  it("renders a real SVG QR code from the otpauth URI", () => {
    const { container } = renderWithI18n(
      <TwoFactorSetup
        otpauthUri={URI}
        secret="JBSWY3DPEHPK3PXP"
        onConfirmed={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    if (!svg) throw new Error("expected the QR code svg to be rendered");
    // A QR is drawn as many small rects; an empty or failed render would not
    // produce them.
    expect(svg.querySelectorAll("path, rect").length).toBeGreaterThan(1);
  });

  it("renders on a light plate, which scanners need", () => {
    const { container } = renderWithI18n(
      <TwoFactorSetup
        otpauthUri={URI}
        secret="JBSWY3DPEHPK3PXP"
        onConfirmed={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // The app is dark by default; a QR on a dark surface fails to scan.
    expect(container.querySelector(".bg-white")).not.toBeNull();
  });

  it("shows the secret for anyone who cannot scan", () => {
    renderWithI18n(
      <TwoFactorSetup
        otpauthUri={URI}
        secret="JBSWY3DPEHPK3PXP"
        onConfirmed={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
  });

  it("keeps the confirm button disabled until a code is typed", () => {
    renderWithI18n(
      <TwoFactorSetup
        otpauthUri={URI}
        secret="JBSWY3DPEHPK3PXP"
        onConfirmed={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /turn on two-factor/i })).toBeDisabled();
  });
});
