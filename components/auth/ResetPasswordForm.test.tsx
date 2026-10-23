import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { toast } from "sonner";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { ResetPasswordForm } from "./ResetPasswordForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const resetPassword = vi.fn();
vi.mock("@/server/password-reset/actions", () => ({
  resetPassword: (...args: unknown[]) => resetPassword(...args),
}));

const STRONG_PASSWORD = "harbour-lentil-quilt";
const TOKEN = "token-from-the-emailed-link";

async function fillValid() {
  await userEvent.type(screen.getByLabelText("New password"), STRONG_PASSWORD);
  await userEvent.type(screen.getByLabelText("Confirm password"), STRONG_PASSWORD);
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "Update password" }));

// amended 2026-10-16, PAGES-24: moved from `ResetPasswordForm`'s own
// `beforeEach` to a file-level one so every `describe` below — including the
// `PAGES-*` blocks added for F7 — starts with clean mocks too, not just the
// first block.
beforeEach(() => {
  push.mockReset();
  resetPassword.mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
});

describe("ResetPasswordForm", () => {
  it("submits the token from the URL alongside the new password", async () => {
    resetPassword.mockResolvedValue({ success: true });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await fillValid();
    await submit();

    await waitFor(() => expect(resetPassword).toHaveBeenCalledOnce());
    const submitted = resetPassword.mock.calls[0][0] as FormData;
    expect(submitted.get("token")).toBe(TOKEN);
    expect(submitted.get("password")).toBe(STRONG_PASSWORD);
  });

  it("does not expose the token as an editable field", () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    // The token belongs to the URL, not to something a user can retype.
    expect(screen.queryByDisplayValue(TOKEN)).not.toBeInTheDocument();
  });

  it("blocks submission when the confirmation does not match", async () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await userEvent.type(screen.getByLabelText("New password"), STRONG_PASSWORD);
    await userEvent.type(screen.getByLabelText("Confirm password"), "something-different");
    await submit();

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("blocks submission for a password under the minimum length", async () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await userEvent.type(screen.getByLabelText("New password"), "abcdefghijk");
    await userEvent.type(screen.getByLabelText("Confirm password"), "abcdefghijk");
    await submit();

    expect(await screen.findByText("Use at least 12 characters")).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("shows a breached-password rejection on the field, not as a toast", async () => {
    // The user has to change what they typed, so the message belongs where
    // they are looking rather than in something that disappears.
    resetPassword.mockResolvedValue({
      success: false,
      error: "passwordBreached",
    });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await fillValid();
    await submit();

    expect(
      await screen.findByText(
        "This password has appeared in a known data breach. Please choose a different one.",
      ),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  // Removed (amended 2026-10-16, PAGES-24 — redesign-pages.md): a
  // tokenInvalid rejection no longer toasts — the form gives way to the
  // expired-link page state instead, with no toast at all. See the
  // "PAGES-24" describe block below for the new behaviour.

  it("sends the user to sign in after a successful reset", async () => {
    resetPassword.mockResolvedValue({ success: true });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await fillValid();
    await submit();

    // Deliberately not auto-signed-in: the reset invalidated every session,
    // and entering the new password once confirms it was memorized.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("rates the new password as the user types", async () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await userEvent.type(screen.getByLabelText("New password"), "password");

    // amended 2026-10-16, PAGES-5: the label and level are one line now, the
    // level word in its own <strong> — matched on the line's full text.
    expect(
      await screen.findByText(
        (_, element) => element?.tagName === "P" && element.textContent === "Strength: very weak",
      ),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(<ResetPasswordForm token={TOKEN} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

// docs/specs/redesign-pages.md (PAGES), F7 — `/reset-password`. Rendered in
// Spanish: the criteria and worked examples quote the Spanish copy.
async function fillValidEs() {
  await userEvent.type(screen.getByLabelText("Nueva contraseña"), STRONG_PASSWORD);
  await userEvent.type(screen.getByLabelText("Repite la contraseña"), STRONG_PASSWORD);
}

describe("PAGES-1: no page-level «Volver» link of its own", () => {
  it("PAGES-1: /reset-password has no back link of its own: its one link is «Volver a entrar»", () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Volver a entrar"]);
    expect(links[0]).toHaveAttribute("href", "/login");
    // A new password has no placeholder (decided 2026-10-16, owner).
    expect(screen.getByLabelText("Nueva contraseña")).not.toHaveAttribute("placeholder");
  });
});

describe("PAGES-6: every password field has the eye of ENTRY-10", () => {
  it("PAGES-6: both «Nueva contraseña» and «Confirmar contraseña» have a show/hide button", () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });

    expect(screen.getAllByRole("button", { name: /Mostrar contraseña/ })).toHaveLength(2);
  });
});

describe("PAGES-14: reads only whether the token is present (kept)", () => {
  it("PAGES-14: renders with a token and calls resetPassword only once the button is pressed", () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });

    expect(resetPassword).not.toHaveBeenCalled();
  });
});

describe("PAGES-2: «Guardar contraseña» stays busy with its label unchanged", () => {
  it("PAGES-2: is disabled, aria-busy and shows the spinner before its unchanged label while resetPassword runs", async () => {
    resetPassword.mockReturnValue(
      new Promise(() => {
        // Intentionally left pending.
      }),
    );
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    const button = screen.getByRole("button", { name: "Guardar contraseña" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    // PAGES-2: the spinner, hidden from assistive tech, before the unchanged label.
    const spinner = button.firstElementChild;
    expect(spinner).toHaveClass("animate-spin");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    expect(button.textContent).toBe("Guardar contraseña");
  });
});

describe("PAGES-3: a server-rejected password is a field error, before the meter", () => {
  it("PAGES-3: passwordReused is a field error under «Nueva contraseña», before the meter, with no toast", async () => {
    resetPassword.mockResolvedValue({ success: false, error: AUTH_ERROR.passwordReused });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    const error = await screen.findByText("Elige una contraseña distinta de la actual");
    const password = screen.getByLabelText("Nueva contraseña");
    expect(password.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const meterLabel = screen.getByText(/Seguridad:/);
    expect(
      error.compareDocumentPosition(meterLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-4: a fieldless failure is a form alert, not a toast", () => {
  it("PAGES-4: rateLimited shows as a form alert with authErrors.rateLimited's copy, and no toast", async () => {
    resetPassword.mockResolvedValue({ success: false, error: AUTH_ERROR.rateLimited });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(
      await screen.findByText("Demasiados intentos. Espera unos minutos e inténtalo de nuevo."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-22: the form's headline, line and fields", () => {
  it("PAGES-22: shows the headline «¿Contraseña nueva?» over «Que no se repita», the line, and the form «Nueva contraseña» with «Nueva contraseña», «Repite la contraseña», «Guardar contraseña» and «Volver a entrar»", () => {
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });

    const heading = screen.getByRole("heading", { name: /¿Contraseña nueva\?/ });
    expect(heading).toHaveTextContent("Que no se repita");
    expect(
      screen.getByText("Una que no uses en ningún otro sitio. El medidor te dice si aguanta."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nueva contraseña" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nueva contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText("Repite la contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar contraseña" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a entrar" })).toBeInTheDocument();
  });
});

describe("PAGES-23: success sends the user to /login signed in nowhere, with the toast", () => {
  it("PAGES-23: pushes to /login and toasts «Contraseña actualizada. Ya puedes iniciar sesión.»", async () => {
    resetPassword.mockResolvedValue({ success: true });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(toast.success).toHaveBeenCalledWith("Contraseña actualizada. Ya puedes iniciar sesión.");
  });
});

describe("PAGES-24: the expired-link state replaces the form, with no toast", () => {
  it("PAGES-24: tokenInvalid shows the headline «¿Enlace caducado?» over «Pide otro», the line, «Pedir otro enlace» to /forgot-password and «Volver a entrar», and no toast", async () => {
    resetPassword.mockResolvedValue({ success: false, error: AUTH_ERROR.tokenInvalid });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    const heading = await screen.findByRole("heading", { name: /¿Enlace caducado\?/ });
    expect(heading).toHaveTextContent("Pide otro");
    expect(
      screen.getByText("Los enlaces duran una hora y solo valen una vez. Pide uno nuevo y listo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir otro enlace" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("link", { name: "Volver a entrar" })).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("PAGES-4: generic is a form alert too", () => {
  it("PAGES-4: generic shows «Algo ha ido mal. Inténtalo de nuevo.» inside the form, before «Guardar contraseña», and no toast", async () => {
    resetPassword.mockResolvedValue({ success: false, error: AUTH_ERROR.generic });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });
    await fillValidEs();
    const primary = screen.getByRole("button", { name: "Guardar contraseña" });

    await userEvent.click(primary);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Algo ha ido mal. Inténtalo de nuevo.");
    expect(primary.closest("form")).toContainElement(alert);
    expect(alert.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-76: the state the form gives way to takes the focus", () => {
  it("PAGES-76: «¿Enlace caducado? / Pide otro» takes the focus once the token is refused", async () => {
    resetPassword.mockResolvedValue({ success: false, error: AUTH_ERROR.tokenInvalid });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />, { locale: "es" });
    await fillValidEs();

    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    const heading = await screen.findByRole("heading", { name: /¿Enlace caducado\?/ });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});

describe("PAGES-4: a resetPassword that throws", () => {
  it("PAGES-4: is the generic form alert, and the button is usable again", async () => {
    resetPassword.mockRejectedValue(new Error("network down"));
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await fillValid();
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Update password" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("PAGES-3: a server rejection takes the focus", () => {
  it("PAGES-3: passwordBreached focuses «New password»", async () => {
    resetPassword.mockResolvedValue({ success: false, error: AUTH_ERROR.passwordBreached });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await fillValid();
    await submit();

    await screen.findByText(
      "This password has appeared in a known data breach. Please choose a different one.",
    );
    expect(screen.getByLabelText("New password")).toHaveFocus();
  });
});

describe("PAGES-23: after the reset, the button stays busy until /login replaces the page", () => {
  it("PAGES-23: «Update password» stays busy after success and a second press sends nothing", async () => {
    resetPassword.mockResolvedValue({ success: true });
    renderWithI18n(<ResetPasswordForm token={TOKEN} />);

    await fillValid();
    await submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));

    const button = screen.getByRole("button", { name: "Update password" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(resetPassword).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/motion.md (MOTION-27): an access page's form gives way to the
// state that follows it at once after a key, and fades after a pointer.
describe("MOTION-27: ResetPasswordForm — the form gives way to the expired-link state", () => {
  it("MOTION-27: Enter in the confirm-password field shows the expired state with no inline opacity below 1", async () => {
    resetPassword.mockResolvedValue({ success: false, error: AUTH_ERROR.tokenInvalid });
    await withAnimations(async (clock) => {
      const { container } = renderWithI18n(<ResetPasswordForm token={TOKEN} />);
      await fillValid();

      await userEvent.type(screen.getByLabelText("Confirm password"), "{Enter}");
      await waitFor(() => expect(resetPassword).toHaveBeenCalledOnce());
      // `AnimatePresence mode="wait"`: the outgoing form's exit must finish
      // before the next state mounts — real animations are frozen by
      // `withAnimations`, so the clock has to be moved past it by hand.
      await clock.finish();

      await screen.findByRole("heading", { name: /Link expired\?/ });
      const opacity = (container.firstChild as HTMLElement).style.opacity;
      expect(opacity === "" || Number(opacity) >= 1).toBe(true);
    });
  });

  it("MOTION-27: pressing «Update password» still fades the expired state in, with an inline opacity below 1 right after", async () => {
    resetPassword.mockResolvedValue({ success: false, error: AUTH_ERROR.tokenInvalid });
    await withAnimations(async (clock) => {
      const { container } = renderWithI18n(<ResetPasswordForm token={TOKEN} />);
      await fillValid();

      await submit();
      await waitFor(() => expect(resetPassword).toHaveBeenCalledOnce());
      await clock.finish();

      await screen.findByRole("heading", { name: /Link expired\?/ });
      expect(Number((container.firstChild as HTMLElement).style.opacity)).toBeLessThan(1);
    });
  });
});
