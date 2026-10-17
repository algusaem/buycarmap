import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { clearCarModelsCache } from "@/lib/hooks/useCarModels";
import { withAnimations } from "@/test/utils/animations";
import { renderWithI18n } from "@/test/utils/render";
import { CarPopover, type CarPopoverProps } from "./CarPopover";

// docs/specs/redesign-map.md (MAPUI-6 to MAPUI-10, worked example under
// "Coche type-ahead"). listCarModels is a Server Action
// (server/search/actions.ts); mocked at that boundary, the same pattern
// lib/hooks/useCarModels.test.tsx uses, rather than faking a network request.
vi.mock("@/server/search/actions", () => ({
  listCarModels: vi.fn(async () => ({ ok: true, value: [] })),
}));
import { listCarModels } from "@/server/search/actions";

// Call history and queued answers of the listCarModels mock are per test, and
// so is the session's model cache (lib/hooks/useCarModels.ts).
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listCarModels).mockImplementation(async () => ({ ok: true, value: [] }));
  clearCarModelsCache();
});

const BASE: CarPopoverProps = {
  brand: "",
  model: "",
  onSelectBrand: vi.fn(),
  onSelectModel: vi.fn(),
  onClear: vi.fn(),
  onClose: vi.fn(),
};

describe("MAPUI-6: CarPopover — Marcas and Modelos", () => {
  it('MAPUI-6: typing "Toy" lists Toyota under Marcas', async () => {
    renderWithI18n(<CarPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Toy");

    const marcas = within(screen.getByRole("group", { name: "Marcas" }));
    expect(marcas.getByRole("option", { name: "Toyota" })).toBeInTheDocument();
  });

  it('MAPUI-6: with Corolla, Yaris and C-HR, "Toy" lists all three under Modelos as "Toyota <modelo>"', async () => {
    vi.mocked(listCarModels).mockResolvedValueOnce({
      ok: true,
      value: [
        { id: "Corolla", label: "Corolla" },
        { id: "Yaris", label: "Yaris" },
        { id: "C-HR", label: "C-HR" },
      ],
    });
    renderWithI18n(<CarPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Toy");

    const modelos = within(await screen.findByRole("group", { name: "Modelos" }));
    expect(modelos.getByRole("option", { name: "Toyota Corolla" })).toBeInTheDocument();
    expect(modelos.getByRole("option", { name: "Toyota Yaris" })).toBeInTheDocument();
    expect(modelos.getByRole("option", { name: "Toyota C-HR" })).toBeInTheDocument();
  });

  it("MAPUI-6: a model returned by two sources is listed once (no duplicates)", async () => {
    vi.mocked(listCarModels).mockResolvedValueOnce({
      ok: true,
      value: [
        { id: "Corolla", label: "Corolla" },
        { id: "corolla-2", label: "Corolla" },
      ],
    });
    renderWithI18n(<CarPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Toy");

    const modelos = within(await screen.findByRole("group", { name: "Modelos" }));
    expect(modelos.getAllByRole("option", { name: "Toyota Corolla" })).toHaveLength(1);
  });

  it("MAPUI-6 edge case: more than three matching brands lists brands only, with no Modelos group", async () => {
    renderWithI18n(<CarPopover {...BASE} />, { locale: "es" });

    // "s" starts five of BRANDS (components/map/search-filter-options.ts):
    // Seat, Skoda, Smart, Subaru and Suzuki — no other brand has a word
    // starting with it.
    await userEvent.type(screen.getByRole("combobox"), "s");

    const marcas = within(screen.getByRole("group", { name: "Marcas" }));
    expect(marcas.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Seat",
      "Skoda",
      "Smart",
      "Subaru",
      "Suzuki",
    ]);
    expect(listCarModels).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Modelos" })).not.toBeInTheDocument();
  });
});

describe("MAPUI-7: CarPopover — choosing a brand", () => {
  it("MAPUI-7: choosing Toyota applies it, clears the model, and shows a removable chip", async () => {
    const onSelectBrand = vi.fn();
    renderWithI18n(<CarPopover {...BASE} onSelectBrand={onSelectBrand} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Toy");
    await userEvent.click(screen.getByRole("option", { name: "Toyota" }));

    expect(onSelectBrand).toHaveBeenCalledWith("Toyota");
    expect(screen.getByRole("button", { name: "Quitar Toyota" })).toBeInTheDocument();
  });

  it('MAPUI-7: with Toyota chosen, the field reads "Modelo de Toyota…" and lists only Toyota\'s models', async () => {
    vi.mocked(listCarModels).mockResolvedValueOnce({
      ok: true,
      value: [{ id: "Corolla", label: "Corolla" }],
    });
    renderWithI18n(<CarPopover {...BASE} brand="Toyota" />, { locale: "es" });

    expect(await screen.findByPlaceholderText("Modelo de Toyota…")).toBeInTheDocument();
    const listbox = await screen.findByRole("listbox", { name: "Modelos" });
    await waitFor(() =>
      expect(
        within(listbox)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Corolla"]),
    );
    expect(listCarModels).toHaveBeenCalledWith("Toyota");
  });

  it("MAPUI-7: after choosing Toyota, the list holds exactly Toyota's models", async () => {
    vi.mocked(listCarModels).mockImplementation(async (make: string) => ({
      ok: true,
      value:
        make === "Toyota"
          ? [
              { id: "Corolla", label: "Corolla" },
              { id: "Yaris", label: "Yaris" },
              { id: "C-HR", label: "C-HR" },
            ]
          : [{ id: "Golf", label: "Golf" }],
    }));
    renderWithI18n(<CarPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Toy");
    await userEvent.click(screen.getByRole("option", { name: "Toyota" }));

    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Modelo de Toyota…");
    const listbox = await screen.findByRole("listbox", { name: "Modelos" });
    await waitFor(() =>
      expect(
        within(listbox)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Corolla", "Yaris", "C-HR"]),
    );
  });

  it("MAPUI-7: the popover stays open after choosing a brand", async () => {
    const onClose = vi.fn();
    renderWithI18n(<CarPopover {...BASE} onClose={onClose} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Toy");
    await userEvent.click(screen.getByRole("option", { name: "Toyota" }));

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("MAPUI-8: CarPopover — choosing a model", () => {
  it("MAPUI-8: choosing Corolla applies brand and model and closes the popover", async () => {
    const onSelectModel = vi.fn();
    const onClose = vi.fn();
    vi.mocked(listCarModels).mockResolvedValueOnce({
      ok: true,
      value: [{ id: "Corolla", label: "Corolla" }],
    });
    renderWithI18n(
      <CarPopover {...BASE} brand="Toyota" onSelectModel={onSelectModel} onClose={onClose} />,
      { locale: "es" },
    );

    await userEvent.click(await screen.findByRole("option", { name: "Corolla" }));

    expect(onSelectModel).toHaveBeenCalledWith("Corolla");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-8: with no brand, typing «Toy» and choosing «Toyota Corolla» from Modelos applies Toyota and Corolla and closes", async () => {
    const onSelectBrand = vi.fn();
    const onSelectModel = vi.fn();
    const onClose = vi.fn();
    vi.mocked(listCarModels).mockResolvedValueOnce({
      ok: true,
      value: [
        { id: "Corolla", label: "Corolla" },
        { id: "Yaris", label: "Yaris" },
      ],
    });
    renderWithI18n(
      <CarPopover
        {...BASE}
        onSelectBrand={onSelectBrand}
        onSelectModel={onSelectModel}
        onClose={onClose}
      />,
      { locale: "es" },
    );

    await userEvent.type(screen.getByRole("combobox"), "Toy");
    const modelos = within(await screen.findByRole("group", { name: "Modelos" }));
    await userEvent.click(modelos.getByRole("option", { name: "Toyota Corolla" }));

    expect(onSelectBrand).toHaveBeenCalledTimes(1);
    expect(onSelectBrand).toHaveBeenCalledWith("Toyota");
    expect(onSelectModel).toHaveBeenCalledTimes(1);
    expect(onSelectModel).toHaveBeenCalledWith("Corolla");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-8 edge case: reopening with a model chosen shows the brand step and marks that model", () => {
    renderWithI18n(<CarPopover {...BASE} brand="Toyota" model="Corolla" />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Quitar Toyota" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Corolla", selected: true })).toBeInTheDocument();
  });
});

describe("MAPUI-9: CarPopover — clearing the brand", () => {
  it("MAPUI-9: removing the brand chip clears both the brand and the model", async () => {
    const onClear = vi.fn();
    renderWithI18n(<CarPopover {...BASE} brand="Toyota" model="Corolla" onClear={onClear} />, {
      locale: "es",
    });

    await userEvent.click(screen.getByRole("button", { name: "Quitar Toyota" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("MAPUI-9: pressing Cualquier marca clears both the brand and the model", async () => {
    const onClear = vi.fn();
    renderWithI18n(<CarPopover {...BASE} brand="Toyota" model="Corolla" onClear={onClear} />, {
      locale: "es",
    });

    await userEvent.click(screen.getByRole("button", { name: "Cualquier marca" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("MAPUI-10: CarPopover — a failed model request", () => {
  it("MAPUI-10: still lists the matching brands, offers no Modelos group, and shows no error", async () => {
    vi.mocked(listCarModels).mockRejectedValueOnce(new Error("network down"));
    renderWithI18n(<CarPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Toy");

    expect(await screen.findByRole("option", { name: "Toyota" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Modelos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("MAPUI-56: CarPopover — text no brand matches", () => {
  it("MAPUI-56: «Pegaso» shows «No existe ninguna marca con ese nombre» in the polite status, with no listbox", async () => {
    renderWithI18n(<CarPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Pegaso");

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status.textContent).toBe("No existe ninguna marca con ese nombre");
    // Once in the status, once in the list's place (aria-hidden there).
    const lines = screen.getAllByText("No existe ninguna marca con ese nombre");
    expect(lines).toHaveLength(2);
    expect(lines.some((line) => line.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
  });

  it("MAPUI-56: the status is mounted before any typing, and stays the same node", async () => {
    renderWithI18n(<CarPopover {...BASE} />, { locale: "es" });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    await userEvent.type(screen.getByRole("combobox"), "Pegaso");

    expect(screen.getByRole("status")).toBe(status);
  });
});

describe("MAPUI-2: CarPopover — the list fading out", () => {
  it("MAPUI-2: after Escape, the fading options are not a listbox and a press chooses nothing", async () => {
    await withAnimations(async () => {
      const onSelectBrand = vi.fn();
      renderWithI18n(<CarPopover {...BASE} onSelectBrand={onSelectBrand} />, { locale: "es" });

      await userEvent.type(screen.getByRole("combobox"), "Toy");
      const option = await screen.findByRole("option", { name: "Toyota" });
      // An exit from opacity 0 is instant in Motion: let the enter animation
      // start, so the exit has something to fade.
      await waitFor(() =>
        expect(Number(screen.getByRole("listbox").style.opacity)).toBeGreaterThan(0),
      );

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).toBeNull();
      // `option` still points at the fading node: same element, mid-exit.
      expect(option).toBeInTheDocument();
      expect(option).not.toHaveAttribute("role");
      fireEvent.mouseDown(option);
      fireEvent.click(option);

      expect(onSelectBrand).not.toHaveBeenCalled();
    });
  });
});

describe("CarPopover accessibility", () => {
  it("MAPUI-6: the open list has no accessibility violations", async () => {
    const { container } = renderWithI18n(<CarPopover {...BASE} />, { locale: "es" });

    await userEvent.type(screen.getByRole("combobox"), "Toy");
    await screen.findByRole("option", { name: "Toyota" });

    expect(await axe(container)).toHaveNoViolations();
  });
});
