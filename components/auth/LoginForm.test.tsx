import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { toast } from "sonner";
import { renderWithI18n } from "@/test/utils/render";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { LoginForm } from "./LoginForm";

// FRONT-24 and ENTRY-11/ENTRY-12 assert no toast fires — LoginForm's own
// inline alerts replaced an earlier toast-based version of this form.
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Mutable so a test can simulate arriving with ?callbackUrl=… from middleware.
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));
// BAUTH-3 (docs/specs/core-better-auth.md), harness change: LoginForm now
// calls server/auth/actions.ts's `signIn` server action (through
// `auth.api.signInEmail`), not NextAuth's `next-auth/react` `signIn`. No
// OAuth provider is configured in these tests, so `<LoginForm isGoogleConfigured={false} />`
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
// OAuthButtons.test.tsx's own mock of the Better Auth client, reused here so
// LoginForm's "Continuar con Google" (OAuthButtons.tsx) can be driven from
// this file too (ENTRY-17's rule is the same for the Google round-trip).
const signInSocial = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signIn: { social: (...args: unknown[]) => signInSocial(...args) } },
}));

function submittedFormData(): FormData {
  return signIn.mock.calls.at(-1)?.[0] as FormData;
}

// BAUTH-1 (docs/specs/core-better-auth.md), harness change: a successful
// sign-in now does a full `window.location.href` navigation, not a
// client-side `router.push` — Better Auth's client only refetches its
// session on one of its own mutation paths or a fresh mount, neither of
// which a client-side route change triggers. jsdom's own `window.location`
// is read-only, so it is replaced with a plain, writable stand-in.
let location: { href: string; origin: string };
function stubLocation(): void {
  // docs/specs/redesign-entry.md (ENTRY-17): safeRedirectTarget resolves the
  // target against `window.location.origin`, so the stand-in needs one too —
  // matching lib/auth/safe-redirect.test.ts's own ORIGIN.
  location = { href: "", origin: "http://localhost:3000" };
  Object.defineProperty(window, "location", {
    value: location,
    writable: true,
    configurable: true,
  });
}

// Clears sonner's call history before every test in this file, so no
// assertion on it depends on another test's run order.
beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
});

describe("LoginForm", () => {
  beforeEach(() => {
    signIn.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  it("does not sign in when the email is malformed", async () => {
    // The email field is type="email"; the browser's native constraint
    // validation blocks submission of a malformed value before onSubmit runs.
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "whatever");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await new Promise((r) => setTimeout(r, 50));
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows required-field errors when submitting empty", async () => {
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    // The schema emits the code "emailRequired"; this asserts the rendered
    // English, which proves the code→copy resolution actually runs.
    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  // Owner-accepted field-error design (docs/design/canvas/R3-login.dc.html,
  // "Campos sin rellenar"): the same circle-alert pattern as FormMessage and
  // Crear alerta's "Ponle un nombre a la alerta.", with the a11y wiring kept.
  it("ENTRY-22: shows the required-email error with the circle-alert icon and its aria wiring", async () => {
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const error = await screen.findByText("Email is required");
    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(emailInput.getAttribute("aria-describedby")).toBe(error.id);
    expect(error).toHaveAttribute("role", "alert");
    expect(error).not.toHaveAttribute("aria-live");
    expect(error.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("ENTRY-22: shows the new Spanish required-email copy", async () => {
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("El email es obligatorio")).toBeInTheDocument();
  });

  // "a@b" — not "abc" — because the field is type="email": the browser's own
  // constraint validation blocks a value with no "@" at all before RHF ever
  // runs (the "does not sign in when the email is malformed" test above),
  // so it could never reach this zod message. "a@b" passes that native
  // check but still fails zod's stricter `.email()`, which is what actually
  // exercises this copy.
  it("ENTRY-22: shows Introduce un email válido for a value the browser accepts but zod rejects", async () => {
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await userEvent.type(document.getElementById("email") as HTMLInputElement, "a@b");
    await userEvent.type(document.getElementById("password") as HTMLInputElement, "whatever");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Introduce un email válido")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in with the credentials on a valid submit", async () => {
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(signIn).toHaveBeenCalledOnce());
    const formData = submittedFormData();
    expect(formData.get("email")).toBe("ada@example.com");
    expect(formData.get("password")).toBe("secret123");
  });

  // docs/specs/redesign-entry.md (ENTRY-11, ENTRY-12): inline alert, not a
  // toast — rewritten from this file's own earlier toast-based version
  // alongside the spec change, same as ENTRY-11/ENTRY-12 below assert.
  it("shows an error inline and does not redirect on invalid credentials", async () => {
    signIn.mockResolvedValue({ success: false, error: "generic" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(location.href).toBe("");
  });

  it("reports rate limiting distinctly from bad credentials, inline", async () => {
    signIn.mockResolvedValue({ success: false, error: "rateLimited" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many attempts. Please wait a few minutes and try again.",
    );
  });

  it("returns to the path middleware saved after a successful sign-in", async () => {
    searchParams = new URLSearchParams("callbackUrl=/account");
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

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
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

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
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(location.href).toBe("/"));
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<LoginForm isGoogleConfigured={false} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("LoginForm two-factor step", () => {
  const codeField = () => screen.queryByLabelText(/enter the 6-digit code/i);

  beforeEach(() => {
    signIn.mockReset();
    verifySignInTotp.mockReset();
    verifySignInBackupCode.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  async function submitCredentials() {
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  }

  it("hides the code field until the server asks for one", async () => {
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    // Showing it up front would tell every visitor which accounts use 2FA.
    expect(codeField()).not.toBeInTheDocument();
  });

  it("reveals the code field, without an error, when a code is required", async () => {
    signIn.mockResolvedValue({ success: false, twoFactorRequired: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await submitCredentials();

    await waitFor(() => expect(codeField()).toBeInTheDocument());
    // Nothing has gone wrong yet — this is a step, not a failure.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends a 6-digit code to verifySignInTotp on the second attempt", async () => {
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

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
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

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
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

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
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await submitCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
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
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

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
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/sign in with your email and password/i);
  });

  it("explains the other link-refusal code the same way", async () => {
    searchParams = new URLSearchParams("error=unable_to_link_account");
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
  });

  it("falls back to a generic message for any other OAuth error", async () => {
    searchParams = new URLSearchParams("error=OAuthCallback");
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

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
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(/lost your phone\? enter one of your recovery codes/i),
    ).toBeInTheDocument();
  });
});

describe("LoginForm sign-in confirmation", () => {
  beforeEach(() => {
    signIn.mockReset();
    verifySignInTotp.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  it("FRONT-24: signing in with a password shows no success toast and navigates to the redirect target", async () => {
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(location.href).toBe("/"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("FRONT-24: signing in with a password and a two-factor code shows no success toast", async () => {
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    verifySignInTotp.mockResolvedValueOnce({ success: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const codeInput = await screen.findByLabelText(/enter the 6-digit code/i);
    await userEvent.type(codeInput, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(location.href).toBe("/"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("FRONT-24: the auth.signInSuccess message is gone from both locales", () => {
    expect("signInSuccess" in en.auth).toBe(false);
    expect("signInSuccess" in es.auth).toBe(false);
  });
});

// docs/specs/redesign-entry.md (ENTRY-11 to ENTRY-15, ENTRY-17). Rendered at
// locale "es" throughout, because every expected string below is the spec's
// worked example quoted verbatim. The email and password fields are grabbed
// by id rather than by label text, so the error-handling tests below stay
// unaffected by an unrelated copy change to the label or placeholder.
function emailField(): HTMLInputElement {
  return document.getElementById("email") as HTMLInputElement;
}
function passwordField(): HTMLInputElement {
  return document.getElementById("password") as HTMLInputElement;
}
async function fillCredentials(email: string, password: string) {
  await userEvent.type(emailField(), email);
  await userEvent.type(passwordField(), password);
}

describe("ENTRY-11: LoginForm — invalid credentials shown inline, not as a toast", () => {
  beforeEach(() => {
    signIn.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  it("ENTRY-11: a wrong password shows the alert above Entrar, keeps what was typed, and raises no toast", async () => {
    signIn.mockResolvedValue({ success: false, error: "generic" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Email o contraseña incorrectos");
    expect(emailField()).toHaveValue("ada@example.com");
    expect(passwordField()).toHaveValue("wrong-password");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("ENTRY-11: an unknown email shows the exact same message as a wrong password (enumeration resistance)", async () => {
    signIn.mockResolvedValue({ success: false, error: "generic" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("unknown@example.com", "whatever-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña incorrectos");
  });
});

describe("ENTRY-12: LoginForm — rate limiting shown inline, not as a toast", () => {
  beforeEach(() => {
    signIn.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  it("ENTRY-12: a rate-limited sign-in shows its own alert in the same place as ENTRY-11, with no toast", async () => {
    signIn.mockResolvedValue({ success: false, error: "rateLimited" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("ENTRY-13: LoginForm — the two-factor code field", () => {
  beforeEach(() => {
    signIn.mockReset();
    verifySignInTotp.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  it("ENTRY-13: appears focused under the password, keeps email and password, and shows the recovery hint", async () => {
    signIn.mockResolvedValue({ success: false, twoFactorRequired: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const codeField = await screen.findByLabelText("Introduce el código de 6 dígitos");
    expect(codeField).toHaveFocus();
    expect(emailField()).toHaveValue("ada@example.com");
    expect(passwordField()).toHaveValue("secret123");
    expect(
      screen.getByText("¿Has perdido el móvil? Escribe aquí uno de tus códigos de recuperación."),
    ).toBeInTheDocument();
  });

  it("ENTRY-13: the code field follows the password field", async () => {
    signIn.mockResolvedValue({ success: false, twoFactorRequired: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const codeField = await screen.findByLabelText("Introduce el código de 6 dígitos");
    // DOCUMENT_POSITION_FOLLOWING (4): `codeField` comes after `passwordField`.
    expect(
      passwordField().compareDocumentPosition(codeField) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("ENTRY-13: a wrong code shows Ese código no es válido… under the code field", async () => {
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    verifySignInTotp.mockResolvedValue({ success: false, error: "totpInvalid" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    const codeField = await screen.findByLabelText("Introduce el código de 6 dígitos");
    await userEvent.type(codeField, "000000");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText("Ese código no es válido. Revisa tu app e inténtalo de nuevo."),
    ).toBeInTheDocument();
  });

  // C3 (F4 review round 1): the two-factor step's own rate limit — ENTRY-12's
  // message, in the same place the form-level alert already uses, not the
  // code field's own "totpInvalid" error.
  it("ENTRY-12/ENTRY-13: a rate-limited two-factor attempt shows the rate-limit alert, not the wrong-code error", async () => {
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    verifySignInTotp.mockResolvedValue({ success: false, error: "rateLimited" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    const codeField = await screen.findByLabelText("Introduce el código de 6 dígitos");
    await userEvent.type(codeField, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
    );
    expect(
      screen.queryByText("Ese código no es válido. Revisa tu app e inténtalo de nuevo."),
    ).not.toBeInTheDocument();
    expect(location.href).toBe("");
  });
});

describe("ENTRY-14: LoginForm — the loading state", () => {
  beforeEach(() => {
    signIn.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  it("ENTRY-14: disables Entrar, shows a spinner beside it, and keeps the Entrar label", async () => {
    let resolveSignIn: (value: { success: true }) => void = () => {
      /* replaced by mockImplementation's own resolver below */
    };
    signIn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    const button = screen.getByRole("button", { name: "Entrar" });
    await userEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "true"));
    // ENTRY-14: the label stays "Entrar" while pending — a spinner shows
    // beside it instead of replacing it with a separate "signing in" string.
    expect(button).toHaveAccessibleName("Entrar");
    expect(button.querySelector(".animate-spin")).not.toBeNull();

    resolveSignIn({ success: true });
  });

  // F4 review round 2: `isSubmitting` alone reverts to `false` as soon as the
  // async submit handler returns, which can be a beat before
  // `window.location.href` actually leaves the page — a `redirecting` flag
  // keeps the button disabled for that whole gap.
  it("ENTRY-14: stays disabled after a successful sign-in, through the redirect", async () => {
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    const button = screen.getByRole("button", { name: "Entrar" });
    await userEvent.click(button);

    await waitFor(() => expect(location.href).toBe("/"));
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  // bfcache: a browser back into this page after a successful sign-in
  // restores the pre-navigation DOM with `redirecting` still `true` —
  // `pageshow`'s `persisted` flag is what tells the page it was restored
  // rather than freshly mounted, and re-enables the button.
  it("ENTRY-14: a bfcache restore (pageshow persisted) re-enables Entrar", async () => {
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    const button = screen.getByRole("button", { name: "Entrar" });
    await userEvent.click(button);

    await waitFor(() => expect(location.href).toBe("/"));
    expect(button).toHaveAttribute("aria-disabled", "true");

    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });

    expect(button).not.toHaveAttribute("aria-disabled");
  });
});

describe("ENTRY-15: LoginForm — the OAuth error banner", () => {
  beforeEach(() => {
    stubLocation();
    signIn.mockReset();
    searchParams = new URLSearchParams();
  });

  it("ENTRY-15: account_not_linked shows the linked-account message as an alert at the top of the form", () => {
    searchParams = new URLSearchParams("error=account_not_linked");
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ya existe una cuenta con este email. Inicia sesión con tu email y contraseña.",
    );
  });

  it("ENTRY-15: unable_to_link_account shows the same message", () => {
    searchParams = new URLSearchParams("error=unable_to_link_account");
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ya existe una cuenta con este email. Inicia sesión con tu email y contraseña.",
    );
  });

  it("ENTRY-15: any other OAuth error code shows the generic message", () => {
    searchParams = new URLSearchParams("error=OAuthCallback");
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    expect(screen.getByRole("alert")).toHaveTextContent("Algo ha ido mal. Inténtalo de nuevo.");
  });

  // F4 review round 2: the OAuth banner clears as soon as the next sign-in
  // attempt starts, so a wrong password afterwards leaves only its own
  // alert — not both stacked on top of each other.
  it("ENTRY-15: a wrong password after an OAuth error clears the OAuth banner, leaving only the credentials alert", async () => {
    searchParams = new URLSearchParams("error=account_not_linked");
    signIn.mockResolvedValue({ success: false, error: "generic" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ya existe una cuenta con este email. Inicia sesión con tu email y contraseña.",
    );

    await fillCredentials("ada@example.com", "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("Email o contraseña incorrectos");
  });
});

describe("ENTRY-17: LoginForm — the callbackUrl bug fix", () => {
  beforeEach(() => {
    signIn.mockReset();
    verifySignInTotp.mockReset();
    signInSocial.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  it("ENTRY-17: a backslash-prefixed callbackUrl is sent to / instead of the host it would make the browser read (the bug this fixes)", async () => {
    // "?callbackUrl=%2F%5Cevil.example" decoded by useSearchParams().get() —
    // the exact shape the worked example's "sent as /%5Cevil.example" row
    // describes.
    searchParams = new URLSearchParams("callbackUrl=%2F%5Cevil.example");
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(location.href).toBe("/"));
  });

  it("ENTRY-17: a dot-segment callbackUrl that normalises to a protocol-relative pathname is sent to /", async () => {
    // "?callbackUrl=%2F.%2F%2Fevil.example" decoded by useSearchParams().get()
    // to "/.//evil.example" — resolves to this origin, but its pathname
    // normalises to "//evil.example", which a browser reads as
    // protocol-relative. safeRedirectTarget's pathname check rejects it.
    searchParams = new URLSearchParams("callbackUrl=%2F.%2F%2Fevil.example");
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(location.href).toBe("/"));
  });

  it("ENTRY-17: the same rule sends the two-factor step's redirect to / for the same hostile value", async () => {
    searchParams = new URLSearchParams("callbackUrl=%2F%5Cevil.example");
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    verifySignInTotp.mockResolvedValueOnce({ success: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    const codeField = await screen.findByLabelText("Introduce el código de 6 dígitos");
    await userEvent.type(codeField, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(location.href).toBe("/"));
  });

  it("ENTRY-17: a javascript: callbackUrl is sent to /", async () => {
    searchParams = new URLSearchParams("callbackUrl=javascript:alert(1)");
    signIn.mockResolvedValue({ success: true });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(location.href).toBe("/"));
  });

  // (F4 review round 1): the same rule, for the Google round-trip
  // (OAuthButtons.tsx, rendered here because isGoogleConfigured is true) —
  // `redirectTo` is the one `safeRedirectTarget` result LoginForm passes to
  // both the email flow and `OAuthButtons`' `callbackUrl` prop.
  it("ENTRY-17: a backslash-prefixed callbackUrl reaches Google sign-in as /, not the hostile value", async () => {
    searchParams = new URLSearchParams("callbackUrl=%2F%5Cevil.example");
    renderWithI18n(<LoginForm isGoogleConfigured={true} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));

    expect(signInSocial).toHaveBeenCalledOnce();
    expect(signInSocial).toHaveBeenLastCalledWith({
      provider: "google",
      callbackURL: "/",
      errorCallbackURL: "/login",
    });
  });

  it("ENTRY-17: a safe callbackUrl reaches Google sign-in unchanged, with the matching errorCallbackURL", async () => {
    searchParams = new URLSearchParams("callbackUrl=%2Ffavorites");
    renderWithI18n(<LoginForm isGoogleConfigured={true} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));

    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/favorites",
      errorCallbackURL: "/login?callbackUrl=%2Ffavorites",
    });
  });
});

// C4 (F4 review round 1, edge case "Wrong password, then right one" ›
// docs/specs/redesign-entry.md): the stale alert clears as soon as the next
// attempt starts — whether that next attempt reaches the server or fails
// client validation first.
describe("ENTRY-11: LoginForm — the stale alert clears on the next attempt", () => {
  beforeEach(() => {
    signIn.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  it("ENTRY-11: no alert shows while a second attempt is still pending", async () => {
    signIn.mockResolvedValueOnce({ success: false, error: "generic" });
    signIn.mockReturnValueOnce(
      new Promise(() => {
        /* deliberately never settles — this attempt stays pending */
      }),
    );
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña incorrectos");

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ENTRY-11: clearing the password so the next submit fails client validation also clears the stale alert", async () => {
    signIn.mockResolvedValueOnce({ success: false, error: "generic" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña incorrectos");

    await userEvent.clear(passwordField());
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    // amended 2026-10-16, ENTRY-22 (redesign-entry.md): a field error carries
    // role="alert", so the one alert left is the empty password's own, and
    // the stale form alert is gone.
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("La contraseña es obligatoria");
  });

  it("ENTRY-22: an empty email's field error is an alert too", async () => {
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await userEvent.type(passwordField(), "a-password");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("El email es obligatorio");
  });
});

// C6 (F4 review round 1): where each alert sits relative to the control it
// is about, asserted with `compareDocumentPosition` rather than only that
// both exist.
describe("ENTRY-11/ENTRY-15/ENTRY-13: LoginForm — alert placement", () => {
  beforeEach(() => {
    signIn.mockReset();
    verifySignInTotp.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  it("ENTRY-11/ENTRY-15/ENTRY-13: ENTRY-11's alert comes before the Entrar button", async () => {
    signIn.mockResolvedValue({ success: false, error: "generic" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    const button = screen.getByRole("button", { name: "Entrar" });
    // DOCUMENT_POSITION_FOLLOWING (4): `button` comes after `alert`.
    expect(alert.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("ENTRY-11/ENTRY-15/ENTRY-13: ENTRY-15's OAuth-error alert comes before the Entrar heading", async () => {
    searchParams = new URLSearchParams("error=account_not_linked");
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    const alert = screen.getByRole("alert");
    const heading = screen.getByRole("heading", { name: "Entrar" });
    expect(alert.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("ENTRY-11/ENTRY-15/ENTRY-13: ENTRY-13's wrong-code text comes after the code field", async () => {
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    verifySignInTotp.mockResolvedValue({ success: false, error: "totpInvalid" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />, { locale: "es" });

    await fillCredentials("ada@example.com", "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    const codeField = await screen.findByLabelText("Introduce el código de 6 dígitos");
    await userEvent.type(codeField, "000000");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const errorText = await screen.findByText(
      "Ese código no es válido. Revisa tu app e inténtalo de nuevo.",
    );
    // DOCUMENT_POSITION_PRECEDING (2): `codeField` comes before `errorText`.
    expect(
      errorText.compareDocumentPosition(codeField) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });
});

describe("PAGES-4: a sign-in request that throws", () => {
  beforeEach(() => {
    signIn.mockReset();
    verifySignInTotp.mockReset();
    verifySignInBackupCode.mockReset();
    searchParams = new URLSearchParams();
    stubLocation();
  });

  async function submitCredentials() {
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  }

  it("PAGES-4: a thrown signIn is the generic alert, not «invalid credentials»", async () => {
    signIn.mockRejectedValue(new Error("network down"));
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    await submitCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).not.toHaveAttribute("aria-disabled");
    expect(location.href).toBe("");
  });

  it("PAGES-4: a thrown code check is the generic alert, not a wrong code", async () => {
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    verifySignInTotp.mockRejectedValue(new Error("network down"));
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);
    await submitCredentials();
    const code = await screen.findByLabelText(/enter the 6-digit code/i);

    await userEvent.type(code, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(code).not.toHaveAttribute("aria-invalid", "true");
  });

  it("ENTRY-22: a code the server refuses is the error under the code field, which takes the focus", async () => {
    signIn.mockResolvedValueOnce({ success: false, twoFactorRequired: true });
    verifySignInTotp.mockResolvedValue({ success: false, error: "totpInvalid" });
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);
    await submitCredentials();
    const code = await screen.findByLabelText(/enter the 6-digit code/i);

    await userEvent.type(code, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(code).toHaveAttribute("aria-invalid", "true"));
    expect(code).toHaveFocus();
  });
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-21: «Create one» gains
// a hover to `text` and a press, in the state transition.
describe("MOTION-21: LoginForm — hover and press on «Create one»", () => {
  it("MOTION-21: the link carries transition-[color,scale], hover:text-text and active:scale-97, off under reduced motion", () => {
    renderWithI18n(<LoginForm isGoogleConfigured={false} />);

    const classes = screen.getByRole("link", { name: "Create one" }).className.split(/\s+/);
    expect(classes).toContain("transition-[color,scale]");
    expect(classes).toContain("hover:text-text");
    expect(classes).toContain("active:scale-97");
    expect(classes).toContain("motion-reduce:active:scale-none");
  });
});
