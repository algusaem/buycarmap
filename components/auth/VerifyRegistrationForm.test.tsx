import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { VerifyRegistrationForm } from "./VerifyRegistrationForm";

// I18nProvider calls useRouter, which needs an app-router context jsdom lacks.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const verifyRegistration = vi.fn();
vi.mock("@/server/registration/actions", () => ({
  verifyRegistration: (...args: unknown[]) => verifyRegistration(...args),
}));

const TOKEN = "token-from-the-emailed-link";

const confirmButton = () => screen.getByRole("button", { name: "Confirm my account" });

describe("VerifyRegistrationForm", () => {
  beforeEach(() => {
    verifyRegistration.mockReset();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  it("does not confirm on render", () => {
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    // Mail scanners fetch every link in an inbox. Confirming on page load
    // would let a scanner burn the token before the recipient sees this.
    expect(verifyRegistration).not.toHaveBeenCalled();
    expect(confirmButton()).toBeInTheDocument();
  });

  it("submits the token from the URL when the button is pressed", async () => {
    verifyRegistration.mockResolvedValue({
      success: true,
      email: "ada@example.com",
    });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    await userEvent.click(confirmButton());

    await waitFor(() => expect(verifyRegistration).toHaveBeenCalledOnce());
    const submitted = verifyRegistration.mock.calls[0][0] as FormData;
    expect(submitted.get("token")).toBe(TOKEN);
  });

  it("offers a route to sign in once confirmed", async () => {
    verifyRegistration.mockResolvedValue({
      success: true,
      email: "ada@example.com",
    });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    await userEvent.click(confirmButton());

    expect(await screen.findByText("You're all set")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toBeInTheDocument();
  });

  it("PAGES-16: an expired link gives way to the expired-link state with «Back to sign up» and no toast", async () => {
    verifyRegistration.mockResolvedValue({
      success: false,
      error: "tokenInvalid",
    });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    await userEvent.click(confirmButton());

    // amended 2026-10-16, PAGES-16: `tokenInvalid` replaces the form with the
    // expired-link state, with no toast — "the button available" is now the
    // expired state's own primary action, «Back to sign up», not a re-enabled
    // «Confirm my account».
    expect(await screen.findByRole("link", { name: "Back to sign up" })).toBeInTheDocument();
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("does not claim success when confirmation failed", async () => {
    verifyRegistration.mockResolvedValue({
      success: false,
      error: "tokenInvalid",
    });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    await userEvent.click(confirmButton());

    // amended 2026-10-16, PAGES-16: the expired-link state replaces the form
    // with no toast — still never the success state.
    await screen.findByRole("link", { name: "Back to sign up" });
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

// docs/specs/redesign-pages.md (PAGES), F7 — `/verify-email` (confirming a
// registration). Rendered in Spanish: the criteria and worked examples quote
// the Spanish copy.
const confirmButtonEs = () => screen.getByRole("button", { name: "Confirmar mi cuenta" });

describe("PAGES-14: reads only whether the token is present (kept)", () => {
  it("PAGES-14: renders with a token and calls verifyRegistration only once the button is pressed", () => {
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />, { locale: "es" });

    expect(verifyRegistration).not.toHaveBeenCalled();
    expect(confirmButtonEs()).toBeInTheDocument();
  });
});

describe("PAGES-2: «Confirmar mi cuenta» stays busy with its label unchanged", () => {
  it("PAGES-2: is disabled, aria-busy and shows the spinner before its unchanged label while verifyRegistration runs", async () => {
    verifyRegistration.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending: only the busy state is under test.
      }),
    );
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />, { locale: "es" });
    const button = confirmButtonEs();

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    // PAGES-2: the spinner, hidden from assistive tech, before the unchanged label.
    const spinner = button.firstElementChild;
    expect(spinner).toHaveClass("animate-spin");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    expect(button.textContent).toBe("Confirmar mi cuenta");
  });
});

describe("PAGES-4: a fieldless failure is a form alert, not a toast", () => {
  it("PAGES-4: rateLimited shows as a form alert with authErrors.rateLimited's copy, and no toast", async () => {
    verifyRegistration.mockResolvedValue({ success: false, error: AUTH_ERROR.rateLimited });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(confirmButtonEs());

    expect(
      await screen.findByText("Demasiados intentos. Espera unos minutos e inténtalo de nuevo."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-13: the pending state's headline, line and panel", () => {
  it("PAGES-13: shows the headline «¿Eres tú?» over «Confírmalo», the line, the panel «Confirma tu cuenta» with its hint, and «Confirmar mi cuenta» — no email address", () => {
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />, { locale: "es" });

    const heading = screen.getByRole("heading", { name: /¿Eres tú\?/ });
    expect(heading).toHaveTextContent("Confírmalo");
    expect(
      screen.getByText("Un último paso: confirma que este correo es tuyo y tu cuenta queda lista."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confirma tu cuenta" })).toBeInTheDocument();
    expect(
      screen.getByText("Pulsa el botón para terminar de crear tu cuenta."),
    ).toBeInTheDocument();
    expect(confirmButtonEs()).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});

describe("PAGES-15: the confirmed state shows no toast", () => {
  it("PAGES-15: shows the headline «¿Listo?» over «A buscar coche», the line, the panel «Todo listo» with «Entrar» to /login, and no toast", async () => {
    verifyRegistration.mockResolvedValue({ success: true, email: "ada@example.com" });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(confirmButtonEs());

    const heading = await screen.findByRole("heading", { name: /¿Listo\?/ });
    expect(heading).toHaveTextContent("A buscar coche");
    expect(
      screen.getByText("Tu cuenta ya está creada. Entra y guarda el primero que te mole."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Todo listo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("PAGES-16: the expired-link state replaces the form, with no toast", () => {
  it("PAGES-16: tokenInvalid shows the headline «¿Enlace caducado?» over «Regístrate otra vez», the line, the panel with «Volver al registro» to /register and «Entrar» to /login, and no toast", async () => {
    verifyRegistration.mockResolvedValue({ success: false, error: AUTH_ERROR.tokenInvalid });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(confirmButtonEs());

    const heading = await screen.findByRole("heading", { name: /¿Enlace caducado\?/ });
    expect(heading).toHaveTextContent("Regístrate otra vez");
    expect(
      screen.getByText(
        "Los enlaces de confirmación duran 24 horas y solo valen una vez. Vuelve a registrarte y te mandamos otro.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Este enlace ya no es válido" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al registro" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(toast.error).not.toHaveBeenCalled();
    expect(confirmButtonEs).toThrow();
  });
});

describe("PAGES-4: generic is a form alert too", () => {
  it("PAGES-4: generic shows «Algo ha ido mal. Inténtalo de nuevo.» before «Confirmar mi cuenta», and no toast", async () => {
    verifyRegistration.mockResolvedValue({ success: false, error: AUTH_ERROR.generic });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />, { locale: "es" });
    const primary = screen.getByRole("button", { name: "Confirmar mi cuenta" });

    await userEvent.click(primary);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Algo ha ido mal. Inténtalo de nuevo.");
    expect(alert.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("PAGES-4: an action that throws is the generic form alert, and the button can be pressed again", async () => {
    verifyRegistration.mockRejectedValue(new Error("network down"));
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />, { locale: "es" });
    const primary = screen.getByRole("button", { name: "Confirmar mi cuenta" });

    await userEvent.click(primary);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo ha ido mal. Inténtalo de nuevo.",
    );
    expect(primary).not.toHaveAttribute("aria-disabled");
  });
});

describe("PAGES-76: the state the button gives way to takes the focus", () => {
  it("PAGES-76: the confirmed state's headline takes the focus", async () => {
    verifyRegistration.mockResolvedValue({ success: true });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Confirmar mi cuenta" }));

    const heading = await screen.findByRole("heading", { name: /¿Listo\?/ });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("PAGES-76: the expired-link state's headline takes the focus after tokenInvalid", async () => {
    verifyRegistration.mockResolvedValue({ success: false, error: AUTH_ERROR.tokenInvalid });
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Confirmar mi cuenta" }));

    const heading = await screen.findByRole("heading", { name: /¿Enlace caducado\?/ });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});

describe("PAGES-4: a verifyRegistration that throws", () => {
  it("PAGES-4: is the generic alert above the button, which is usable again", async () => {
    verifyRegistration.mockRejectedValue(new Error("network down"));
    renderWithI18n(<VerifyRegistrationForm token={TOKEN} />);

    await userEvent.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(confirmButton()).not.toHaveAttribute("aria-disabled");
  });
});
