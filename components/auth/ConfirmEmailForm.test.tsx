import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { toast } from "sonner";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { ConfirmEmailForm } from "./ConfirmEmailForm";

// docs/specs/redesign-pages.md (PAGES), F7 — `/confirm-email` (confirming a
// new address). No test file existed for this component before F7; every
// test here is new. Rendered in Spanish: the criteria and worked examples
// quote the Spanish copy.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const confirmEmail = vi.fn();
vi.mock("@/server/email-verification/actions", () => ({
  confirmEmail: (...args: unknown[]) => confirmEmail(...args),
}));

const TOKEN = "token-from-the-emailed-link";
const confirmButton = () => screen.getByRole("button", { name: "Confirmar esta dirección" });

beforeEach(() => {
  confirmEmail.mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
});

describe("PAGES-14: reads only whether the token is present (kept)", () => {
  it("PAGES-14: renders with a token and calls confirmEmail only once the button is pressed", () => {
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });

    expect(confirmEmail).not.toHaveBeenCalled();
    expect(confirmButton()).toBeInTheDocument();
  });

  it("PAGES-14: submits the token from the URL when the button is pressed", async () => {
    confirmEmail.mockResolvedValue({ success: true });
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(confirmButton());

    expect(confirmEmail).toHaveBeenCalledOnce();
    const submitted = confirmEmail.mock.calls[0][0] as FormData;
    expect(submitted.get("token")).toBe(TOKEN);
  });
});

describe("PAGES-2: «Confirmar esta dirección» stays busy with its label unchanged", () => {
  it("PAGES-2: is disabled, aria-busy and shows the spinner before its unchanged label while confirmEmail runs", async () => {
    confirmEmail.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending: only the busy state is under test.
      }),
    );
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });
    const button = confirmButton();

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    // PAGES-2: the spinner, hidden from assistive tech, before the unchanged label.
    const spinner = button.firstElementChild;
    expect(spinner).toHaveClass("animate-spin");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    expect(button.textContent).toBe("Confirmar esta dirección");
  });
});

describe("PAGES-4: a fieldless failure is a form alert, not a toast", () => {
  it("PAGES-4: rateLimited shows as a form alert with authErrors.rateLimited's copy, and no toast", async () => {
    confirmEmail.mockResolvedValue({ success: false, error: AUTH_ERROR.rateLimited });
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(confirmButton());

    expect(
      await screen.findByText("Demasiados intentos. Espera unos minutos e inténtalo de nuevo."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-17: the pending state's headline, line and panel", () => {
  it("PAGES-17: shows the headline «¿Es tu correo nuevo?» over «Confírmalo», the line, the panel «Confirma tu correo» with its hint, and «Confirmar esta dirección» — no email address", () => {
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });

    const heading = screen.getByRole("heading", { name: /¿Es tu correo nuevo\?/ });
    expect(heading).toHaveTextContent("Confírmalo");
    expect(
      screen.getByText("Un último paso: confirma que este correo es tuyo y el cambio queda hecho."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confirma tu correo" })).toBeInTheDocument();
    expect(
      screen.getByText("Confirma esta dirección para completar el cambio."),
    ).toBeInTheDocument();
    expect(confirmButton()).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});

describe("PAGES-18: the confirmed state", () => {
  it("PAGES-18: shows the headline «¿Hecho?» over «Correo cambiado», the line, and the panel «Correo confirmado» with «Volver a tu cuenta» to /account", async () => {
    confirmEmail.mockResolvedValue({ success: true });
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(confirmButton());

    const heading = await screen.findByRole("heading", { name: /¿Hecho\?/ });
    expect(heading).toHaveTextContent("Correo cambiado");
    expect(
      screen.getByText("Tu dirección de correo está verificada y actualizada."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Correo confirmado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a tu cuenta" })).toHaveAttribute(
      "href",
      "/account",
    );
  });
});

describe("PAGES-19: the expired-link state replaces the form, with no toast", () => {
  it("PAGES-19: tokenInvalid shows the headline «¿Enlace caducado?» over «Pide otro», the line, and the panel with «Volver a tu cuenta» to /account, and no toast", async () => {
    confirmEmail.mockResolvedValue({ success: false, error: AUTH_ERROR.tokenInvalid });
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(confirmButton());

    const heading = await screen.findByRole("heading", { name: /¿Enlace caducado\?/ });
    expect(heading).toHaveTextContent("Pide otro");
    expect(
      screen.getByText(
        "Los enlaces duran 24 horas y solo valen una vez. Pide otro desde tu cuenta.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Este enlace ya no es válido" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a tu cuenta" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(confirmButton).toThrow();
  });
});

describe("ConfirmEmailForm — accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("PAGES-4: generic is a form alert too", () => {
  it("PAGES-4: generic shows «Algo ha ido mal. Inténtalo de nuevo.» before «Confirmar esta dirección», and no toast", async () => {
    confirmEmail.mockResolvedValue({ success: false, error: AUTH_ERROR.generic });
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });
    const primary = screen.getByRole("button", { name: "Confirmar esta dirección" });

    await userEvent.click(primary);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Algo ha ido mal. Inténtalo de nuevo.");
    expect(alert.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("PAGES-4: an action that throws is the generic form alert, and the button can be pressed again", async () => {
    confirmEmail.mockRejectedValue(new Error("network down"));
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });
    const primary = screen.getByRole("button", { name: "Confirmar esta dirección" });

    await userEvent.click(primary);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo ha ido mal. Inténtalo de nuevo.",
    );
    expect(primary).not.toHaveAttribute("aria-disabled");
  });
});

describe("PAGES-76: the state the button gives way to takes the focus", () => {
  it("PAGES-76: the confirmed state's headline takes the focus", async () => {
    confirmEmail.mockResolvedValue({ success: true });
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Confirmar esta dirección" }));

    const heading = await screen.findByRole("heading", { name: /¿Hecho\?/ });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("PAGES-76: the expired-link state's headline takes the focus after tokenInvalid", async () => {
    confirmEmail.mockResolvedValue({ success: false, error: AUTH_ERROR.tokenInvalid });
    renderWithI18n(<ConfirmEmailForm token={TOKEN} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Confirmar esta dirección" }));

    const heading = await screen.findByRole("heading", { name: /¿Enlace caducado\?/ });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});
