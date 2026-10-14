import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";
import { server } from "@/test/msw/server";
import { renderWithI18n } from "@/test/utils/render";
import { SearchSheet, type SearchSheetProps } from "./SearchSheet";

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
    expect(sections.getByRole("combobox", { name: "Ciudad o código postal" })).toBeInTheDocument();
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

    expect(onApply).toHaveBeenCalledWith({ maxPrice: 20000, distanceInKm: 50, place: null });
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

    expect(onApply).toHaveBeenCalledWith({ distanceInKm: 25, place: null });
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

describe("MAPUI-21: SearchSheet — a typed price is kept", () => {
  it("MAPUI-21: a maximum typed into Máximo and not yet blurred reaches Ver coches", async () => {
    const onApply = vi.fn();
    renderWithI18n(<SearchSheet {...BASE} onApply={onApply} />, { locale: "es" });

    await userEvent.type(screen.getByRole("textbox", { name: "Máximo" }), "15000");
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ maxPrice: 15000, distanceInKm: 50, place: null });
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

describe("SearchSheet accessibility", () => {
  it("MAPUI-21: the open sheet has no accessibility violations", async () => {
    renderWithI18n(<SearchSheet {...BASE} initial={{ maxPrice: 20000 }} />, { locale: "es" });

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
