import { useRef, useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { ResponsiveDialog } from "./ResponsiveDialog";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-12: a desktop dialog
// appears at once when opened from the keyboard, and disappears at once when
// closed with Escape; opened or closed with a pointer, it still fades.
describe("MOTION-12: ResponsiveDialog — the desktop dialog opens and closes at once from the keyboard, but still fades for a pointer", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    function onClose() {
      setOpen(false);
    }
    return (
      <>
        <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
          Abrir
        </button>
        <ResponsiveDialog open={open} onClose={onClose} isPhone={false} returnFocusRef={triggerRef}>
          <p>Contenido</p>
          <button type="button" onClick={onClose}>
            Cerrar
          </button>
        </ResponsiveDialog>
      </>
    );
  }

  it("MOTION-12: Enter on the trigger opens the dialog with no inline opacity below 1, even with animations enabled", async () => {
    await withAnimations(async () => {
      renderWithI18n(<Harness />);
      screen.getByRole("button", { name: "Abrir" }).focus();

      await userEvent.keyboard("{Enter}");

      const dialog = await screen.findByRole("dialog");
      const opacity = dialog.style.opacity;
      expect(opacity === "" || Number(opacity) >= 1).toBe(true);
    });
  });

  it("MOTION-12: a click on the trigger still fades the dialog in, with an inline opacity below 1 right after", async () => {
    await withAnimations(async () => {
      renderWithI18n(<Harness />);

      await userEvent.click(screen.getByRole("button", { name: "Abrir" }));

      const dialog = await screen.findByRole("dialog");
      expect(Number(dialog.style.opacity)).toBeLessThan(1);
    });
  });

  it("MOTION-12: Escape closes the dialog in the same tick, with no exit animation to wait for", async () => {
    await withAnimations(async () => {
      renderWithI18n(<Harness />);
      await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
      await screen.findByRole("dialog");

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("MOTION-12: a click outside still plays the close animation — the dialog is still mounted right after", async () => {
    await withAnimations(async (clock) => {
      renderWithI18n(<Harness />);
      await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
      await screen.findByRole("dialog");
      await clock.finish();

      // A modal Radix dialog sets the rest of the page's pointer-events to
      // none, which userEvent's realistic click refuses to click through;
      // fireEvent dispatches the outside press directly, as the phone car
      // sheet's own "a press outside it closes it" test does
      // (FavoritesList.phone.test.tsx, SAVED-21).
      fireEvent.pointerDown(document.body);
      fireEvent.pointerUp(document.body);
      fireEvent.click(document.body);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("MOTION-12: a close button inside it, activated with Enter, closes the dialog in the same tick", async () => {
    await withAnimations(async () => {
      renderWithI18n(<Harness />);
      await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
      const dialog = await screen.findByRole("dialog");
      within(dialog).getByRole("button", { name: "Cerrar" }).focus();

      await userEvent.keyboard("{Enter}");

      expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    });
  });

  it("MOTION-12: a close button inside it, activated with Space, closes the dialog in the same tick", async () => {
    await withAnimations(async () => {
      renderWithI18n(<Harness />);
      await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
      const dialog = await screen.findByRole("dialog");
      within(dialog).getByRole("button", { name: "Cerrar" }).focus();

      await userEvent.keyboard(" ");

      expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    });
  });
});

// docs/specs/motion.md (Key MOTION, Approved), MOTION-12: the phone sheet
// (ResponsiveDialog's `isPhone` branch, PhoneBottomSheet) appears at once when
// opened from the keyboard, and disappears at once when closed with Escape;
// opened or closed with a pointer, it still slides.
describe("MOTION-12: ResponsiveDialog — the phone sheet opens and closes at once from the keyboard, but still slides for a pointer", () => {
  function PhoneHarness() {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
          Abrir
        </button>
        <ResponsiveDialog
          open={open}
          onClose={() => setOpen(false)}
          isPhone
          returnFocusRef={triggerRef}
        >
          <p>Contenido</p>
        </ResponsiveDialog>
      </>
    );
  }

  it("MOTION-12: Enter on the trigger opens the sheet with no inline transform left at its off-screen offset, even with animations enabled", async () => {
    await withAnimations(async () => {
      renderWithI18n(<PhoneHarness />);
      screen.getByRole("button", { name: "Abrir" }).focus();

      await userEvent.keyboard("{Enter}");

      const dialog = await screen.findByRole("dialog");
      expect(dialog.style.transform).not.toContain("100%");
    });
  });

  it("MOTION-12: Escape closes the sheet in the same tick, with no exit animation to wait for", async () => {
    await withAnimations(async () => {
      renderWithI18n(<PhoneHarness />);
      await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
      await screen.findByRole("dialog");

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("MOTION-12: a click on the trigger still slides the sheet up, with a transform left at its off-screen offset right after", async () => {
    await withAnimations(async () => {
      renderWithI18n(<PhoneHarness />);

      await userEvent.click(screen.getByRole("button", { name: "Abrir" }));

      const dialog = await screen.findByRole("dialog");
      expect(dialog.style.transform).toContain("translateY(");
      expect(dialog.style.transform).not.toMatch(/^(none|translateY\(0px\))$/);
    });
  });
});
