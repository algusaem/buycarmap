import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { LoginForm } from "./LoginForm";

// Mutable so a test can simulate arriving with ?callbackUrl=… from middleware.
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));
// BAUTH-3 (docs/specs/core-better-auth.md), harness change: LoginForm now
// calls server/auth/actions.ts's `signIn` server action (through
// `auth.api.signInEmail`), not NextAuth's `next-auth/react` `signIn`. No
// OAuth provider is configured in these tests, so `<LoginForm oauthProviders={[]} />`
// renders nothing for OAuthButtons — the equivalent of the old
// `getProviders` mock resolving to `{}`.
const signIn = vi.fn();
const verifySignInTotp = vi.fn();
const verifySignInBackupCode = vi.fn();
vi.mock("@/server/auth/actions", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  verifySignInTotp: (...args: unknown[]) => verifySignInTotp(...args),
  verifySignInBackupCode: (...args: unknown[]) => verifySignInBackupCode(...args),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function submittedFormData(): FormData {
  return signIn.mock.calls.at(-1)?.[0] as FormData;
}

// BAUTH-1 (docs/specs/core-better-auth.md), harness change: a successful
// sign-in now does a full `window.location.href` navigation, not a
// client-side `router.push` — Better Auth's client only refetches its
// session on one of its own mutation paths or a fresh mount, neither of
// which a client-side route change triggers. jsdom's own `window.location`
// is read-only, so it is replaced with a plain, writable stand-in.
let location: { href: string };
function stubLocation(): void {
  location = { href: "" };
  Object.defineProperty(window, "location", {
    value: location,
    writable: true,
    configurable: true,
  });
}

describe("LoginForm", () => {
  beforeEach(() => {
    signIn.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  it("does not sign in when the email is malformed", async () => {
    // The email field is type="email"; the browser's native constraint
    // validation blocks submission of a malformed value before onSubmit runs.
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "whatever");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await new Promise((r) => setTimeout(r, 50));
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows required-field errors when submitting empty", async () => {
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    // The schema emits the code "emailRequired"; this asserts the rendered
    // English, which proves the code→copy resolution actually runs.
    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in with the credentials on a valid submit", async () => {
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(signIn).toHaveBeenCalledOnce());
    const formData = submittedFormData();
    expect(formData.get("email")).toBe("ada@example.com");
    expect(formData.get("password")).toBe("secret123");
  });

  it("shows an error and does not redirect on invalid credentials", async () => {
    signIn.mockResolvedValue({ success: false, error: "generic" });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(location.href).toBe("");
  });

  it("reports rate limiting distinctly from bad credentials", async () => {
    signIn.mockResolvedValue({ success: false, error: "rateLimited" });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

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
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(location.href).toBe("/account"));
  });

  it("ignores an absolute callbackUrl pointing at another origin", async () => {
    // Honouring this would turn the sign-in page into an open redirect that a
    // phishing link could bounce a freshly-authenticated user through.
    searchParams = new URLSearchParams("callbackUrl=https://evil.example.com");
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(location.href).toBe("/"));
  });

  it("ignores a protocol-relative callbackUrl", async () => {
    // "//evil.example.com" starts with "/" but browsers resolve it to another
    // host, so a naive startsWith("/") check would let it through.
    searchParams = new URLSearchParams("callbackUrl=//evil.example.com");
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(location.href).toBe("/"));
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<LoginForm oauthProviders={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("LoginForm two-factor step", () => {
  const codeField = () => screen.queryByLabelText(/enter the 6-digit code/i);

  beforeEach(() => {
    signIn.mockReset();
    verifySignInTotp.mockReset();
    verifySignInBackupCode.mockReset();
    // The sonner mock is module-level, so calls accumulate across tests unless
    // cleared — an assertion of "not called" would otherwise see an earlier one.
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  async function submitCredentials() {
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  }

  it("hides the code field until the server asks for one", async () => {
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    // Showing it up front would tell every visitor which accounts use 2FA.
    expect(codeField()).not.toBeInTheDocument();
  });

  it("reveals the code field, without an error, when a code is required", async () => {
    signIn.mockResolvedValue({ success: false, twoFactorRequired: true });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await submitCredentials();

    await waitFor(() => expect(codeField()).toBeInTheDocument());
    // Nothing has gone wrong yet — this is a step, not a failure.
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("sends a 6-digit code to verifySignInTotp on the second attempt", async () => {
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await submitCredentials();
    await waitFor(() => expect(codeField()).toBeInTheDocument());

    verifySignInTotp.mockResolvedValueOnce({ success: true });
    const codeInput = codeField();
    if (!codeInput) throw new Error("expected the 6-digit code field to be present");
    await userEvent.type(codeInput, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(verifySignInTotp).toHaveBeenCalledOnce());
    const formData = verifySignInTotp.mock.calls[0][0] as FormData;
    // BAUTH-3 (security review fix): no email is sent for the two-factor
    // step — the signed challenge cookie identifies the account.
    expect(formData.get("email")).toBeNull();
    expect(formData.get("code")).toBe("123456");
    expect(verifySignInBackupCode).not.toHaveBeenCalled();
  });

  it("sends a recovery code to verifySignInBackupCode instead", async () => {
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await submitCredentials();
    await waitFor(() => expect(codeField()).toBeInTheDocument());

    verifySignInBackupCode.mockResolvedValueOnce({ success: true });
    const codeInput = codeField();
    if (!codeInput) throw new Error("expected the 6-digit code field to be present");
    await userEvent.type(codeInput, "ABCDE-FGHJK-MNPQR");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(verifySignInBackupCode).toHaveBeenCalledOnce());
    const formData = verifySignInBackupCode.mock.calls[0][0] as FormData;
    expect(formData.get("email")).toBeNull();
    expect(formData.get("code")).toBe("ABCDE-FGHJK-MNPQR");
    expect(verifySignInTotp).not.toHaveBeenCalled();
  });

  it("reports a wrong code on the field and keeps it open", async () => {
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    verifySignInTotp.mockResolvedValue({ success: false, error: "totpInvalid" });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await submitCredentials();
    await waitFor(() => expect(codeField()).toBeInTheDocument());
    const codeInput = codeField();
    if (!codeInput) throw new Error("expected the 6-digit code field to be present");
    await userEvent.type(codeInput, "000000");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(/that code isn't valid/i)).toBeInTheDocument();
    expect(codeField()).toBeInTheDocument();
    expect(location.href).toBe("");
  });

  it("still shows the generic message for bad credentials", async () => {
    signIn.mockResolvedValue({ success: false, error: "generic" });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await submitCredentials();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Invalid email or password"));
    // No hint about two-factor for someone who never proved the password.
    expect(codeField()).not.toBeInTheDocument();
  });
});

describe("LoginForm OAuth rejection message", () => {
  beforeEach(() => {
    stubLocation();
    signIn.mockReset();
    searchParams = new URLSearchParams();
  });

  it("says nothing when there is no error in the URL", () => {
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains a blocked provider link instead of failing silently", async () => {
    // Security review fix: Better Auth's implicit-link refusal
    // (oauth2/link-account.mjs) redirects here with ?error=account_not_linked
    // when the local account's email isn't verified, or
    // ?error=unable_to_link_account when our own
    // databaseHooks.account.create.before hook blocks the link (e.g.
    // two-factor on) — not NextAuth's old ?error=AccessDenied, which this
    // app's OAuth callback never produces. The previous copy here read "This
    // account uses two-factor authentication. Sign in with your password
    // first, then connect this provider from your account settings." —
    // replaced because explicit linking from /account is not offered.
    searchParams = new URLSearchParams("error=account_not_linked");
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/sign in with your email and password/i);
  });

  it("explains the other link-refusal code the same way", async () => {
    searchParams = new URLSearchParams("error=unable_to_link_account");
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
  });

  it("falls back to a generic message for any other OAuth error", async () => {
    searchParams = new URLSearchParams("error=OAuthCallback");
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
  });
});

describe("LoginForm recovery code discoverability", () => {
  beforeEach(() => {
    stubLocation();
    signIn.mockReset();
    searchParams = new URLSearchParams();
  });

  it("tells the user a recovery code goes in the same field", async () => {
    // The label says "6-digit code", but the field also accepts recovery
    // codes. Someone whose phone is lost would otherwise have no way to know.
    signIn.mockResolvedValue({ success: false, twoFactorRequired: true });
    renderWithI18n(<LoginForm oauthProviders={[]} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(/lost your phone\? enter one of your recovery codes/i),
    ).toBeInTheDocument();
  });
});
