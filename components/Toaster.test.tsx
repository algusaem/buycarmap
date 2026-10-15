import { afterEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { toast } from "sonner";
import { renderWithI18n } from "@/test/utils/render";
import { Toaster } from "./Toaster";

// docs/specs/redesign-saved.md (SAVED-36): every toast's close button is
// named «Cerrar aviso» (`common.closeToast`, "Close notice" in English), in
// place of «Cerrar» (`common.close`), which other «Cerrar» buttons keep. The
// real Sonner renders here: the name is what the one global Toaster hands it.

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

describe("SAVED-36: the Toaster's close button", () => {
  it("SAVED-36: is named «Cerrar aviso» in Spanish, not «Cerrar»", async () => {
    renderWithI18n(<Toaster />, { locale: "es" });

    act(() => {
      toast("Quitado de guardados");
    });

    expect(await screen.findByText("Quitado de guardados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar aviso" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
  });

  it("SAVED-36: is named «Close notice» in English", async () => {
    renderWithI18n(<Toaster />);

    act(() => {
      toast("Removed from saved");
    });

    expect(await screen.findByText("Removed from saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close notice" })).toBeInTheDocument();
  });

  it("SAVED-36: every toast carries its own close button, an error toast included", async () => {
    renderWithI18n(<Toaster />, { locale: "es" });

    act(() => {
      toast("Quitado de guardados");
      toast.error("Algo ha salido mal. Inténtalo de nuevo.");
    });

    expect(await screen.findByText("Algo ha salido mal. Inténtalo de nuevo.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Cerrar aviso" })).toHaveLength(2);
  });
});

// docs/specs/redesign-foundation.md (LOOK-11): a toast's action keeps the
// app's keyboard focus ring — a 2px lime outline offset by 3px — which
// Sonner's unlayered `[data-button] { outline: 0 }` would otherwise remove, so
// the classes carry the important modifier.
describe("LOOK-11: the Toaster's action button", () => {
  it("LOOK-11: «Deshacer» carries the important lime focus-visible ring", async () => {
    renderWithI18n(<Toaster />, { locale: "es" });

    act(() => {
      toast("Quitado de guardados", { action: { label: "Deshacer", onClick: vi.fn() } });
    });

    expect(await screen.findByRole("button", { name: "Deshacer" })).toHaveClass(
      "focus-visible:outline-2!",
      "focus-visible:outline-solid!",
      "focus-visible:outline-lime!",
      "focus-visible:outline-offset-3!",
    );
  });
});

// docs/specs/core-frontend.md (FRONT-23) and Toast/README.md: a success toast
// carries the lime check and an error toast the danger alert, in place of
// Sonner's own icons.
describe("FRONT-23: the Toaster's icons", () => {
  it("FRONT-23: a success toast shows the lime check, an error toast the danger alert", async () => {
    renderWithI18n(<Toaster />, { locale: "es" });

    act(() => {
      toast.success("Quitado de guardados");
      toast.error("No se ha podido guardar. Prueba otra vez");
    });

    const success = (await screen.findByText("Quitado de guardados")).closest(
      "[data-sonner-toast]",
    );
    const error = screen
      .getByText("No se ha podido guardar. Prueba otra vez")
      .closest("[data-sonner-toast]");
    expect(success?.querySelector("[data-icon] svg")).toHaveClass(
      "lucide-circle-check",
      "text-lime",
    );
    expect(error?.querySelector("[data-icon] svg")).toHaveClass(
      "lucide-circle-alert",
      "text-danger",
    );
  });
});
