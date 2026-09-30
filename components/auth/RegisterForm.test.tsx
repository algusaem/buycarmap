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
// OAuthButtons asks which providers exist. Mutable so one test can put the
// page in the configured state without the rest paying for the extra buttons.
let oauthProviders: Record<string, { id: string; name: string; type: string }> = {};
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  getProviders: async () => oauthProviders,
}));
// GoogleSignInButton resolves Google's palette from the theme.
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const registerUser = vi.fn();
vi.mock("@/server/registration/actions", () => ({
  register: (...args: unknown[]) => registerUser(...args),
}));
import { toast } from "sonner";

// Clears the 12-character floor and the strength scorer. Kept as a constant so
// the policy change is visible in one place.
const STRONG_PASSWORD = "harbour-lentil-quilt";

async function fillValid() {
  await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
  await userEvent.type(screen.getByLabelText("Password"), STRONG_PASSWORD);
  await userEvent.type(screen.getByLabelText("Confirm password"), STRONG_PASSWORD);
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "Sign up" }));

describe("RegisterForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    registerUser.mockReset();
    oauthProviders = {};
  });

  it("offers the configured OAuth providers alongside the signup form", async () => {
    // There is no separate OAuth "register" — NextAuth creates the account on
    // first sign-in — so this page must surface the option rather than hiding
    // it behind the login page.
    oauthProviders = {
      google: { id: "google", name: "Google", type: "oauth" },
    };
    renderWithI18n(<RegisterForm />);

    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    // The password form is still the primary path, not replaced by it.
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
  });

  it("shows no provider section when none is configured", async () => {
    renderWithI18n(<RegisterForm />);

    await screen.findByRole("button", { name: "Sign up" });
    expect(screen.queryByRole("button", { name: /continue with/i })).not.toBeInTheDocument();
  });

  it("blocks submission and shows an error when passwords do not match", async () => {
    renderWithI18n(<RegisterForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), STRONG_PASSWORD);
    await userEvent.type(screen.getByLabelText("Confirm password"), "different");
    await submit();

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("shows the neutral check-your-inbox panel when confirmation is pending", async () => {
    // The action returns this identically for a free address and a taken one,
    // so the panel must not hint at which case occurred — and must not attempt
    // a sign-in, since no account exists yet.
    registerUser.mockResolvedValue({ success: true, pending: true });
    signIn.mockClear();
    renderWithI18n(<RegisterForm />);

    await fillValid();
    await submit();

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/If that address can be used for a new account/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("hides the form once confirmation is pending", async () => {
    registerUser.mockResolvedValue({ success: true, pending: true });
    renderWithI18n(<RegisterForm />);

    await fillValid();
    await submit();

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Sign up" })).not.toBeInTheDocument(),
    );
  });

  it("registers then signs in when the account was created immediately", async () => {
    // `pending: false` is the no-email-configured fallback.
    registerUser.mockResolvedValue({ success: true, pending: false });
    renderWithI18n(<RegisterForm />);

    await fillValid();
    await submit();

    await waitFor(() => expect(registerUser).toHaveBeenCalledOnce());
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "ada@example.com",
      password: STRONG_PASSWORD,
      redirect: false,
    });
  });

  it("translates the action's error code and does not sign in on failure", async () => {
    // The server returns a locale-free code; the form resolves it to copy.
    registerUser.mockResolvedValue({ success: false, error: "emailTaken" });
    signIn.mockClear();
    renderWithI18n(<RegisterForm />);

    await fillValid();
    await submit();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("An account with this email already exists"),
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows the generic fallback for an error code it does not recognise", async () => {
    registerUser.mockResolvedValue({ success: false, error: "some-new-code" });
    signIn.mockClear();
    renderWithI18n(<RegisterForm />);

    await fillValid();
    await submit();

    // A raw identifier must never reach the UI.
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again."),
    );
  });

  it("rates a weak password low and a strong one high as the user types", async () => {
    renderWithI18n(<RegisterForm />);
    const passwordField = screen.getByLabelText("Password");

    await userEvent.type(passwordField, "password");
    expect(await screen.findByText("Very weak")).toBeInTheDocument();
    expect(screen.getByText("This is a commonly used password")).toBeInTheDocument();

    await userEvent.clear(passwordField);
    await userEvent.type(passwordField, STRONG_PASSWORD);
    expect(await screen.findByText("Strong")).toBeInTheDocument();
  });

  it("flags a password built from the entered email", async () => {
    renderWithI18n(<RegisterForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "ada-is-my-name-99");

    expect(await screen.findByText("Avoid using your name or email")).toBeInTheDocument();
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
