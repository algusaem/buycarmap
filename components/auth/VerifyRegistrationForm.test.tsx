import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { VerifyRegistrationForm } from "./VerifyRegistrationForm";

// I18nProvider calls useRouter, which needs an app-router context jsdom lacks.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const verifyRegistration = vi.fn();
vi.mock("@/app/actions/verify-registration", () => ({
  verifyRegistration: (...args: unknown[]) => verifyRegistration(...args),
}));

const TOKEN = "token-from-the-emailed-link";

const confirmButton = () =>
  screen.getByRole("button", { name: "Confirm my account" });

describe("VerifyRegistrationForm", () => {
  beforeEach(() => {
    verifyRegistration.mockReset();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  it("does not confirm on render", () => {
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    // Mail scanners fetch every link in an inbox. Confirming on page load
    // would let a scanner burn the token before the recipient sees this.
    expect(verifyRegistration).not.toHaveBeenCalled();
    expect(confirmButton()).toBeInTheDocument();
  });

  it("submits the token from the URL when the button is pressed", async () => {
    verifyRegistration.mockResolvedValue({
      success: true,
      email: "ada@example.com",
    });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    await userEvent.click(confirmButton());

    await waitFor(() => expect(verifyRegistration).toHaveBeenCalledOnce());
    const submitted = verifyRegistration.mock.calls[0][0] as FormData;
    expect(submitted.get("token")).toBe(TOKEN);
  });

  it("offers a route to sign in once confirmed", async () => {
    verifyRegistration.mockResolvedValue({
      success: true,
      email: "ada@example.com",
    });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    await userEvent.click(confirmButton());

    expect(await screen.findByText("You're all set")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to sign in" }),
    ).toBeInTheDocument();
  });

  it("surfaces an expired link and keeps the button available", async () => {
    verifyRegistration.mockResolvedValue({
      success: false,
      error: "tokenInvalid",
    });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    await userEvent.click(confirmButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This link is invalid or has expired",
      ),
    );
    // No dead end: the user can retry rather than being stranded.
    await waitFor(() => expect(confirmButton()).toBeEnabled());
  });

  it("does not claim success when confirmation failed", async () => {
    verifyRegistration.mockResolvedValue({
      success: false,
      error: "tokenInvalid",
    });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    await userEvent.click(confirmButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <VerifyRegistrationForm token={TOKEN} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
