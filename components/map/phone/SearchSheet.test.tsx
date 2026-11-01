import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/test/msw/server";
import { renderWithI18n } from "@/test/utils/render";
import { withAnimations } from "@/test/utils/animations";
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

// docs/specs/map-description-search.md (DESC-2): a fourth section,
// «Descripción», between «Coche» and «Precio». Was "opens with the three
// segments" before this spec change (MAPUI-21).
describe("MAPUI-21: SearchSheet — opens with the four segments", () => {
  it("DESC-2: titled BUSCAR, with Dónde, Coche, Descripción and Precio", () => {
    renderWithI18n(<SearchSheet {...BASE} />, { locale: "es" });

    const dialog = screen.getByRole("dialog", { name: "BUSCAR" });
    expect(dialog).toBeInTheDocument();
    // Section labels over fields, not buttons (SearchPopover README › la hoja «BUSCAR»).
    const sections = within(dialog);
    expect(sections.getByText("Dónde")).toBeInTheDocument();
    expect(sections.getByRole("combobox", { name: "Ciudad o código postal" })).toBeInTheDocument();
    expect(sections.getByText("Coche")).toBeInTheDocument();
    expect(sections.getByRole("combobox", { name: "Marca o modelo" })).toBeInTheDocument();
    expect(sections.getByText("Descripción")).toBeInTheDocument();
    expect(
      sections.getByRole("searchbox", { name: "Buscar en la descripción" }),
    ).toBeInTheDocument();
    expect(sections.getByText("Precio")).toBeInTheDocument();
    expect(sections.getByRole("slider", { name: "Precio máximo" })).toBeInTheDocument();
  });
});

// docs/specs/map-description-search.md (DESC-1): the field's placeholder.
describe("DESC-1: SearchSheet — Descripción's placeholder", () => {
  it("DESC-1: the field carries the description placeholder", () => {
    renderWithI18n(<SearchSheet {...BASE} />, { locale: "es" });

    expect(screen.getByRole("searchbox", { name: "Buscar en la descripción" })).toHaveAttribute(
      "placeholder",
      "Descripción: e46, gti…",
    );
  });
});

// docs/specs/map-description-search.md (DESC-2): the section order, and the
// field itself carries no combobox semantics — unlike Dónde and Coche, it
// has no listbox to expand.
describe("DESC-2: SearchSheet — section order and no combobox semantics on Descripción", () => {
  it("DESC-2: the section labels read Dónde, Coche, Descripción, Precio in order", () => {
    renderWithI18n(<SearchSheet {...BASE} />, { locale: "es" });

    const dialog = screen.getByRole("dialog", { name: "BUSCAR" });
    const labels = within(dialog)
      .getAllByText(/^(Dónde|Coche|Descripción|Precio)$/)
      .map((node) => node.textContent);
    expect(labels).toEqual(["Dónde", "Coche", "Descripción", "Precio"]);
  });

  it("DESC-2: the field has no aria-expanded or aria-autocomplete, and typing opens no listbox", async () => {
    renderWithI18n(<SearchSheet {...BASE} />, { locale: "es" });

    const field = screen.getByRole("searchbox", { name: "Buscar en la descripción" });
    expect(field).not.toHaveAttribute("aria-expanded");
    expect(field).not.toHaveAttribute("aria-autocomplete");

    await userEvent.type(field, "e46");

    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

// docs/specs/map-description-search.md (DESC-5): the 100-character limit,
// shared with the desktop field (KEYWORDS_MAX_LENGTH).
describe("DESC-5: SearchSheet — Descripción's 100-character limit", () => {
  it("DESC-5: typing 101 characters stops at 100", async () => {
    renderWithI18n(<SearchSheet {...BASE} />, { locale: "es" });

    const field = screen.getByRole("searchbox", { name: "Buscar en la descripción" });
    await userEvent.type(field, "a".repeat(101));

    expect(field).toHaveValue("a".repeat(100));
  });
});

// docs/specs/map-description-search.md (DESC-9): «Borrar texto» refocuses
// the field, the same as the desktop one.
describe("DESC-9: SearchSheet — Borrar texto refocuses the field", () => {
  it("DESC-9: Borrar texto empties the field and gives it the focus back", async () => {
    renderWithI18n(<SearchSheet {...BASE} initial={{ keywords: "e46" }} />, { locale: "es" });

    const dialog = screen.getByRole("dialog", { name: "BUSCAR" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar texto" }));

    const field = screen.getByRole("searchbox", { name: "Buscar en la descripción" });
    expect(field).toHaveValue("");
    expect(field).toHaveFocus();
  });
});

// docs/specs/map-description-search.md (DESC-3): text typed in one field
// never changes the other.
describe("DESC-3: SearchSheet — Coche and Descripción stay independent", () => {
  it("DESC-3: text typed in Descripción never reaches Coche's brand or model", async () => {
    renderWithI18n(<SearchSheet {...BASE} />, { locale: "es" });

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Buscar en la descripción" }),
      "e46",
    );

    expect(screen.getByRole("combobox", { name: "Marca o modelo" })).toHaveValue("");
  });

  it("DESC-3: text typed in Coche never reaches Descripción", async () => {
    renderWithI18n(<SearchSheet {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox", { name: "Marca o modelo" }), "Toy");

    expect(screen.getByRole("searchbox", { name: "Buscar en la descripción" })).toHaveValue("");
  });
});

// docs/specs/map-description-search.md (DESC-12): the field opens with the
// applied text, and «Ver coches» (or Enter in the field) applies what it
// holds, with no need to confirm it first.
describe("DESC-12: SearchSheet — Descripción opens with the applied text", () => {
  it("DESC-12: the field opens showing the applied text", () => {
    renderWithI18n(<SearchSheet {...BASE} initial={{ keywords: "e46" }} />, { locale: "es" });

    expect(screen.getByRole("searchbox", { name: "Buscar en la descripción" })).toHaveValue("e46");
  });

  it("DESC-12: Ver coches applies what the field holds, with no need to confirm it first", async () => {
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} onApply={onApply} />, { locale: "es" });

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Buscar en la descripción" }),
      "e46",
    );
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ keywords: "e46" }));
  });

  it("DESC-12: Enter in the field does the same as Ver coches", async () => {
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} onApply={onApply} />, { locale: "es" });

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Buscar en la descripción" }),
      "e46{Enter}",
    );

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ keywords: "e46" }));
  });
});

// docs/specs/map-description-search.md (DESC-13): closing discards what was
// typed; «Borrar» empties the field, which takes effect only on «Ver coches».
describe("DESC-13: SearchSheet — closing discards Descripción, Borrar empties it", () => {
  it("DESC-13: closing the sheet discards text typed into Descripción", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} onApply={onApply} onClose={onClose} />, {
      locale: "es",
    });

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Buscar en la descripción" }),
      "e46",
    );
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("DESC-13: Borrar empties the Descripción field, applied only on Ver coches", async () => {
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} initial={{ keywords: "e46" }} onApply={onApply} />, {
      locale: "es",
    });

    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(onApply).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ keywords: undefined }));
  });
});

// docs/specs/map-description-search.md (DESC-2): Descripción is the same
// field as Dónde and Coche — SearchField's magnifier, 16px text and «Borrar
// texto» button, not a plain input.
describe("DESC-2: SearchSheet — Descripción is the same field as Dónde and Coche", () => {
  it("DESC-2: with text, «Borrar texto» empties the field and only Ver coches applies it", async () => {
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} initial={{ keywords: "e46" }} onApply={onApply} />, {
      locale: "es",
    });

    const dialog = screen.getByRole("dialog", { name: "BUSCAR" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar texto" }));

    expect(screen.getByRole("searchbox", { name: "Buscar en la descripción" })).toHaveValue("");
    expect(onApply).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ keywords: undefined }));
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
    await userEvent.tripleClick(screen.getByRole("combobox", { name: "Ciudad o código postal" }));
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

    await userEvent.type(
      screen.getByRole("combobox", { name: "Ciudad o código postal" }),
      "Villarriba",
    );

    await waitFor(() =>
      expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain(
        "No existe ningún lugar con ese nombre",
      ),
    );
    expect(screen.queryByRole("listbox")).toBeNull();
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
