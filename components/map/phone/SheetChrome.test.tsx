import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { renderWithI18n } from "@/test/utils/render";
import { PhoneBottomSheet, shouldDragClose } from "./SheetChrome";
import { SearchSheet } from "./SearchSheet";

// docs/specs/redesign-saved.md (SAVED-39 to SAVED-41): what a phone bottom
// sheet keeps now that it shows no «×». The drag itself only a browser can
// show (SAVED-37, SAVED-38, e2e/saved.spec.ts and e2e/map.spec.ts).

// «Coche»'s models come from the listCarModels Server Action, mocked at that
// boundary as in SearchSheet.test.tsx.
vi.mock("@/server/search/actions", () => ({
  listCarModels: vi.fn(async () => ({ ok: true, value: [] })),
}));

describe("SAVED-39: when letting go of the handle closes the sheet", () => {
  // The worked example "Drag to close": offset in px, velocity in px/s, down positive.
  it.each([
    [101, 0, true],
    [100, 0, false],
    [40, 801, true],
    [40, 800, false],
    [40, 300, false],
    [-30, -900, false],
  ])("SAVED-39: offset %ipx at %ipx/s closes: %s", (offset, velocity, closes) => {
    expect(shouldDragClose(offset, velocity)).toBe(closes);
  });
});

/** A sheet beside the button that opens it, as each phone bottom sheet is opened. */
function SheetWithOpener() {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <PhoneBottomSheet
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={openerRef}
        overlayClassName="bg-bg/72"
        entrance="slide"
      >
        <DialogPrimitive.Title>Hoja</DialogPrimitive.Title>
        <button type="button">Dentro</button>
      </PhoneBottomSheet>
    </>
  );
}

async function openSheet(): Promise<HTMLElement> {
  renderWithI18n(<SheetWithOpener />, { locale: "es" });
  await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
  return screen.findByRole("dialog", { name: "Hoja" });
}

describe("SAVED-40: a phone bottom sheet still closes with Escape and a press outside", () => {
  it("SAVED-40: Escape closes it and focus returns to the control that opened it", async () => {
    await openSheet();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Abrir" })).toHaveFocus();
  });

  it("SAVED-40: a press on the dimmed screen outside it closes it and focus returns to the control that opened it", async () => {
    await openSheet();

    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Abrir" })).toHaveFocus();
  });

  it("SAVED-40: it draws the handle strip and no close button of its own", async () => {
    const sheet = await openSheet();

    expect(sheet.querySelector("[data-sheet-handle]")).not.toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Cerrar" })).toBeNull();
  });
});

describe("SAVED-41: the BUSCAR sheet's «Cerrar» is visually hidden", () => {
  it("SAVED-41: «Cerrar» is a named button, visually hidden until keyboard focus, reached with Tab, and pressing it closes the sheet", async () => {
    const onClose = vi.fn();
    renderWithI18n(
      <SearchSheet open initial={{}} radiusKm={50} onApply={vi.fn()} onClose={onClose} />,
      { locale: "es" },
    );
    const sheet = screen.getByRole("dialog", { name: "BUSCAR" });
    const close = within(sheet).getByRole("button", { name: "Cerrar" });

    expect(close).toHaveClass(
      "sr-only",
      "not-focus-visible:size-px",
      "focus-visible:not-sr-only",
      "focus-visible:size-10",
    );
    for (let press = 0; press < 20 && document.activeElement !== close; press++) {
      await userEvent.tab();
    }
    expect(close).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
