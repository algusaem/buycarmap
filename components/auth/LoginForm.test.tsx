import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { LoginForm } from "./LoginForm";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
const signIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("LoginForm", () => {
  it("does not sign in when the email is malformed", async () => {
    // The email field is type="email"; the browser's native constraint
    // validation blocks submission of a malformed value before onSubmit runs.
    renderWithI18n(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "whatever");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await new Promise((r) => setTimeout(r, 50));
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows required-field errors when submitting empty", async () => {
    renderWithI18n(<LoginForm />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in with the credentials on a valid submit", async () => {
    signIn.mockResolvedValue({ error: null, ok: true });
    renderWithI18n(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "ada@example.com",
        password: "secret123",
        redirect: false,
      }),
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<LoginForm />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
