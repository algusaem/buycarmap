import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/test/msw/server";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
import { makeNominatimResult } from "@/test/fixtures/nominatim";
import { SearchSheet, type SearchSheetProps } from "./SearchSheet";

// The last input is page-wide (lib/input-modality.ts), so every test starts
// from a pointer press, whatever key the test before it pressed last.
beforeEach(() => {
  window.dispatchEvent(new PointerEvent("pointerdown"));
});

// «Coche»'s models come from the listCarModels Server Action, mocked at that
// boundary as in components/map/search/CarPopover.test.tsx.
vi.mock("@/server/search/actions", () => ({
  listCarModels: vi.fn(async () => ({ ok: true, value: [] })),
}));

const BASE: SearchSheetProps = {
  open: true,
  initial: {},
  radiusKm: 50,
  onApply: vi.fn(),
  onClose: vi.fn(),
};

describe("MAPUI-21: SearchSheet — opens with the three segments", () => {
  it("MAPUI-21: titled BUSCAR, with Dónde, Coche and Precio", () => {
    renderWithI18n(<SearchSheet {...BASE} />, { locale: "es" });

    const dialog = screen.getByRole("dialog", { name: "BUSCAR" });
    expect(dialog).toBeInTheDocument();
    // Section labels over fields, not buttons (SearchPopover README › la hoja «BUSCAR»).
    const sections = within(dialog);
    expect(sections.getByText("Dónde")).toBeInTheDocument();
    expect(sections.getByRole("combobox", { name: "Ciudad" })).toBeInTheDocument();
    expect(sections.getByText("Coche")).toBeInTheDocument();
    expect(sections.getByRole("combobox", { name: "Marca o modelo" })).toBeInTheDocument();
    expect(sections.getByText("Precio")).toBeInTheDocument();
    expect(sections.getByRole("slider", { name: "Precio máximo" })).toBeInTheDocument();
  });
});

describe("MAPUI-21: SearchSheet — nothing applies before Ver coches", () => {
  it("MAPUI-21: Ver coches applies the edited criteria and closes", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderWithI18n(
      <SearchSheet {...BASE} initial={{ maxPrice: 20000 }} onApply={onApply} onClose={onClose} />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledWith({ maxPrice: 20000, distanceInKm: 50, place: undefined });
  });

  it("MAPUI-21: closing the sheet without Ver coches discards everything", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} onApply={onApply} onClose={onClose} />, { locale: "es" });

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("MAPUI-21: SearchSheet — the radius draft", () => {
  it("MAPUI-21: with no place, the draft starts from the filters' radius, not the 50 km default", async () => {
    // A place cleared with «Toda España» leaves the radius chosen before it
    // (25 km) in the filters, while `SearchInput` carries no radius at all.
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} initial={{}} radiusKm={25} onApply={onApply} />, {
      locale: "es",
    });

    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledWith({ distanceInKm: 25, place: undefined });
  });
});

describe("MAPUI-21: SearchSheet — Borrar", () => {
  it("MAPUI-21: Borrar empties the sheet's fields, applied only on Ver coches", async () => {
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} initial={{ maxPrice: 20000 }} onApply={onApply} />, {
      locale: "es",
    });

    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(onApply).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));
    expect(onApply).toHaveBeenCalledWith({ distanceInKm: 50, place: null });
  });
});

// Amended 2026-10-21 (MAPUI-21, MAP-32, issue #117): the field's × changes
// «Dónde» only on «Tu ubicación»; on a chosen place it only clears the text.
describe("MAPUI-21: SearchSheet — the place field's ×", () => {
  it("MAPUI-21: the × on a chosen place only clears the text; «Ver coches» keeps the place", async () => {
    const onApply = vi.fn();
    renderWithI18n(
      <SearchSheet
        {...BASE}
        place={{ placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 }}
        onApply={onApply}
      />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Borrar texto" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledWith({ distanceInKm: 50, place: undefined });
  });

  it("MAPUI-21: the × on «Tu ubicación» clears it", async () => {
    const onApply = vi.fn();
    renderWithI18n(
      <SearchSheet {...BASE} place={{ displayName: "Tu ubicación" }} onApply={onApply} />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Borrar texto" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledWith({ distanceInKm: 50, place: null });
  });

  it("MAPUI-21: the × while typing over «Tu ubicación» clears only the typed text", async () => {
    const onApply = vi.fn();
    renderWithI18n(
      <SearchSheet {...BASE} place={{ displayName: "Tu ubicación" }} onApply={onApply} />,
      { locale: "es" },
    );

    // «Ma» typed over «Tu ubicación», then the × on that text.
    await userEvent.tripleClick(screen.getByRole("combobox", { name: "Ciudad" }));
    await userEvent.keyboard("Ma");
    await userEvent.click(screen.getByRole("button", { name: "Borrar texto" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledWith({ distanceInKm: 50, place: undefined });
  });

  it("MAP-32: around «Tu ubicación» the radius choices are enabled and apply", async () => {
    const onApply = vi.fn();
    renderWithI18n(
      <SearchSheet {...BASE} place={{ displayName: "Tu ubicación" }} onApply={onApply} />,
      { locale: "es" },
    );

    const choice = screen.getByRole("radio", { name: "100 km" });
    expect(choice).toBeEnabled();

    await userEvent.click(choice);
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledWith({ distanceInKm: 100, place: undefined });
  });
});

describe("MAPUI-21: SearchSheet — a typed price is kept", () => {
  it("MAPUI-21: a maximum typed into Máximo and not yet blurred reaches Ver coches", async () => {
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} onApply={onApply} />, { locale: "es" });

    await userEvent.type(screen.getByRole("textbox", { name: "Máximo" }), "15000");
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ maxPrice: 15000, distanceInKm: 50, place: undefined });
  });
});

describe("MAPUI-21: SearchSheet — Escape with a list open", () => {
  it("MAPUI-21: the first Escape closes only the list and keeps the draft; the second closes the sheet", async () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} onClose={onClose} onApply={onApply} />, {
      locale: "es",
    });
    const field = screen.getByRole("combobox", { name: "Marca o modelo" });

    await userEvent.type(field, "Toy");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("dialog", { name: "BUSCAR" })).toBeInTheDocument();
    expect(field).toHaveValue("Toy");
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("MAPUI-56: SearchSheet — no-match messages", () => {
  it("MAPUI-56: «Pegaso» in Coche shows «No existe ninguna marca con ese nombre» in the polite status, with no listbox", async () => {
    renderWithI18n(<SearchSheet {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox", { name: "Marca o modelo" }), "Pegaso");

    const statuses = screen.getAllByRole("status").map((status) => status.textContent);
    expect(statuses).toContain("No existe ninguna marca con ese nombre");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("MAPUI-56: «Villarriba» in Dónde, with Nominatim finding nothing, shows «No existe ningún lugar con ese nombre»", async () => {
    server.use(http.get("https://nominatim.openstreetmap.org/search", () => HttpResponse.json([])));
    renderWithI18n(<SearchSheet {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox", { name: "Ciudad" }), "Villarriba");

    await waitFor(() =>
      expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain(
        "No existe ningún lugar con ese nombre",
      ),
    );
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

// docs/specs/redesign-map.md (MAPUI-78, MAPUI-81, owner report 2026-10-31):
// Enter in «Dónde» with places listed and none highlighted chooses the first
// listed, exactly as the pointer would, held in the sheet's own draft until
// «Ver coches» — the same place the phone's other fields already wait for.
describe("MAPUI-78: SearchSheet — Enter in Dónde chooses the first place, held until Ver coches", () => {
  it("MAPUI-78: Enter with no option highlighted chooses the first place, which Ver coches then applies (worked example «28013» → Madrid)", async () => {
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} onApply={onApply} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox", { name: "Ciudad" }), "28013");
    await screen.findByRole("option");

    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        place: { placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 },
      }),
    );
  });
});

describe("MAPUI-81: SearchSheet — Enter in Dónde while the search is running", () => {
  it("MAPUI-81: Enter pressed while the search is pending chooses nothing yet, then the first place once it answers", async () => {
    const handlerInvoked = Promise.withResolvers<void>();
    const response = Promise.withResolvers<ReturnType<typeof makeNominatimResult>[]>();
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", async () => {
        handlerInvoked.resolve();
        return HttpResponse.json(await response.promise);
      }),
    );
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} onApply={onApply} />, { locale: "es" });
    const combobox = screen.getByRole("combobox", { name: "Ciudad" });

    // «28013» (the raw typed text) differs from the answer's displayName
    // («Madrid»), so the box's value unambiguously tells "still typed" apart
    // from "committed once the pending search answered".
    await userEvent.type(combobox, "28013");
    await handlerInvoked.promise;

    await userEvent.keyboard("{Enter}");
    // Nothing chosen yet, while the request is still pending: no place for
    // «Ver coches» to apply.
    expect(combobox).toHaveValue("28013");

    response.resolve([makeNominatimResult()]);

    await waitFor(() => expect(combobox).toHaveValue("Madrid"));
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        place: { placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 },
      }),
    );
  });
});

// docs/specs/motion.md (MOTION-12): the «BUSCAR» sheet, a phone sheet that
// fades, appears at once when opened from the keyboard and disappears at once
// with Escape; opened with a pointer, it still fades in over 180ms.
describe("MOTION-12: SearchSheet — the fading sheet opens and closes at once from the keyboard, but still fades for a pointer", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Abrir búsqueda
        </button>
        <SearchSheet {...BASE} open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  it("MOTION-12: Enter on its opener shows the sheet with no inline opacity below 1, even with animations enabled", async () => {
    await withAnimations(async () => {
      renderWithI18n(<Harness />, { locale: "es" });
      screen.getByRole("button", { name: "Abrir búsqueda" }).focus();

      await userEvent.keyboard("{Enter}");

      const sheet = await screen.findByRole("dialog", { name: "BUSCAR" });
      const opacity = sheet.style.opacity;
      expect(opacity === "" || Number(opacity) >= 1).toBe(true);
    });
  });

  it("MOTION-12: Escape closes the sheet in the same tick, with no exit animation to wait for", async () => {
    await withAnimations(async () => {
      renderWithI18n(<Harness />, { locale: "es" });
      screen.getByRole("button", { name: "Abrir búsqueda" }).focus();
      await userEvent.keyboard("{Enter}");
      await screen.findByRole("dialog", { name: "BUSCAR" });

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    });
  });

  it("MOTION-12: a click on its opener still fades the sheet in, with an inline opacity below 1 right after", async () => {
    await withAnimations(async () => {
      renderWithI18n(<Harness />, { locale: "es" });

      await userEvent.click(screen.getByRole("button", { name: "Abrir búsqueda" }));

      const sheet = await screen.findByRole("dialog", { name: "BUSCAR" });
      expect(Number(sheet.style.opacity)).toBeLessThan(1);
    });
  });

  it("MOTION-12: a press outside still plays the close animation — the sheet is still mounted right after", async () => {
    await withAnimations(async (clock) => {
      renderWithI18n(<Harness />, { locale: "es" });
      await userEvent.click(screen.getByRole("button", { name: "Abrir búsqueda" }));
      await screen.findByRole("dialog", { name: "BUSCAR" });
      await clock.finish();

      // The modal dialog sets the rest of the page's pointer-events to none,
      // which userEvent's realistic click refuses to click through; fireEvent
      // dispatches the outside press directly, as ResponsiveDialog.test.tsx's
      // pointer-close twin does.
      fireEvent.pointerDown(document.body);
      fireEvent.pointerUp(document.body);
      fireEvent.click(document.body);

      expect(screen.getByRole("dialog", { name: "BUSCAR", hidden: true })).toBeInTheDocument();
      // The press did close it: the fade ends and the sheet leaves.
      await clock.finish();
      await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).toBeNull());
    });
  });
});

describe("SearchSheet accessibility", () => {
  it("MAPUI-21: the open sheet has no accessibility violations", async () => {
    renderWithI18n(<SearchSheet {...BASE} initial={{ maxPrice: 20000 }} />, { locale: "es" });

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
