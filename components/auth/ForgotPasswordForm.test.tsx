import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

// I18nProvider (via renderWithI18n) calls useRouter; the form itself uses Link.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const requestPasswordReset = vi.fn();
vi.mock("@/server/password-reset/actions", () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
}));
import { toast } from "sonner";

const submit = () => userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

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

  // Amended (2026-10-16, PAGES-4 — redesign-pages.md): a fieldless failure
  // (rateLimited, generic) is now a form alert above the primary button,
  // never a toast. The assertion below only checks the form is still shown,
  // which still holds; the toast expectation is replaced by PAGES-4's own
  // test further down.
  it("stays on the form after the action fails", async () => {
    requestPasswordReset.mockResolvedValue({
      success: false,
      error: "Something went wrong. Please try again.",
    });
    renderWithI18n(<ForgotPasswordForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await submit();

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledOnce());
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

// docs/specs/redesign-pages.md (PAGES), F7 — `/forgot-password`. Rendered in
// Spanish: the criteria and worked examples quote the Spanish copy.
describe("PAGES-1: no page-level «Volver» link of its own", () => {
  it("PAGES-1: has no back link of its own: its one link is «Volver a entrar»", () => {
    renderWithI18n(<ForgotPasswordForm />, { locale: "es" });

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Volver a entrar"]);
    expect(links[0]).toHaveAttribute("href", "/login");
  });
});

describe("PAGES-2: «Enviar enlace» stays busy with its label unchanged", () => {
  it("PAGES-2: is disabled, aria-busy and shows the spinner before its unchanged label while requestPasswordReset runs", async () => {
    requestPasswordReset.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending.
      }),
    );
    renderWithI18n(<ForgotPasswordForm />, { locale: "es" });
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    const button = screen.getByRole("button", { name: "Enviar enlace" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    // PAGES-2: the spinner, hidden from assistive tech, before the unchanged label.
    const spinner = button.firstElementChild;
    expect(spinner).toHaveClass("animate-spin");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    expect(button.textContent).toBe("Enviar enlace");
  });
});

describe("PAGES-4: a fieldless failure is a form alert, not a toast", () => {
  it("PAGES-4: rateLimited shows as a form alert with authErrors.rateLimited's copy, and no toast", async () => {
    requestPasswordReset.mockResolvedValue({ success: false, error: AUTH_ERROR.rateLimited });
    renderWithI18n(<ForgotPasswordForm />, { locale: "es" });
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(
      await screen.findByText("Demasiados intentos. Espera unos minutos e inténtalo de nuevo."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-20: the form's headline, line and fields", () => {
  it("PAGES-20: shows the headline «¿Se te ha olvidado?» over «Nos pasa a todos», the line, and the form «Recuperar contraseña» with «Email», «Enviar enlace» and «Volver a entrar»", () => {
    renderWithI18n(<ForgotPasswordForm />, { locale: "es" });

    const heading = screen.getByRole("heading", { name: /¿Se te ha olvidado\?/ });
    expect(heading).toHaveTextContent("Nos pasa a todos");
    expect(
      screen.getByText("Pon tu correo y te mandamos un enlace para elegir otra contraseña."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recuperar contraseña" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar enlace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a entrar" })).toHaveAttribute("href", "/login");
  });
});

describe("PAGES-21: the neutral check-your-inbox state", () => {
  it("PAGES-21: shows the headline «¿Ya está?» over «Mira tu correo», the line, and the panel «Revisa tu correo» with «Volver a entrar» — the same for an unknown address", async () => {
    requestPasswordReset.mockResolvedValue({ success: true });
    renderWithI18n(<ForgotPasswordForm />, { locale: "es" });

    await userEvent.type(screen.getByLabelText("Email"), "unknown@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    const heading = await screen.findByRole("heading", { name: /¿Ya está\?/ });
    expect(heading).toHaveTextContent("Mira tu correo");
    expect(
      screen.getByText(
        "Si hay una cuenta con ese correo, te llega un enlace en unos minutos. Mira también en spam.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revisa tu correo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a entrar" })).toHaveAttribute("href", "/login");
  });
});

describe("PAGES-4: generic is a form alert too", () => {
  it("PAGES-4: generic shows «Algo ha ido mal. Inténtalo de nuevo.» inside the form, before «Enviar enlace», and no toast", async () => {
    requestPasswordReset.mockResolvedValue({ success: false, error: AUTH_ERROR.generic });
    renderWithI18n(<ForgotPasswordForm />, { locale: "es" });
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    const primary = screen.getByRole("button", { name: "Enviar enlace" });

    await userEvent.click(primary);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Algo ha ido mal. Inténtalo de nuevo.");
    expect(primary.closest("form")).toContainElement(alert);
    expect(alert.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-76: the state the form gives way to takes the focus", () => {
  it("PAGES-76: «¿Ya está? / Mira tu correo» takes the focus once the link is sent", async () => {
    requestPasswordReset.mockResolvedValue({ success: true });
    renderWithI18n(<ForgotPasswordForm />, { locale: "es" });
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    const heading = await screen.findByRole("heading", { name: /¿Ya está\?/ });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});

describe("PAGES-4: a requestPasswordReset that throws", () => {
  it("PAGES-4: is the generic form alert above «Enviar enlace», and no toast", async () => {
    requestPasswordReset.mockRejectedValue(new Error("network down"));
    renderWithI18n(<ForgotPasswordForm />, { locale: "es" });
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo ha ido mal. Inténtalo de nuevo.",
    );
    expect(screen.getByRole("button", { name: "Enviar enlace" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});
