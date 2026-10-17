import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { RegisterForm } from "./RegisterForm";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
// BAUTH-1 (docs/specs/core-better-auth.md), harness change: the no-email
// auto-sign-in now goes through `authClient.signIn.email` (Better Auth's
// client), not NextAuth's `next-auth/react` `signIn` — and which providers
// are configured is a prop (lib/app-config.ts, computed server-side) rather
// than a client fetch, so each render passes `isGoogleConfigured` directly
// instead of the old `getProviders` mock.
const signInEmail = vi.fn().mockResolvedValue({ data: { user: {} }, error: null });
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signIn: { email: (...args: unknown[]) => signInEmail(...args) } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const registerUser = vi.fn();
const resendConfirmationFn = vi.fn();
vi.mock("@/server/registration/actions", () => ({
  register: (...args: unknown[]) => registerUser(...args),
  resendConfirmation: (...args: unknown[]) => resendConfirmationFn(...args),
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

// amended 2026-10-16, PAGES-2/PAGES-3: moved from `RegisterForm`'s own
// `beforeEach` to a file-level one so every `describe` below — including the
// `PAGES-*` blocks added for F7 — starts with clean mocks too, not just the
// first block.
beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  registerUser.mockReset();
  resendConfirmationFn.mockReset();
  signInEmail.mockReset();
  signInEmail.mockResolvedValue({ data: { user: {} }, error: null });
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
});

describe("RegisterForm", () => {
  it("offers the configured OAuth providers alongside the signup form", async () => {
    // There is no separate OAuth "register" — Better Auth creates the account
    // on first sign-in — so this page must surface the option rather than
    // hiding it behind the login page.
    renderWithI18n(<RegisterForm isGoogleConfigured={true} />);

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    // The password form is still the primary path, not replaced by it.
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
  });

  it("shows no provider section when none is configured", async () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />);

    await screen.findByRole("button", { name: "Sign up" });
    expect(screen.queryByRole("button", { name: /continue with/i })).not.toBeInTheDocument();
  });

  it("blocks submission and shows an error when passwords do not match", async () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />);

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
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />);

    await fillValid();
    await submit();

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/If that address can be used for a new account/i)).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("hides the form once confirmation is pending", async () => {
    registerUser.mockResolvedValue({ success: true, pending: true });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />);

    await fillValid();
    await submit();

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Sign up" })).not.toBeInTheDocument(),
    );
  });

  it("registers then signs in when the account was created immediately", async () => {
    // `pending: false` is the no-email-configured fallback.
    registerUser.mockResolvedValue({ success: true, pending: false });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />);

    await fillValid();
    await submit();

    await waitFor(() => expect(registerUser).toHaveBeenCalledOnce());
    expect(signInEmail).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: STRONG_PASSWORD,
    });
  });

  it("translates the action's error code and does not sign in on failure", async () => {
    // The server returns a locale-free code; the form resolves it to copy.
    // AUTH-1/`registerWithoutEmail`: `emailTaken` is only ever returned on
    // the no-email-configured fallback (an immediate account creation, not
    // the verify-first `pending` path) — RegisterForm has no special case
    // for it, so it is a fieldless failure like any other.
    registerUser.mockResolvedValue({ success: false, error: "emailTaken" });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />);

    await fillValid();
    await submit();

    // amended 2026-10-16, PAGES-4: a fieldless failure is a form alert above
    // the button, not a toast.
    expect(
      await screen.findByText("An account with this email already exists"),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("shows the generic fallback for an error code it does not recognise", async () => {
    registerUser.mockResolvedValue({ success: false, error: "some-new-code" });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />);

    await fillValid();
    await submit();

    // amended 2026-10-16, PAGES-4: a fieldless failure is a form alert above
    // the button, not a toast. A raw identifier must never reach the UI.
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rates a weak password low and a strong one high as the user types", async () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />);
    const passwordField = screen.getByLabelText("Password");

    await userEvent.type(passwordField, "password");
    // amended 2026-10-16, PAGES-5: the label and level are one line now, the
    // level word in its own <strong> — matched on the line's full text.
    expect(
      await screen.findByText(
        (_, element) => element?.tagName === "P" && element.textContent === "Strength: very weak",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("This is a commonly used password")).toBeInTheDocument();

    await userEvent.clear(passwordField);
    await userEvent.type(passwordField, STRONG_PASSWORD);
    expect(
      await screen.findByText(
        (_, element) => element?.tagName === "P" && element.textContent === "Strength: strong",
      ),
    ).toBeInTheDocument();
  });

  it("flags a password built from the entered email", async () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "ada-is-my-name-99");

    expect(await screen.findByText("Avoid using your name or email")).toBeInTheDocument();
  });

  // Removed (amended 2026-10-16, PAGES-9/PAGES-10 — redesign-pages.md): the
  // register form drops the name field entirely, so there is no "Name" label
  // to type into any more. See PAGES-9's own test below for the no-name-field
  // assertion and PAGES-10 for what the submission now carries.

  it("routes to /login if auto sign-in fails after a successful register", async () => {
    registerUser.mockResolvedValue({ success: true });
    signInEmail.mockResolvedValueOnce({ data: null, error: { message: "Invalid credentials" } });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />);

    await fillValid();
    await submit();

    // Account was created, but the follow-up sign-in failed: send them to login
    // rather than an unauthenticated home page.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(push).not.toHaveBeenCalledWith("/");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<RegisterForm isGoogleConfigured={false} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

// docs/specs/redesign-pages.md (PAGES), F7 — the access pages, shared and
// `/register` sections. Rendered in Spanish throughout: the worked examples
// and the acceptance criteria quote the Spanish copy, which is the one the
// design and the approved spec actually fix (English is drafted with the
// implementation, per Contracts › i18n keys).
async function fillValidEs() {
  await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
  await userEvent.type(screen.getByLabelText("Contraseña"), STRONG_PASSWORD);
  await userEvent.type(screen.getByLabelText("Repite la contraseña"), STRONG_PASSWORD);
}

describe("PAGES-1: no page-level «Volver» link of its own", () => {
  it("PAGES-1: /register shows no «Volver» link — the access header (HEAD-6) is the only way back", () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });

    expect(screen.queryByRole("link", { name: "Volver" })).not.toBeInTheDocument();
  });
});

describe("PAGES-2: «Crear cuenta» stays busy with its label unchanged", () => {
  it("PAGES-2: is disabled, aria-busy and shows a spinner without changing its label while registering", async () => {
    registerUser.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending: this test only inspects the busy state.
      }),
    );
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const button = screen.getByRole("button", { name: "Crear cuenta" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    // PAGES-2: the spinner, hidden from assistive tech, before the unchanged label.
    const spinner = button.firstElementChild;
    expect(spinner).toHaveClass("animate-spin");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    expect(button.textContent).toBe("Crear cuenta");
  });

  it("PAGES-2: a second press starts no second request", async () => {
    registerUser.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending.
      }),
    );
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();
    const button = () => screen.getByRole("button", { name: "Crear cuenta" });

    await userEvent.click(button());
    await userEvent.click(button());

    expect(registerUser).toHaveBeenCalledTimes(1);
  });
});

describe("PAGES-3: field errors on submit, and a server-rejected password", () => {
  it("PAGES-3: an empty email shows a field error on submit and sends no request", async () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });

    await userEvent.type(screen.getByLabelText("Contraseña"), STRONG_PASSWORD);
    await userEvent.type(screen.getByLabelText("Repite la contraseña"), STRONG_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El email es obligatorio");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("PAGES-3: an invalid email shows «Introduce un email válido» on submit and sends nothing", async () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });

    await userEvent.type(screen.getByLabelText("Email"), "ada@");
    await userEvent.type(screen.getByLabelText("Contraseña"), STRONG_PASSWORD);
    await userEvent.type(screen.getByLabelText("Repite la contraseña"), STRONG_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Introduce un email válido")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("PAGES-3: passwordWeak from the server is a field error under the password field, before the meter, with no toast", async () => {
    registerUser.mockResolvedValue({ success: false, error: AUTH_ERROR.passwordWeak });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const error = await screen.findByText(
      "Esta contraseña es demasiado fácil de adivinar. Prueba con una más larga o menos predecible.",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveAccessibleDescription(
      error.textContent ?? "",
    );
    expect(
      error.compareDocumentPosition(screen.getByText(/Seguridad:/)) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("PAGES-3: passwordBreached from the server is a field error under the password field, before the meter, with no toast", async () => {
    registerUser.mockResolvedValue({ success: false, error: AUTH_ERROR.passwordBreached });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const error = await screen.findByText(
      "Esta contraseña ha aparecido en una filtración de datos conocida. Elige otra distinta.",
    );
    const password = screen.getByLabelText("Contraseña");
    // Under the field, and before the strength meter — not after it.
    expect(password.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const meterLabel = screen.getByText(/Seguridad:/);
    expect(
      error.compareDocumentPosition(meterLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-4: a fieldless failure is a form alert, not a toast", () => {
  it("PAGES-4: rateLimited shows as a form alert above «Crear cuenta» with authErrors.rateLimited's copy, and no toast", async () => {
    registerUser.mockResolvedValue({ success: false, error: AUTH_ERROR.rateLimited });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText("Demasiados intentos. Espera unos minutos e inténtalo de nuevo."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-6: every password field has the eye of ENTRY-10", () => {
  it("PAGES-6: both «Contraseña» and «Confirmar contraseña» have a show/hide button", () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });

    expect(screen.getAllByRole("button", { name: /Mostrar contraseña/ })).toHaveLength(2);
  });
});

describe("PAGES-9: /register's headline, form and links", () => {
  it("PAGES-9: shows the headline «¿Aún sin cuenta?» over «Hazte una» and the line, the form titled «Crear cuenta», and «Entra» to /login", () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });

    const heading = screen.getByRole("heading", { name: /¿Aún sin cuenta\?/ });
    expect(heading).toHaveTextContent("Hazte una");
    expect(
      screen.getByText("Recibir alertas es gratis, regístrate y nos encargamos del resto."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crear cuenta" })).toBeInTheDocument();

    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "tu@email.com");
    // A new password has no placeholder (decided 2026-10-16, owner).
    expect(screen.getByLabelText("Contraseña")).not.toHaveAttribute("placeholder");
    // The form's arrow, from the headline to the «o», is drawn (PAGES-7).
    expect(document.querySelector("[data-access-arrow]")).not.toBeNull();
    expect(screen.getByPlaceholderText("Otra vez, por si acaso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();

    expect(screen.getByText(/¿Ya tienes cuenta\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entra" })).toHaveAttribute("href", "/login");
  });

  it("PAGES-9: has no «Nombre» field", () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });

    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Name/)).not.toBeInTheDocument();
  });
});

describe("PAGES-10: the register submission carries no name, and the meter scores the email alone", () => {
  it("PAGES-10: submits only email, password and confirmPassword", async () => {
    registerUser.mockResolvedValue({ success: true, pending: true });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });

    await fillValidEs();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(registerUser).toHaveBeenCalled());
    const submitted = registerUser.mock.calls[0][0] as FormData;
    expect(submitted.get("email")).toBe("ada@example.com");
    expect(submitted.get("password")).toBe(STRONG_PASSWORD);
    expect(submitted.get("confirmPassword")).toBe(STRONG_PASSWORD);
    expect(submitted.has("name")).toBe(false);
  });

  it("PAGES-10: flags a password built from the typed email, with no name field feeding the meter", async () => {
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "ada-is-my-name-99");

    expect(await screen.findByText("Evita usar tu nombre o tu correo")).toBeInTheDocument();
  });
});

describe("PAGES-11: the neutral check-your-inbox state", () => {
  it("PAGES-11: shows the headline «¿Ya está?» over «Mira tu correo», the line, the panel «Revisa tu correo» with «Reenviar el correo» and «Entrar», and the illustration stays while the arrow goes — the same for a free and a taken address", async () => {
    registerUser.mockResolvedValue({ success: true, pending: true });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });

    await fillValidEs();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const heading = await screen.findByRole("heading", { name: /¿Ya está\?/ });
    expect(heading).toHaveTextContent("Mira tu correo");
    expect(
      screen.getByText(
        "Si ese correo puede usarse para una cuenta nueva, te llega un enlace para confirmarla. Caduca en 24 horas. Mira también en spam.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revisa tu correo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar el correo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    // From 1440px the illustration stays and the arrow goes: there is no «o».
    expect(document.querySelector("[data-art-layer]")).not.toBeNull();
    expect(document.querySelector("[data-access-arrow]")).toBeNull();
  });
});

describe("PAGES-12: resending the confirmation", () => {
  async function arriveAtPendingState() {
    registerUser.mockResolvedValue({ success: true, pending: true });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await screen.findByRole("button", { name: "Reenviar el correo" });
  }

  it("PAGES-12: calls resendConfirmation once with the submitted address, busy while it runs, then toasts the neutral copy", async () => {
    await arriveAtPendingState();
    let resolveResend!: (value: { success: true }) => void;
    resendConfirmationFn.mockReturnValue(
      new Promise((resolve) => {
        resolveResend = resolve;
      }),
    );

    const resendButton = screen.getByRole("button", { name: "Reenviar el correo" });
    await userEvent.click(resendButton);

    expect(resendButton).toHaveAttribute("aria-disabled", "true");
    expect(resendConfirmationFn).toHaveBeenCalledTimes(1);
    const submitted = resendConfirmationFn.mock.calls[0][0] as FormData;
    expect(submitted.get("email")).toBe("ada@example.com");

    resolveResend({ success: true });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Enviado. Revisa tu bandeja dentro de un minuto"),
    );
  });

  it("PAGES-12: a rateLimited refusal is the error toast with authErrors.rateLimited's copy", async () => {
    await arriveAtPendingState();
    resendConfirmationFn.mockResolvedValue({ success: false, error: AUTH_ERROR.rateLimited });

    await userEvent.click(screen.getByRole("button", { name: "Reenviar el correo" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
      ),
    );
  });
});

describe("PAGES-4: generic is a form alert too", () => {
  it("PAGES-4: generic shows «Algo ha ido mal. Inténtalo de nuevo.» inside the form, before «Crear cuenta», and no toast", async () => {
    registerUser.mockResolvedValue({ success: false, error: AUTH_ERROR.generic });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();
    const primary = screen.getByRole("button", { name: "Crear cuenta" });

    await userEvent.click(primary);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Algo ha ido mal. Inténtalo de nuevo.");
    expect(primary.closest("form")).toContainElement(alert);
    expect(alert.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-76: the state the form gives way to takes the focus", () => {
  it("PAGES-76: «¿Ya está? / Mira tu correo» takes the focus once register answers pending", async () => {
    registerUser.mockResolvedValue({ success: true, pending: true });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const heading = await screen.findByRole("heading", { name: /¿Ya está\?/ });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(heading).toHaveAttribute("tabindex", "-1");
  });
});

describe("PAGES-12: a resend that throws", () => {
  it("PAGES-12: is the generic error toast, and the button can be pressed again", async () => {
    registerUser.mockResolvedValue({ success: true, pending: true });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    const resend = await screen.findByRole("button", { name: "Reenviar el correo" });
    resendConfirmationFn.mockRejectedValue(new Error("network down"));

    await userEvent.click(resend);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Algo ha ido mal. Inténtalo de nuevo."),
    );
    expect(resend).not.toHaveAttribute("aria-disabled");
  });
});

describe("PAGES-4: a register that throws", () => {
  it("PAGES-4: is the generic form alert above «Crear cuenta», and no toast", async () => {
    registerUser.mockRejectedValue(new Error("network down"));
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo ha ido mal. Inténtalo de nuevo.",
    );
    expect(screen.getByRole("button", { name: "Crear cuenta" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-3: a server rejection takes the focus", () => {
  it("PAGES-3: passwordWeak focuses «Contraseña»", async () => {
    registerUser.mockResolvedValue({ success: false, error: AUTH_ERROR.passwordWeak });
    renderWithI18n(<RegisterForm isGoogleConfigured={false} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await screen.findByText(
      "Esta contraseña es demasiado fácil de adivinar. Prueba con una más larga o menos predecible.",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveFocus();
  });
});
