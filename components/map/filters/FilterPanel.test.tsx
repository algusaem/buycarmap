import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import type { SearchInput } from "@/lib/search/schema";
import { FilterPanel, type FilterPanelProps } from "./FilterPanel";

// docs/specs/redesign-map.md (MAPUI-72 to MAPUI-74, owner report 2026-10-31):
// «Kilómetros y año» becomes two sections, «Kilómetros» (boxes «Mínimo» and
// «Máximo») and «Año» (box «Desde»). «Mínimo»/«Máximo» read the same as the
// price boxes' own labels, so every lookup below scopes with `within` the
// section it means (MAPUI-83: PanelSection gives each section's own
// accessible name, so it is a named region, not a DOM walk off the heading).
function sectionNamed(heading: string): HTMLElement {
  return screen.getByRole("region", { name: heading });
}

const DESKTOP = {
  mode: "desktop",
  input: {},
  onChange: vi.fn(),
  onClear: vi.fn(),
  onCloseDesktop: vi.fn(),
} satisfies FilterPanelProps;

const PHONE = {
  mode: "phone",
  open: true,
  input: {},
  onChange: vi.fn(),
  onClear: vi.fn(),
  onApply: vi.fn(),
  onDiscard: vi.fn(),
} satisfies FilterPanelProps;

describe("MAPUI-72: FilterPanel — exactly seven sections, in order", () => {
  it("MAPUI-72: has Precio, Combustible, Cambio, Kilómetros, Año, Publicado and Marca y modelo, in that order", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} />, { locale: "es" });

    // The sections are `h3`s under the panel's own `h2` title.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("FILTROS");
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Precio",
      "Combustible",
      "Cambio",
      "Kilómetros",
      "Año",
      "Publicado",
      "Marca y modelo",
    ]);
  });
});

describe("MAPUI-16: FilterPanel — Cambio", () => {
  it("MAPUI-16: offers Todos, Manual and Automático as a single choice", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} />, { locale: "es" });

    const group = screen.getByRole("radiogroup", { name: "Cambio" });
    expect(group).toBeInTheDocument();
    for (const label of ["Todos", "Manual", "Automático"]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });

  it("MAPUI-16: Todos is checked when neither manual nor automatic is set", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{}} />, { locale: "es" });

    expect(screen.getByRole("radio", { name: "Todos" })).toBeChecked();
  });

  it("MAPUI-16 edge case: the old multi-choice gearbox=manual,automatic reads as Todos", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ gearbox: ["manual", "automatic"] }} />, {
      locale: "es",
    });

    expect(screen.getByRole("radio", { name: "Todos" })).toBeChecked();
  });

  it("MAPUI-16: choosing Automático replaces the whole gearbox criterion", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ gearbox: ["manual"] }} onChange={onChange} />,
      {
        locale: "es",
      },
    );

    await userEvent.click(screen.getByRole("radio", { name: "Automático" }));

    expect(onChange).toHaveBeenCalledWith({ gearbox: ["automatic"] });
  });
});

describe("MAPUI-17: FilterPanel — Publicado", () => {
  it("MAPUI-17: offers Cualquier momento, Últimas 24 h, Última semana and Último mes", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} />, { locale: "es" });

    // A row of single-active chips (FilterSheet and Chip READMEs): with no
    // timeFilter, «Cualquier momento» is the pressed one.
    expect(screen.getByRole("button", { name: "Cualquier momento" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const label of ["Últimas 24 h", "Última semana", "Último mes"]) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("MAPUI-17: choosing Última semana sets timeFilter to lastWeek", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Última semana" }));

    expect(onChange).toHaveBeenCalledWith({ timeFilter: "lastWeek" });
  });

  it("MAPUI-17: choosing Cualquier momento clears timeFilter", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ timeFilter: "today" }} onChange={onChange} />,
      {
        locale: "es",
      },
    );

    expect(screen.getByRole("button", { name: "Últimas 24 h" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cualquier momento" }));

    expect(onChange).toHaveBeenCalledWith({ timeFilter: undefined });
  });
});

describe("MAPUI-19: FilterPanel — desktop mode", () => {
  it("MAPUI-19: every choice applies at once, with no buffering", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });

    await userEvent.click(screen.getByRole("radio", { name: "Automático" }));

    expect(onChange).toHaveBeenCalledWith({ gearbox: ["automatic"] });
  });

  it("MAPUI-19: Ver coches only closes the dropdown", async () => {
    const onCloseDesktop = vi.fn();
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...DESKTOP} onCloseDesktop={onCloseDesktop} onChange={onChange} />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onCloseDesktop).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("MAPUI-19: Borrar clears every panel criterion at once", async () => {
    const onClear = vi.fn();
    renderWithI18n(
      <FilterPanel
        {...DESKTOP}
        input={{ maxPrice: 20000, gearbox: ["automatic"] }}
        onClear={onClear}
      />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("MAPUI-72: FilterPanel — phone mode", () => {
  it("MAPUI-72: has the same seven sections as desktop", () => {
    renderWithI18n(<FilterPanel {...PHONE} />, { locale: "es" });

    // The sections are `h3`s under the sheet's `h2` title, which names the dialog.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("FILTROS");
    expect(screen.getByRole("dialog", { name: "FILTROS" })).toBeInTheDocument();
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Precio",
      "Combustible",
      "Cambio",
      "Kilómetros",
      "Año",
      "Publicado",
      "Marca y modelo",
    ]);
  });

  it("MAPUI-21/MAPUI-22: a choice does not reach onChange until Ver coches", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onChange={onChange} />, { locale: "es" });

    await userEvent.click(screen.getByRole("radio", { name: "Automático" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("MAPUI-21/MAPUI-22: Ver coches applies the buffered change and closes", async () => {
    const onApply = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onApply={onApply} />, { locale: "es" });

    await userEvent.click(screen.getByRole("radio", { name: "Automático" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-21/MAPUI-22: Borrar empties the sheet's fields, applied only on Ver coches", async () => {
    const onChange = vi.fn();
    const onApply = vi.fn();
    renderWithI18n(
      <FilterPanel {...PHONE} input={{ maxPrice: 20000 }} onChange={onChange} onApply={onApply} />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("MAPUI-15: FilterPanel — Combustible", () => {
  it("MAPUI-15: pressing Híbrido adds both hybrid values, in the panel's order", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ engine: ["gasoil"] }} onChange={onChange} />,
      {
        locale: "es",
      },
    );

    await userEvent.click(screen.getByRole("button", { name: "Híbrido" }));

    expect(onChange).toHaveBeenCalledWith({ engine: ["gasoil", "hybride", "hybride_plugin"] });
  });

  it("MAPUI-15: Híbrido reads as chosen when only one hybrid value is present", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ engine: ["hybride_plugin"] }} />, {
      locale: "es",
    });

    expect(screen.getByRole("button", { name: "Híbrido" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Diésel" })).toHaveAttribute("aria-pressed", "false");
  });

  it("MAPUI-18: unpressing Diésel keeps a fuel the panel does not offer (cng)", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ engine: ["gasoil", "cng"] }} onChange={onChange} />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Diésel" }));

    expect(onChange).toHaveBeenCalledWith({ engine: ["cng"] });
  });

  it("MAPUI-15: unpressing the only chosen fuel leaves no fuel criterion", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ engine: ["gasoil"] }} onChange={onChange} />,
      {
        locale: "es",
      },
    );

    await userEvent.click(screen.getByRole("button", { name: "Diésel" }));

    expect(onChange).toHaveBeenCalledWith({ engine: undefined });
  });
});

describe("MAPUI-16: FilterPanel — Cambio back to Todos", () => {
  it("MAPUI-16: choosing Todos removes the gearbox criterion", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ gearbox: ["manual"] }} onChange={onChange} />,
      {
        locale: "es",
      },
    );

    await userEvent.click(screen.getByRole("radio", { name: "Todos" }));

    expect(onChange).toHaveBeenCalledWith({ gearbox: undefined });
  });
});

describe("MAPUI-72: FilterPanel — Kilómetros and Año, each scoped to its own section", () => {
  it("MAPUI-72: Kilómetros holds Mínimo and Máximo; Año holds Desde, with their names and placeholders", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} />, { locale: "es" });

    const kilometros = within(sectionNamed("Kilómetros"));
    const minimo = kilometros.getByRole("textbox", { name: "Mínimo" });
    const maximo = kilometros.getByRole("textbox", { name: "Máximo" });
    expect(minimo).toHaveAttribute("name", "minKm");
    expect(minimo).toHaveAttribute("placeholder", "50.000…");
    expect(maximo).toHaveAttribute("name", "maxKm");
    expect(maximo).toHaveAttribute("placeholder", "100.000…");

    const anio = within(sectionNamed("Año"));
    const desde = anio.getByRole("textbox", { name: "Desde" });
    expect(desde).toHaveAttribute("name", "minYear");
    expect(desde).toHaveAttribute("placeholder", "2017…");
  });

  it("MAPUI-72: typing 0 into Mínimo is accepted", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.change(minimo, { target: { value: "0" } });
    fireEvent.blur(minimo);

    expect(onChange).toHaveBeenCalledWith({ minKm: 0 });
  });
});

describe("MAPUI-73: FilterPanel — Mínimo applies as Máximo does", () => {
  it("MAPUI-73: desktop, typing 50.000 into Mínimo and blurring applies minKm, needing no brand or model", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.change(minimo, { target: { value: "50000" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(minimo);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ minKm: 50000 });
  });

  it("MAPUI-73: desktop, Enter also applies the typed minimum", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    await userEvent.type(minimo, "50000{Enter}");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ minKm: 50000 });
  });

  it("MAPUI-73: desktop, emptying a set Mínimo clears minKm and leaves maxKm as it is", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ minKm: 50000, maxKm: 100000 }} onChange={onChange} />,
      { locale: "es" },
    );
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });
    expect(minimo).toHaveValue("50.000");

    fireEvent.change(minimo, { target: { value: "" } });
    fireEvent.blur(minimo);

    expect(onChange.mock.calls[0][0]).toStrictEqual({ minKm: undefined, maxKm: 100000 });
  });

  it("MAPUI-73: phone, a typed Mínimo reaches onChange only at Ver coches, with minKm 50000", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onChange={onChange} />, { locale: "es" });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.change(minimo, { target: { value: "50000" } });
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minKm: 50000 }));
  });

  it("MAPUI-73: phone, closing without Ver coches discards the typed Mínimo", async () => {
    const onChange = vi.fn();
    const onDiscard = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onChange={onChange} onDiscard={onDiscard} />, {
      locale: "es",
    });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.change(minimo, { target: { value: "50000" } });
    await userEvent.keyboard("{Escape}");

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("MAPUI-74: FilterPanel — a typed minimum mileage above the maximum is swapped", () => {
  it("MAPUI-74: desktop, worked example — typing 150.000 in Mínimo over an existing Máximo of 100.000 swaps on blur", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} onChange={onChange} />, {
      locale: "es",
    });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.change(minimo, { target: { value: "150000" } });
    fireEvent.blur(minimo);

    expect(onChange).toHaveBeenCalledWith({ minKm: 100000, maxKm: 150000 });
  });

  it("MAPUI-74: desktop, worked example — typing 100.000 in Máximo under an existing Mínimo of 150.000 swaps on blur too", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ minKm: 150000 }} onChange={onChange} />, {
      locale: "es",
    });
    const maximo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });

    fireEvent.change(maximo, { target: { value: "100000" } });
    fireEvent.blur(maximo);

    expect(onChange).toHaveBeenCalledWith({ minKm: 100000, maxKm: 150000 });
  });

  it("MAPUI-74: desktop, Enter swaps just as blur does", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} onChange={onChange} />, {
      locale: "es",
    });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.change(minimo, { target: { value: "150000" } });
    fireEvent.keyDown(minimo, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({ minKm: 100000, maxKm: 150000 });
  });

  it("MAPUI-74: desktop, Enter on Máximo swaps too — worked example, Mínimo 150.000 and a typed Máximo of 100.000", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ minKm: 150000 }} onChange={onChange} />, {
      locale: "es",
    });
    const maximo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });

    fireEvent.change(maximo, { target: { value: "100000" } });
    fireEvent.keyDown(maximo, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({ minKm: 100000, maxKm: 150000 });
  });

  it("MAPUI-74: desktop, Enter applies a swap and the focused box shows the applied amount, as after leaving it (amended 2026-10-31)", async () => {
    function ControlledPanel() {
      const [input, setInput] = useState<SearchInput>({ maxKm: 100000 });
      return (
        <FilterPanel
          {...DESKTOP}
          input={input}
          onChange={(patch) => setInput((current) => ({ ...current, ...patch }))}
        />
      );
    }
    renderWithI18n(<ControlledPanel />, { locale: "es" });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    await userEvent.type(minimo, "150000{Enter}");

    expect(within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" })).toHaveValue(
      "100.000",
    );
    expect(within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" })).toHaveValue(
      "150.000",
    );
  });

  it("MAPUI-74: phone, both typed, Ver coches hands over the swapped minKm 100000 and maxKm 150000", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onChange={onChange} />, { locale: "es" });
    const section = within(sectionNamed("Kilómetros"));

    fireEvent.change(section.getByRole("textbox", { name: "Mínimo" }), {
      target: { value: "150000" },
    });
    fireEvent.change(section.getByRole("textbox", { name: "Máximo" }), {
      target: { value: "100000" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ minKm: 100000, maxKm: 150000 }),
    );
  });

  it("MAPUI-74: equal ends apply as typed", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} onChange={onChange} />, {
      locale: "es",
    });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.change(minimo, { target: { value: "100000" } });
    fireEvent.blur(minimo);

    expect(onChange).toHaveBeenCalledWith({ minKm: 100000, maxKm: 100000 });
  });

  it("MAPUI-73: desktop, worked example — Mínimo 150.000 with no brand or model reaches onChange with no maximum", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.change(minimo, { target: { value: "150000" } });
    fireEvent.blur(minimo);

    expect(onChange).toHaveBeenCalledWith({ minKm: 150000, maxKm: undefined });
  });

  it("MAPUI-73: desktop, Mínimo then Máximo blurred one after the other end with both in the last call", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });
    const section = within(sectionNamed("Kilómetros"));

    fireEvent.change(section.getByRole("textbox", { name: "Mínimo" }), {
      target: { value: "50000" },
    });
    fireEvent.blur(section.getByRole("textbox", { name: "Mínimo" }));
    fireEvent.change(section.getByRole("textbox", { name: "Máximo" }), {
      target: { value: "100000" },
    });
    fireEvent.blur(section.getByRole("textbox", { name: "Máximo" }));

    expect(onChange).toHaveBeenLastCalledWith({ minKm: 50000, maxKm: 100000 });
  });

  it("MAPUI-73: phone, emptying a set Mínimo hands over minKm as an explicit undefined at Ver coches", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} input={{ minKm: 50000 }} onChange={onChange} />, {
      locale: "es",
    });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.change(minimo, { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0][0];
    expect(Object.hasOwn(patch, "minKm")).toBe(true);
    expect(patch.minKm).toBeUndefined();
  });

  it("MAPUI-72: Mínimo and Máximo show 50.000 and 100.000, scoped to Kilómetros", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ minKm: 50000, maxKm: 100000 }} />, {
      locale: "es",
    });
    const section = within(sectionNamed("Kilómetros"));

    expect(section.getByRole("textbox", { name: "Mínimo" })).toHaveValue("50.000");
    expect(section.getByRole("textbox", { name: "Máximo" })).toHaveValue("100.000");
  });

  it("MAPUI-74: desktop, blurring an untouched Mínimo above the maximum still swaps it (amended 2026-10-31)", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ minKm: 150000, maxKm: 100000 }} onChange={onChange} />,
      { locale: "es" },
    );
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.focus(minimo);
    fireEvent.blur(minimo);

    expect(onChange).toHaveBeenCalledWith({ minKm: 100000, maxKm: 150000 });
  });

  it("MAPUI-74: phone, an untouched sheet with the ends reversed hands over them swapped at Ver coches (amended 2026-10-31)", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...PHONE} input={{ minKm: 150000, maxKm: 100000 }} onChange={onChange} />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ minKm: 100000, maxKm: 150000 }),
    );
  });
});

describe("MAPUI-83: FilterPanel — every section is named by its title", () => {
  it.each([
    ["desktop", DESKTOP],
    ["phone", PHONE],
  ] as const)(
    "MAPUI-83: %s — all seven sections are named regions, and the two Mínimo and two Máximo are told apart by their section",
    (_mode, props) => {
      renderWithI18n(<FilterPanel {...props} />, { locale: "es" });

      for (const heading of [
        "Precio",
        "Combustible",
        "Cambio",
        "Kilómetros",
        "Año",
        "Publicado",
        "Marca y modelo",
      ]) {
        expect(screen.getByRole("region", { name: heading })).toBeInTheDocument();
      }

      const precio = within(screen.getByRole("region", { name: "Precio" }));
      expect(precio.getAllByRole("textbox", { name: "Mínimo" })).toHaveLength(1);
      expect(precio.getAllByRole("textbox", { name: "Máximo" })).toHaveLength(1);

      const kilometros = within(screen.getByRole("region", { name: "Kilómetros" }));
      expect(kilometros.getAllByRole("textbox", { name: "Mínimo" })).toHaveLength(1);
      expect(kilometros.getAllByRole("textbox", { name: "Máximo" })).toHaveLength(1);

      const anio = within(screen.getByRole("region", { name: "Año" }));
      expect(anio.getByRole("textbox", { name: "Desde" })).toBeInTheDocument();
    },
  );
});

describe("MAPUI-72: FilterPanel — number formatting on Máximo and Desde (amends MAPUI-11, MAPUI-14)", () => {
  it("MAPUI-72: a typed maximum mileage and minimum year reach onChange as numbers once each box loses focus", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    fireEvent.change(km, { target: { value: "120000" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(km);
    const year = within(sectionNamed("Año")).getByRole("textbox", { name: "Desde" });
    fireEvent.change(year, { target: { value: "2015" } });
    fireEvent.blur(year);

    expect(onChange).toHaveBeenNthCalledWith(1, { maxKm: 120000 });
    expect(onChange).toHaveBeenNthCalledWith(2, { minYear: 2015 });
  });

  it("MAPUI-11: Máximo shows the thousands point once blurred, and parses one typed with or without it", () => {
    const onChange = vi.fn();
    const { rerender } = renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} onChange={onChange} />,
      { locale: "es" },
    );

    expect(within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" })).toHaveValue(
      "100.000",
    );

    rerender(<FilterPanel {...DESKTOP} input={{}} onChange={onChange} />);
    const withDots = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    fireEvent.change(withDots, { target: { value: "100.000" } });
    fireEvent.blur(withDots);
    expect(onChange).toHaveBeenNthCalledWith(1, { maxKm: 100000 });

    fireEvent.change(withDots, { target: { value: "100000" } });
    fireEvent.blur(withDots);
    expect(onChange).toHaveBeenNthCalledWith(2, { maxKm: 100000 });
  });

  it("MAPUI-14: the blurred Máximo with 100000 shows 100.000 with the km suffix next to it", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} />, { locale: "es" });

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    expect(km).toHaveValue("100.000");
    const suffix = km.nextElementSibling;
    expect(suffix).toHaveTextContent("km");
    expect(suffix).toHaveAttribute("aria-hidden", "true");
  });

  it("MAPUI-14: the empty Máximo shows no km suffix next to the placeholder", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{}} />, { locale: "es" });

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    expect(km).toHaveValue("");
    expect(km.nextElementSibling).toBeNull();
  });

  it("MAPUI-11: Máximo reads with a comma in English", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} />, { locale: "en" });

    const km = within(sectionNamed("Mileage")).getByRole("textbox", { name: "Maximum" });
    expect(km).toHaveValue("100,000");
  });

  it("MAPUI-14: emptying Máximo clears the criterion", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 120000 }} onChange={onChange} />, {
      locale: "es",
    });

    const box = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    expect(box).toHaveValue("120.000");
    fireEvent.change(box, { target: { value: "" } });
    fireEvent.blur(box);

    expect(onChange).toHaveBeenCalledWith({ maxKm: undefined });
  });

  it("MAPUI-14: Enter applies the typed year", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });

    await userEvent.type(
      within(sectionNamed("Año")).getByRole("textbox", { name: "Desde" }),
      "2017{Enter}",
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ minYear: 2017 });
  });

  it("MAPUI-11: desktop, Enter applies the typed year and the box reads 2017, never 2.017", async () => {
    function ControlledPanel() {
      const [input, setInput] = useState<SearchInput>({});
      return (
        <FilterPanel
          {...DESKTOP}
          input={input}
          onChange={(patch) => setInput((current) => ({ ...current, ...patch }))}
        />
      );
    }
    renderWithI18n(<ControlledPanel />, { locale: "es" });
    const desde = within(sectionNamed("Año")).getByRole("textbox", { name: "Desde" });

    await userEvent.type(desde, "2017{Enter}");

    expect(within(sectionNamed("Año")).getByRole("textbox", { name: "Desde" })).toHaveValue("2017");
  });

  it("MAPUI-14: 0 km and a year before 1900 both reach the search", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} onChange={onChange} />, {
      locale: "es",
    });

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    fireEvent.change(km, { target: { value: "0" } });
    fireEvent.blur(km);
    const year = within(sectionNamed("Año")).getByRole("textbox", { name: "Desde" });
    fireEvent.change(year, { target: { value: "1899" } });
    fireEvent.blur(year);

    expect(onChange).toHaveBeenNthCalledWith(1, { maxKm: 0 });
    expect(onChange).toHaveBeenNthCalledWith(2, { minYear: 1899 });
    expect(year).toHaveValue("1899");
  });

  it("MAPUI-14: typing text Máximo cannot read keeps the previous maxKm and shows it again on blur", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 120000 }} onChange={onChange} />, {
      locale: "es",
    });

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    fireEvent.change(km, { target: { value: "abc" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(km);

    expect(onChange).not.toHaveBeenCalled();
    expect(km).toHaveValue("120.000");
  });

  it("MAPUI-14: a negative amount is unreadable too in Máximo — it keeps the previous maxKm and shows it again on blur", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 120000 }} onChange={onChange} />, {
      locale: "es",
    });

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    fireEvent.change(km, { target: { value: "-5" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(km);

    expect(onChange).not.toHaveBeenCalled();
    expect(km).toHaveValue("120.000");
  });

  it("MAPUI-72: Máximo and Desde show their visible labels and example placeholders, with names and no autofill", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} />, { locale: "es" });

    expect(within(sectionNamed("Kilómetros")).getByText("Máximo")).not.toHaveClass("sr-only");
    expect(within(sectionNamed("Año")).getByText("Desde")).not.toHaveClass("sr-only");

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    const year = within(sectionNamed("Año")).getByRole("textbox", { name: "Desde" });
    expect(km).toHaveAttribute("placeholder", "100.000…");
    expect(year).toHaveAttribute("placeholder", "2017…");
    expect(km).toHaveAttribute("name", "maxKm");
    expect(year).toHaveAttribute("name", "minYear");
    expect(km).toHaveAttribute("autocomplete", "off");
    expect(year).toHaveAttribute("autocomplete", "off");
  });
});

describe("MAPUI-72: FilterPanel — number formatting and the km suffix on Mínimo (amends MAPUI-11)", () => {
  it("MAPUI-72: the blurred Mínimo with 50000 shows 50.000 with the km suffix next to it, aria-hidden", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ minKm: 50000 }} />, { locale: "es" });

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });
    expect(km).toHaveValue("50.000");
    const suffix = km.nextElementSibling;
    expect(suffix).toHaveTextContent("km");
    expect(suffix).toHaveAttribute("aria-hidden", "true");
  });

  it("MAPUI-72: the empty Mínimo shows no km suffix next to the placeholder", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{}} />, { locale: "es" });

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });
    expect(km).toHaveValue("");
    expect(km.nextElementSibling).toBeNull();
  });

  it("MAPUI-72: Mínimo parses a typed amount with or without the thousands point, both to minKm 100000", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });
    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });

    fireEvent.change(minimo, { target: { value: "100.000" } });
    fireEvent.blur(minimo);
    expect(onChange).toHaveBeenNthCalledWith(1, { minKm: 100000 });

    fireEvent.change(minimo, { target: { value: "100000" } });
    fireEvent.blur(minimo);
    expect(onChange).toHaveBeenNthCalledWith(2, { minKm: 100000 });
  });
});

describe("MAPUI-21/MAPUI-73: FilterPanel — phone Kilómetros and Año apply without blur", () => {
  it("MAPUI-21: a typed maximum mileage reaches Ver coches without the box losing focus", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onChange={onChange} />, { locale: "es" });

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    fireEvent.change(km, { target: { value: "100000" } });
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxKm: 100000 }));
  });

  it("MAPUI-73: a typed minimum mileage also reaches Ver coches without the box losing focus", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onChange={onChange} />, { locale: "es" });

    const minimo = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Mínimo" });
    fireEvent.change(minimo, { target: { value: "50000" } });
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minKm: 50000 }));
  });

  it("MAPUI-14: in the phone sheet, text Máximo cannot read applies nothing, even without the box losing focus", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} input={{ maxKm: 100000 }} onChange={onChange} />, {
      locale: "es",
    });

    const km = within(sectionNamed("Kilómetros")).getByRole("textbox", { name: "Máximo" });
    fireEvent.change(km, { target: { value: "abc" } });
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].maxKm).toBe(100000);
  });

  it("MAPUI-21: a typed minimum year reaches Ver coches without the box losing focus", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onChange={onChange} />, { locale: "es" });

    const year = within(sectionNamed("Año")).getByRole("textbox", { name: "Desde" });
    fireEvent.change(year, { target: { value: "2015" } });
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minYear: 2015 }));
  });
});

describe("MAPUI-21/MAPUI-22: FilterPanel — phone apply and discard", () => {
  it("MAPUI-18/MAPUI-22: Borrar then Ver coches hands over every criterion cleared and the q text emptied", async () => {
    const onChange = vi.fn();
    const onApply = vi.fn();
    renderWithI18n(
      <FilterPanel
        {...PHONE}
        input={{ maxPrice: 20000, engine: ["gasoil"], minKm: 1000 }}
        onChange={onChange}
        onApply={onApply}
      />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      keywords: "",
      minPrice: undefined,
      maxPrice: undefined,
      engine: undefined,
      minKm: undefined,
    });
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-21/MAPUI-22: Ver coches with a chosen fuel hands over the draft, without touching q", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} input={{ maxPrice: 20000 }} onChange={onChange} />, {
      locale: "es",
    });

    await userEvent.click(screen.getByRole("button", { name: "Diésel" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0]?.[0];
    expect(patch).toEqual({ maxPrice: 20000, engine: ["gasoil"] });
    expect(patch).not.toHaveProperty("keywords");
  });

  it("MAPUI-21/MAPUI-22: Escape discards the sheet without applying", async () => {
    const onDiscard = vi.fn();
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onDiscard={onDiscard} onChange={onChange} />, {
      locale: "es",
    });

    await userEvent.click(screen.getByRole("radio", { name: "Automático" }));
    await userEvent.keyboard("{Escape}");

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("MAPUI-22: a closed phone panel renders nothing", () => {
    renderWithI18n(<FilterPanel {...PHONE} open={false} />, { locale: "es" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("MAPUI-72: FilterPanel — the controls it does not have", () => {
  it("MAPUI-72: no horsepower, free-text, maximum-year or sort control (minKm now offered, MAPUI-72)", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} />, { locale: "es" });

    // The only amount boxes are the price boxes, Kilómetros's Mínimo and
    // Máximo and Año's Desde (MAPUI-11, MAPUI-72, text boxes so they can show
    // the thousands point): no CV, no maximum year, and no other free-text
    // field.
    expect(screen.getAllByRole("textbox").map((box) => box.getAttribute("name"))).toEqual([
      "minPrice",
      "maxPrice",
      "minKm",
      "maxKm",
      "minYear",
    ]);
    // The only sliders are the two price knobs.
    expect(screen.getAllByRole("slider").map((knob) => knob.getAttribute("aria-label"))).toEqual([
      "Precio mínimo",
      "Precio máximo",
    ]);
    // The «Marca y modelo» type-ahead is its own combobox, not a plain text field.
    expect(screen.getAllByRole("combobox").map((box) => box.getAttribute("aria-label"))).toEqual([
      "Marca o modelo",
    ]);
    expect(screen.queryByText(/CV|potencia|caballos/i)).toBeNull();
    expect(screen.queryByText(/ordenar|orden/i)).toBeNull();
  });
});

describe("MAPUI-15: FilterPanel — unpressing Híbrido", () => {
  it("MAPUI-15: with gasoil and both hybrid values, unpressing Híbrido leaves gasoil", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel
        {...DESKTOP}
        input={{ engine: ["gasoil", "hybride", "hybride_plugin"] }}
        onChange={onChange}
      />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Híbrido" }));

    expect(onChange).toHaveBeenCalledWith({ engine: ["gasoil"] });
  });

  it("MAPUI-15: with hybride_plugin alone, unpressing Híbrido leaves no fuel criterion", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ engine: ["hybride_plugin"] }} onChange={onChange} />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Híbrido" }));

    expect(onChange).toHaveBeenCalledWith({ engine: undefined });
  });
});

describe("MAPUI-56: FilterPanel — Marca y modelo with no match", () => {
  it("MAPUI-56: «Pegaso» shows «No existe ninguna marca con ese nombre» in the polite status, with no listbox", async () => {
    renderWithI18n(<FilterPanel {...DESKTOP} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox", { name: "Marca o modelo" }), "Pegaso");

    expect(screen.getByRole("status").textContent).toBe("No existe ninguna marca con ese nombre");
    expect(screen.getAllByText("No existe ninguna marca con ese nombre")).toHaveLength(2);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("FilterPanel accessibility", () => {
  it("MAPUI-19: the desktop panel has no accessibility violations", async () => {
    const { container } = renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxPrice: 20000 }} />, {
      locale: "es",
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("MAPUI-22: the phone sheet has no accessibility violations", async () => {
    renderWithI18n(<FilterPanel {...PHONE} input={{ engine: ["gasoil"] }} />, { locale: "es" });

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
