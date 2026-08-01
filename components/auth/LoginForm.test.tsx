import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { LoginForm } from "./LoginForm";

const push = vi.fn();
const refresh = vi.fn();
// Mutable so a test can simulate arriving with ?callbackUrl=… from middleware.
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => searchParams,
}));
const signIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  // OAuthButtons asks which providers exist; none configured in tests, so it
  // renders nothing.
  getProviders: async () => ({}),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("LoginForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    signIn.mockReset();
    searchParams = new URLSearchParams();
  });

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

    // The schema emits the code "emailRequired"; this asserts the rendered
    // English, which proves the code→copy resolution actually runs.
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

  it("shows an error and does not redirect on invalid credentials", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin", ok: false });
    renderWithI18n(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("reports rate limiting distinctly from bad credentials", async () => {
    signIn.mockResolvedValue({ error: "rateLimited", ok: false });
    renderWithI18n(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Too many attempts. Please wait a few minutes and try again.",
      ),
    );
  });

  it("returns to the path middleware saved after a successful sign-in", async () => {
    searchParams = new URLSearchParams("callbackUrl=/account");
    signIn.mockResolvedValue({ error: null, ok: true });
    renderWithI18n(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/account"));
  });

  it("ignores an absolute callbackUrl pointing at another origin", async () => {
    // Honouring this would turn the sign-in page into an open redirect that a
    // phishing link could bounce a freshly-authenticated user through.
    searchParams = new URLSearchParams("callbackUrl=https://evil.example.com");
    signIn.mockResolvedValue({ error: null, ok: true });
    renderWithI18n(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("ignores a protocol-relative callbackUrl", async () => {
    // "//evil.example.com" starts with "/" but browsers resolve it to another
    // host, so a naive startsWith("/") check would let it through.
    searchParams = new URLSearchParams("callbackUrl=//evil.example.com");
    signIn.mockResolvedValue({ error: null, ok: true });
    renderWithI18n(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<LoginForm />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
