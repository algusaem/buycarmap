import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { ResetPasswordForm } from "./ResetPasswordForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const resetPassword = vi.fn();
vi.mock("@/app/actions/reset-password", () => ({
  resetPassword: (...args: unknown[]) => resetPassword(...args),
}));

const STRONG_PASSWORD = "harbour-lentil-quilt";
const TOKEN = "token-from-the-emailed-link";

async function fillValid() {
  await userEvent.type(screen.getByLabelText("New password"), STRONG_PASSWORD);
  await userEvent.type(screen.getByLabelText("Confirm password"), STRONG_PASSWORD);
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "Update password" }));

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    push.mockReset();
    resetPassword.mockReset();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  it("submits the token from the URL alongside the new password", async () => {
    resetPassword.mockResolvedValue({ success: true });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await fillValid();
    await submit();

    await waitFor(() => expect(resetPassword).toHaveBeenCalledOnce());
    const submitted = resetPassword.mock.calls[0][0] as FormData;
    expect(submitted.get("token")).toBe(TOKEN);
    expect(submitted.get("password")).toBe(STRONG_PASSWORD);
  });

  it("does not expose the token as an editable field", () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    // The token belongs to the URL, not to something a user can retype.
    expect(screen.queryByDisplayValue(TOKEN)).not.toBeInTheDocument();
  });

  it("blocks submission when the confirmation does not match", async () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await userEvent.type(screen.getByLabelText("New password"), STRONG_PASSWORD);
    await userEvent.type(screen.getByLabelText("Confirm password"), "something-different");
    await submit();

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("blocks submission for a password under the minimum length", async () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await userEvent.type(screen.getByLabelText("New password"), "abcdefghijk");
    await userEvent.type(screen.getByLabelText("Confirm password"), "abcdefghijk");
    await submit();

    expect(await screen.findByText("Use at least 12 characters")).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("shows a breached-password rejection on the field, not as a toast", async () => {
    // The user has to change what they typed, so the message belongs where
    // they are looking rather than in something that disappears.
    resetPassword.mockResolvedValue({
      success: false,
      error: "passwordBreached",
    });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await fillValid();
    await submit();

    expect(
      await screen.findByText(
        "This password has appeared in a known data breach. Please choose a different one.",
      ),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts an expired-link rejection, which no field can fix", async () => {
    resetPassword.mockResolvedValue({ success: false, error: "tokenInvalid" });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await fillValid();
    await submit();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This link is invalid or has expired"),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("sends the user to sign in after a successful reset", async () => {
    resetPassword.mockResolvedValue({ success: true });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await fillValid();
    await submit();

    // Deliberately not auto-signed-in: the reset invalidated every session,
    // and entering the new password once confirms it was memorized.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("rates the new password as the user types", async () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await userEvent.type(screen.getByLabelText("New password"), "password");

    expect(await screen.findByText("Very weak")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<ResetPasswordForm token={TOKEN} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
