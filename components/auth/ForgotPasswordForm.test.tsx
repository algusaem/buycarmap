import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

// I18nProvider (via renderWithI18n) calls useRouter; the form itself uses Link.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const requestPasswordReset = vi.fn();
vi.mock("@/app/actions/forgot-password", () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
}));
import { toast } from "sonner";

const submit = () =>
  userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    requestPasswordReset.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("swaps to the confirmation state and passes the email to the action", async () => {
    requestPasswordReset.mockResolvedValue({ success: true });
    renderWithI18n(<ForgotPasswordForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await submit();

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    // The form is replaced by the confirmation — the input is gone.
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();

    const fd = requestPasswordReset.mock.calls[0][0] as FormData;
    expect(fd.get("email")).toBe("ada@example.com");
  });

  it("surfaces the action error and stays on the form", async () => {
    requestPasswordReset.mockResolvedValue({
      success: false,
      error: "Something went wrong. Please try again.",
    });
    renderWithI18n(<ForgotPasswordForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await submit();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      ),
    );
    // Still on the form, not the confirmation.
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });

  it("blocks submission with an inline error when the email is empty", async () => {
    renderWithI18n(<ForgotPasswordForm />);

    await submit();

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<ForgotPasswordForm />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
