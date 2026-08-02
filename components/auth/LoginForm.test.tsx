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
        // Always sent, empty until the server asks for a two-factor code.
        totp: "",
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

describe("LoginForm two-factor step", () => {
  const codeField = () => screen.queryByLabelText(/enter the 6-digit code/i);

  beforeEach(() => {
    push.mockReset();
    signIn.mockReset();
    // The sonner mock is module-level, so calls accumulate across tests unless
    // cleared — an assertion of "not called" would otherwise see an earlier one.
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
    searchParams = new URLSearchParams();
  });

  async function submitCredentials() {
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  }

  it("hides the code field until the server asks for one", async () => {
    renderWithI18n(<LoginForm />);

    // Showing it up front would tell every visitor which accounts use 2FA.
    expect(codeField()).not.toBeInTheDocument();
  });

  it("reveals the code field, without an error, when a code is required", async () => {
    signIn.mockResolvedValue({ error: "totpRequired", ok: false });
    renderWithI18n(<LoginForm />);

    await submitCredentials();

    await waitFor(() => expect(codeField()).toBeInTheDocument());
    // Nothing has gone wrong yet — this is a step, not a failure.
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("sends the code on the second attempt", async () => {
    signIn.mockResolvedValueOnce({ error: "totpRequired", ok: false });
    renderWithI18n(<LoginForm />);

    await submitCredentials();
    await waitFor(() => expect(codeField()).toBeInTheDocument());

    signIn.mockResolvedValueOnce({ error: null, ok: true });
    await userEvent.type(codeField()!, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(signIn).toHaveBeenLastCalledWith("credentials", {
        email: "ada@example.com",
        password: "secret123",
        totp: "123456",
        redirect: false,
      }),
    );
  });

  it("reports a wrong code on the field and keeps it open", async () => {
    signIn.mockResolvedValue({ error: "totpInvalid", ok: false });
    renderWithI18n(<LoginForm />);

    await submitCredentials();

    expect(
      await screen.findByText(/that code isn't valid/i),
    ).toBeInTheDocument();
    expect(codeField()).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("still shows the generic message for bad credentials", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin", ok: false });
    renderWithI18n(<LoginForm />);

    await submitCredentials();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Invalid email or password"),
    );
    // No hint about two-factor for someone who never proved the password.
    expect(codeField()).not.toBeInTheDocument();
  });
});

describe("LoginForm OAuth rejection message", () => {
  beforeEach(() => {
    push.mockReset();
    signIn.mockReset();
    searchParams = new URLSearchParams();
  });

  it("says nothing when there is no error in the URL", () => {
    renderWithI18n(<LoginForm />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains a blocked provider link instead of failing silently", async () => {
    // NextAuth redirects here with ?error=AccessDenied when the signIn callback
    // refuses to link a new provider to a two-factor account.
    searchParams = new URLSearchParams("error=AccessDenied");
    renderWithI18n(<LoginForm />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /uses two-factor authentication/i,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /connect this provider from your account settings/i,
    );
  });

  it("falls back to a generic message for any other OAuth error", async () => {
    searchParams = new URLSearchParams("error=OAuthCallback");
    renderWithI18n(<LoginForm />);

    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
  });
});

describe("LoginForm recovery code discoverability", () => {
  beforeEach(() => {
    push.mockReset();
    signIn.mockReset();
    searchParams = new URLSearchParams();
  });

  it("tells the user a recovery code goes in the same field", async () => {
    // The label says "6-digit code", but the field also accepts recovery
    // codes. Someone whose phone is lost would otherwise have no way to know.
    signIn.mockResolvedValue({ error: "totpRequired", ok: false });
    renderWithI18n(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(/lost your phone\? enter one of your recovery codes/i),
    ).toBeInTheDocument();
  });
});
