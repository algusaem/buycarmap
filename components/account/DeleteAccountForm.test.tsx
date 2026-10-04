import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { DeleteAccountForm } from "./DeleteAccountForm";

// BAUTH-1 (docs/specs/core-better-auth.md), harness change: deletion now
// calls `authClient.signOut()` (Better Auth), not NextAuth's
// `next-auth/react` `signOut`.
const signOut = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signOut: (...args: unknown[]) => signOut(...args) },
}));
// I18nProvider calls useRouter, which needs an app-router context jsdom lacks.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const deleteAccount = vi.fn();
vi.mock("@/server/account/actions", () => ({
  deleteAccount: (...args: unknown[]) => deleteAccount(...args),
}));

const deleteButton = () => screen.getByRole("button", { name: "Delete my account" });

describe("DeleteAccountForm confirmation gate", () => {
  beforeEach(() => {
    signOut.mockReset();
    push.mockReset();
    deleteAccount.mockReset();
    vi.mocked(toast.error).mockClear();
  });

  it("starts disabled", () => {
    renderWithI18n(<DeleteAccountForm hasPassword />);

    // Deletion is irreversible and cascades, so it must never be one mis-tap.
    expect(deleteButton()).toBeDisabled();
  });

  it("stays disabled until both the password and the exact word are given", async () => {
    renderWithI18n(<DeleteAccountForm hasPassword />);

    await userEvent.type(screen.getByLabelText("Your password"), "hunter2");
    expect(deleteButton()).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    expect(deleteButton()).toBeEnabled();
  });

  it("rejects the confirmation word in the wrong case", async () => {
    renderWithI18n(<DeleteAccountForm hasPassword />);

    await userEvent.type(screen.getByLabelText("Your password"), "hunter2");
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm"), "delete");

    // Requiring capitals is the point: it cannot be typed absent-mindedly.
    expect(deleteButton()).toBeDisabled();
  });

  it("does not ask an OAuth-only account for a password", async () => {
    renderWithI18n(<DeleteAccountForm hasPassword={false} />);

    expect(screen.queryByLabelText("Your password")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    expect(deleteButton()).toBeEnabled();
  });
});

describe("DeleteAccountForm submission", () => {
  beforeEach(() => {
    signOut.mockReset();
    push.mockReset();
    deleteAccount.mockReset();
    vi.mocked(toast.error).mockClear();
  });

  async function arm() {
    await userEvent.type(screen.getByLabelText("Your password"), "hunter2");
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
  }

  it("submits the password and signs the user out on success", async () => {
    deleteAccount.mockResolvedValue({ success: true });
    renderWithI18n(<DeleteAccountForm hasPassword />);

    await arm();
    await userEvent.click(deleteButton());

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledOnce());
    const submitted = deleteAccount.mock.calls[0][0] as FormData;
    expect(submitted.get("password")).toBe("hunter2");

    // The user row is gone; clear the cookie now rather than waiting for the
    // next revalidation to notice.
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/");
  });

  it("surfaces a wrong-password rejection and stays signed in", async () => {
    deleteAccount.mockResolvedValue({
      success: false,
      error: "currentPasswordIncorrect",
    });
    renderWithI18n(<DeleteAccountForm hasPassword />);

    await arm();
    await userEvent.click(deleteButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Your current password is incorrect"),
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  it("re-enables the button after a failure so the user can retry", async () => {
    deleteAccount.mockResolvedValue({
      success: false,
      error: "currentPasswordIncorrect",
    });
    renderWithI18n(<DeleteAccountForm hasPassword />);

    await arm();
    await userEvent.click(deleteButton());

    await waitFor(() => expect(deleteButton()).toBeEnabled());
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<DeleteAccountForm hasPassword />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
