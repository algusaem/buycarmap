import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { ChangePasswordForm } from "./ChangePasswordForm";

// I18nProvider calls useRouter to refresh after a locale switch, which needs an
// app-router context this form never provides.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn(async () => ({ ok: true })) }));
const changePassword = vi.fn();
vi.mock("@/server/account/actions", () => ({
  changePassword: (...args: unknown[]) => changePassword(...args),
}));

const EMAIL = "ada@example.com";
const CURRENT = "old-quarry-marble";
const NEW_PASSWORD = "harbour-lentil-quilt";

async function fillValid() {
  await userEvent.type(screen.getByLabelText("Current password"), CURRENT);
  await userEvent.type(screen.getByLabelText("New password"), NEW_PASSWORD);
  await userEvent.type(screen.getByLabelText("Confirm new password"), NEW_PASSWORD);
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "Update password" }));

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    changePassword.mockReset();
    changePassword.mockResolvedValue({ success: true });
    vi.mocked(signIn).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  it("submits the current password alongside the new one", async () => {
    renderWithI18n(<ChangePasswordForm email={EMAIL} />);

    await fillValid();
    await submit();

    await waitFor(() => expect(changePassword).toHaveBeenCalledOnce());
    const submitted = changePassword.mock.calls[0][0] as FormData;
    expect(submitted.get("currentPassword")).toBe(CURRENT);
    expect(submitted.get("password")).toBe(NEW_PASSWORD);
    expect(submitted.get("confirmPassword")).toBe(NEW_PASSWORD);
  });

  it("blocks submission when the confirmation does not match", async () => {
    renderWithI18n(<ChangePasswordForm email={EMAIL} />);

    await userEvent.type(screen.getByLabelText("Current password"), CURRENT);
    await userEvent.type(screen.getByLabelText("New password"), NEW_PASSWORD);
    await userEvent.type(screen.getByLabelText("Confirm new password"), "something-different");
    await submit();

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("puts a wrong current password on that field rather than in a toast", async () => {
    changePassword.mockResolvedValue({
      success: false,
      error: "currentPasswordIncorrect",
    });
    renderWithI18n(<ChangePasswordForm email={EMAIL} />);

    await fillValid();
    await submit();

    expect(await screen.findByText("Your current password is incorrect")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("puts a breached new password on the new-password field", async () => {
    changePassword.mockResolvedValue({
      success: false,
      error: "passwordBreached",
    });
    renderWithI18n(<ChangePasswordForm email={EMAIL} />);

    await fillValid();
    await submit();

    expect(
      await screen.findByText(
        "This password has appeared in a known data breach. Please choose a different one.",
      ),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts a rejection no field can fix", async () => {
    changePassword.mockResolvedValue({ success: false, error: "rateLimited" });
    renderWithI18n(<ChangePasswordForm email={EMAIL} />);

    await fillValid();
    await submit();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Too many attempts. Please wait a few minutes and try again.",
      ),
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("silently re-authenticates so this device stays signed in", async () => {
    renderWithI18n(<ChangePasswordForm email={EMAIL} />);

    await fillValid();
    await submit();

    // The change bumped `passwordChangedAt`, which revokes every JWT issued
    // before it — including this tab's. Without this the user would be signed
    // out of the very page they just used.
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: EMAIL,
        password: NEW_PASSWORD,
        redirect: false,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Password updated."));
  });

  it("clears the fields once the change succeeded", async () => {
    renderWithI18n(<ChangePasswordForm email={EMAIL} />);

    await fillValid();
    await submit();

    // Leaving the old and new passwords sitting in the form of a shared or
    // unattended browser is exactly what this page exists to prevent.
    await waitFor(() => expect(screen.getByLabelText("New password")).toHaveValue(""));
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<ChangePasswordForm email={EMAIL} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
