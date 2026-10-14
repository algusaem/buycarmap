import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { FilterPanel, type FilterPanelProps } from "./FilterPanel";

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

describe("MAPUI-14: FilterPanel — exactly six sections, in order", () => {
  it("MAPUI-14: has Precio, Combustible, Cambio, Kilómetros y año, Publicado and Marca y modelo, in that order", () => {
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
      "Kilómetros y año",
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

describe("MAPUI-22: FilterPanel — phone mode", () => {
  it("MAPUI-22: has the same six sections as desktop", () => {
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
      "Kilómetros y año",
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

describe("MAPUI-14: FilterPanel — Kilómetros y año", () => {
  it("MAPUI-14: a typed maximum mileage and minimum year reach onChange as numbers once each box loses focus", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });

    const km = screen.getByRole("textbox", { name: "Kilómetros, hasta" });
    fireEvent.change(km, { target: { value: "120000" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(km);
    const year = screen.getByRole("textbox", { name: "Año, desde" });
    fireEvent.change(year, { target: { value: "2015" } });
    fireEvent.blur(year);

    expect(onChange).toHaveBeenNthCalledWith(1, { maxKm: 120000 });
    expect(onChange).toHaveBeenNthCalledWith(2, { minYear: 2015 });
  });

  it("MAPUI-11: Kilómetros, hasta shows the thousands point once blurred, and parses one typed with or without it", () => {
    const onChange = vi.fn();
    const { rerender } = renderWithI18n(
      <FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} onChange={onChange} />,
      { locale: "es" },
    );

    expect(screen.getByRole("textbox", { name: "Kilómetros, hasta" })).toHaveValue("100.000");

    rerender(<FilterPanel {...DESKTOP} input={{}} onChange={onChange} />);
    const withDots = screen.getByRole("textbox", { name: "Kilómetros, hasta" });
    fireEvent.change(withDots, { target: { value: "100.000" } });
    fireEvent.blur(withDots);
    expect(onChange).toHaveBeenNthCalledWith(1, { maxKm: 100000 });

    fireEvent.change(withDots, { target: { value: "100000" } });
    fireEvent.blur(withDots);
    expect(onChange).toHaveBeenNthCalledWith(2, { maxKm: 100000 });
  });

  it("MAPUI-14: the blurred box with 100000 shows 100.000 with the km suffix next to it", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} />, { locale: "es" });

    const km = screen.getByRole("textbox", { name: "Kilómetros, hasta" });
    expect(km).toHaveValue("100.000");
    const suffix = km.nextElementSibling;
    expect(suffix).toHaveTextContent("km");
    expect(suffix).toHaveAttribute("aria-hidden", "true");
  });

  it("MAPUI-14: the empty box shows no km suffix next to the placeholder", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{}} />, { locale: "es" });

    const km = screen.getByRole("textbox", { name: "Kilómetros, hasta" });
    expect(km).toHaveValue("");
    expect(km.nextElementSibling).toBeNull();
  });

  it("MAPUI-11: Kilómetros, hasta reads with a comma in English", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} />, { locale: "en" });

    expect(screen.getByRole("textbox", { name: "Mileage, up to" })).toHaveValue("100,000");
  });

  it("MAPUI-14: emptying the mileage box clears the criterion", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 120000 }} onChange={onChange} />, {
      locale: "es",
    });

    const box = screen.getByRole("textbox", { name: "Kilómetros, hasta" });
    expect(box).toHaveValue("120.000");
    fireEvent.change(box, { target: { value: "" } });
    fireEvent.blur(box);

    expect(onChange).toHaveBeenCalledWith({ maxKm: undefined });
  });

  it("MAPUI-14: Enter applies the typed year", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} onChange={onChange} />, { locale: "es" });

    await userEvent.type(screen.getByRole("textbox", { name: "Año, desde" }), "2017{Enter}");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ minYear: 2017 });
  });

  it("MAPUI-14: 0 km and a year before 1900 both reach the search", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 100000 }} onChange={onChange} />, {
      locale: "es",
    });

    const km = screen.getByRole("textbox", { name: "Kilómetros, hasta" });
    fireEvent.change(km, { target: { value: "0" } });
    fireEvent.blur(km);
    const year = screen.getByRole("textbox", { name: "Año, desde" });
    fireEvent.change(year, { target: { value: "1899" } });
    fireEvent.blur(year);

    expect(onChange).toHaveBeenNthCalledWith(1, { maxKm: 0 });
    expect(onChange).toHaveBeenNthCalledWith(2, { minYear: 1899 });
    expect(year).toHaveValue("1899");
  });

  it("MAPUI-14: typing text the box cannot read keeps the previous maxKm and shows it again on blur", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 120000 }} onChange={onChange} />, {
      locale: "es",
    });

    const km = screen.getByRole("textbox", { name: "Kilómetros, hasta" });
    fireEvent.change(km, { target: { value: "abc" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(km);

    expect(onChange).not.toHaveBeenCalled();
    expect(km).toHaveValue("120.000");
  });

  it("MAPUI-14: a negative amount is unreadable too — it keeps the previous maxKm and shows it again on blur", () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...DESKTOP} input={{ maxKm: 120000 }} onChange={onChange} />, {
      locale: "es",
    });

    const km = screen.getByRole("textbox", { name: "Kilómetros, hasta" });
    fireEvent.change(km, { target: { value: "-5" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(km);

    expect(onChange).not.toHaveBeenCalled();
    expect(km).toHaveValue("120.000");
  });

  it("MAPUI-14: the boxes show the visible labels and the example placeholders, with names and no autofill", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} />, { locale: "es" });

    const km = screen.getByLabelText("Kilómetros, hasta");
    const year = screen.getByLabelText("Año, desde");
    expect(screen.getByText("Kilómetros, hasta")).not.toHaveClass("sr-only");
    expect(screen.getByText("Año, desde")).not.toHaveClass("sr-only");
    expect(km).toHaveAttribute("placeholder", "100.000…");
    expect(year).toHaveAttribute("placeholder", "2017…");
    expect(km).toHaveAttribute("name", "maxKm");
    expect(year).toHaveAttribute("name", "minYear");
    expect(km).toHaveAttribute("autocomplete", "off");
    expect(year).toHaveAttribute("autocomplete", "off");
  });
});

describe("MAPUI-21: FilterPanel — phone Kilómetros y año apply without blur", () => {
  it("MAPUI-21: a typed maximum mileage reaches Ver coches without the box losing focus", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onChange={onChange} />, { locale: "es" });

    const km = screen.getByRole("textbox", { name: "Kilómetros, hasta" });
    fireEvent.change(km, { target: { value: "100000" } });
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxKm: 100000 }));
  });

  it("MAPUI-14: in the phone sheet, text the box cannot read applies nothing, even without the box losing focus", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} input={{ maxKm: 100000 }} onChange={onChange} />, {
      locale: "es",
    });

    const km = screen.getByRole("textbox", { name: "Kilómetros, hasta" });
    fireEvent.change(km, { target: { value: "abc" } });
    await userEvent.click(screen.getByRole("button", { name: "Ver coches" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].maxKm).toBe(100000);
  });

  it("MAPUI-21: a typed minimum year reaches Ver coches without the box losing focus", async () => {
    const onChange = vi.fn();
    renderWithI18n(<FilterPanel {...PHONE} onChange={onChange} />, { locale: "es" });

    const year = screen.getByRole("textbox", { name: "Año, desde" });
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

describe("MAPUI-14: FilterPanel — the controls it does not have", () => {
  it("MAPUI-14: no horsepower, free-text, minimum-mileage, maximum-year or sort control", () => {
    renderWithI18n(<FilterPanel {...DESKTOP} />, { locale: "es" });

    // The only amount boxes are the price boxes and the two of «Kilómetros y
    // año» (MAPUI-11, text boxes so they can show the thousands point): no
    // CV, no minimum mileage, no maximum year, and no other free-text field.
    expect(screen.getAllByRole("textbox").map((box) => box.getAttribute("name"))).toEqual([
      "minPrice",
      "maxPrice",
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
