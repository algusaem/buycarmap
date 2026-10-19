import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { PasswordInput } from "./PasswordInput";

// docs/specs/redesign-entry.md (ENTRY-10). `messages/es.json`'s
// `password.show`/`password.hide` already read "Mostrar contraseña"/"Ocultar
// contraseña" and PasswordInput.tsx already switches `type` and the
// button's `aria-label` on click — these tests therefore mostly confirm
// behaviour already in place, rather than driving new RED. An input with
// type="password" carries no "textbox" accessible role (unlike type="text"),
// so that role appearing/disappearing is used as a implementation-detail-free
// proxy for "the text is shown"/"the text is hidden".
describe("ENTRY-10: PasswordInput — the show/hide button", () => {
  it("ENTRY-10: hides the password by default, behind a button named Mostrar contraseña", () => {
    renderWithI18n(<PasswordInput placeholder="Tu contraseña" />, { locale: "es" });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toBeInTheDocument();
  });

  it("ENTRY-10: pressing it reveals the typed text and renames the button to Ocultar contraseña", async () => {
    renderWithI18n(<PasswordInput placeholder="Tu contraseña" />, { locale: "es" });
    const input = screen.getByPlaceholderText("Tu contraseña");

    await userEvent.type(input, "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));

    expect(screen.getByRole("textbox")).toHaveValue("secret123");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toBeInTheDocument();
  });

  it("ENTRY-10: pressing it again hides the text but keeps what was typed", async () => {
    renderWithI18n(<PasswordInput placeholder="Tu contraseña" />, { locale: "es" });
    const input = screen.getByPlaceholderText("Tu contraseña");

    await userEvent.type(input, "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    await userEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("secret123");
  });

  it("ENTRY-10: has no accessibility violations", async () => {
    const { container } = renderWithI18n(<PasswordInput placeholder="Tu contraseña" />, {
      locale: "es",
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

// F4 review round 2: the error's own id, association and placement — the eye
// button centres on the input alone, not on the input plus the error below.
describe("ENTRY-22: PasswordInput — the error's id, association and placement", () => {
  it("associates the input with the error through aria-describedby, and marks it aria-invalid", () => {
    renderWithI18n(<PasswordInput placeholder="Tu contraseña" error="Campo requerido" />, {
      locale: "es",
    });

    const input = screen.getByPlaceholderText("Tu contraseña");
    const error = screen.getByText("Campo requerido");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
    expect(error.id).toBeTruthy();
  });

  it("carries no aria-invalid or aria-describedby without an error", () => {
    renderWithI18n(<PasswordInput placeholder="Tu contraseña" />, { locale: "es" });

    const input = screen.getByPlaceholderText("Tu contraseña");

    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("keeps the show/hide button outside the error, so it stays centred on the input alone", () => {
    renderWithI18n(<PasswordInput placeholder="Tu contraseña" error="Campo requerido" />, {
      locale: "es",
    });

    const button = screen.getByRole("button", { name: "Mostrar contraseña" });
    const error = screen.getByText("Campo requerido");
    const relativeWrapper = button.parentElement;

    expect(relativeWrapper?.contains(error)).toBe(false);
  });

  // Owner-accepted field-error design (docs/design/canvas/R3-login.dc.html,
  // PasswordField/README.md "Con error"): the same circle-alert pattern as
  // FormMessage and Crear alerta's "Ponle un nombre a la alerta.".
  it("shows the circle-alert icon inside the error", () => {
    renderWithI18n(<PasswordInput placeholder="Tu contraseña" error="Campo requerido" />, {
      locale: "es",
    });

    const error = screen.getByText("Campo requerido");
    expect(error.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-21: the show or hide
// button turns `text` on hover, with its colour in the state transition, and
// keeps the button's press.
describe("MOTION-21: PasswordInput — hover and press on the show or hide button", () => {
  it("MOTION-21: the button carries transition-[color,background-color,scale], hover:text-text and active:scale-97, off under reduced motion, and no legacy hover:text-foreground", () => {
    renderWithI18n(<PasswordInput placeholder="Your password" />);

    const classes = screen.getByRole("button", { name: "Show password" }).className.split(/\s+/);
    expect(classes).toContain("transition-[color,background-color,scale]");
    expect(classes).toContain("hover:text-text");
    expect(classes).toContain("active:scale-97");
    expect(classes).toContain("motion-reduce:active:scale-none");
    expect(classes).not.toContain("hover:text-foreground");
  });
});
