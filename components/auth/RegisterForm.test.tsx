import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { RegisterForm } from "./RegisterForm";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
const signIn = vi.fn().mockResolvedValue({ error: null, ok: true });
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const registerUser = vi.fn();
vi.mock("@/app/actions/register", () => ({
  register: (...args: unknown[]) => registerUser(...args),
}));
import { toast } from "sonner";

async function fillValid() {
  await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "longenough");
  await userEvent.type(
    screen.getByLabelText("Confirm password"),
    "longenough",
  );
}

const submit = () =>
  userEvent.click(screen.getByRole("button", { name: "Sign up" }));

describe("RegisterForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    registerUser.mockReset();
  });

  it("blocks submission and shows an error when passwords do not match", async () => {
    renderWithI18n(<RegisterForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "longenough");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "different",
    );
    await submit();

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("registers then signs in on success", async () => {
    registerUser.mockResolvedValue({ success: true });
    renderWithI18n(<RegisterForm />);

    await fillValid();
    await submit();

    await waitFor(() => expect(registerUser).toHaveBeenCalledOnce());
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "ada@example.com",
      password: "longenough",
      redirect: false,
    });
  });

  it("surfaces the action error and does not sign in on failure", async () => {
    registerUser.mockResolvedValue({
      success: false,
      error: "An account with this email already exists",
    });
    signIn.mockClear();
    renderWithI18n(<RegisterForm />);

    await fillValid();
    await submit();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "An account with this email already exists",
      ),
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("includes the name in the submitted form data when one is entered", async () => {
    registerUser.mockResolvedValue({ success: true });
    renderWithI18n(<RegisterForm />);

    await userEvent.type(screen.getByLabelText("Name"), "Ada Lovelace");
    await fillValid();
    await submit();

    await waitFor(() => expect(registerUser).toHaveBeenCalled());
    const submitted = registerUser.mock.calls[0][0] as FormData;
    expect(submitted.get("name")).toBe("Ada Lovelace");
  });

  it("routes to /login if auto sign-in fails after a successful register", async () => {
    registerUser.mockResolvedValue({ success: true });
    signIn.mockResolvedValueOnce({ error: "CredentialsSignin", ok: false });
    renderWithI18n(<RegisterForm />);

    await fillValid();
    await submit();

    // Account was created, but the follow-up sign-in failed: send them to login
    // rather than an unauthenticated home page.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(push).not.toHaveBeenCalledWith("/");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<RegisterForm />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
