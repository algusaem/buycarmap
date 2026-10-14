import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { clearCarModelsCache } from "@/lib/hooks/useCarModels";
import type { SearchPopover } from "@/lib/hooks/useSearchFilters";
import { renderWithI18n } from "@/test/utils/render";
import { CarPopover } from "./CarPopover";
import { LocationPopover } from "./LocationPopover";
import { PricePopover } from "./PricePopover";
import { SearchPill, type SearchPillProps } from "./SearchPill";

// The «Coche» popover's models come from the listCarModels Server Action,
// mocked at that boundary as in CarPopover.test.tsx.
vi.mock("@/server/search/actions", () => ({
  listCarModels: vi.fn(async () => ({ ok: true, value: [] })),
}));

beforeEach(() => {
  clearCarModelsCache();
});

// docs/specs/redesign-map.md (MAPUI-1, MAPUI-2, MAPUI-12). Pill segment
// values are the spec's worked example table verbatim (MAPUI-1); the
// "nothing chosen" row's placeholder text is explicitly drawn from
// "SearchPill's guide" per the table's own footnote, so it is asserted too.

const BASE: SearchPillProps = {
  place: null,
  radiusKm: 50,
  brand: "",
  model: "",
  minPrice: undefined,
  maxPrice: undefined,
  openSegment: null,
  onOpenSegment: vi.fn(),
  onCloseSegment: vi.fn(),
  onSearch: vi.fn(),
};

describe("MAPUI-1: SearchPill segment values — the worked example table", () => {
  it("MAPUI-1: nothing chosen shows the muted placeholder, Cualquier marca and Cualquiera", () => {
    renderWithI18n(<SearchPill {...BASE} />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Ciudad o código postal…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cualquier marca" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cualquiera" })).toBeInTheDocument();
  });

  it("MAPUI-1: Madrid at 50 km shows Madrid · 50 km in the Dónde segment", () => {
    renderWithI18n(
      <SearchPill
        {...BASE}
        place={{ placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 }}
        radiusKm={50}
      />,
      { locale: "es" },
    );

    expect(screen.getByRole("button", { name: "Madrid · 50 km" })).toBeInTheDocument();
  });

  it("MAPUI-1: brand Toyota shows Toyota in the Coche segment", () => {
    renderWithI18n(<SearchPill {...BASE} brand="Toyota" />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Toyota" })).toBeInTheDocument();
  });

  it("MAPUI-1: Toyota Corolla shows Toyota Corolla in the Coche segment", () => {
    renderWithI18n(<SearchPill {...BASE} brand="Toyota" model="Corolla" />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Toyota Corolla" })).toBeInTheDocument();
  });

  it("MAPUI-1: a maximum of 20.000 shows Hasta 20.000 € in the Precio segment", () => {
    renderWithI18n(<SearchPill {...BASE} maxPrice={20000} />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Hasta 20.000\u00a0€" })).toBeInTheDocument();
  });

  it("MAPUI-1: a minimum of 3.000 with no maximum shows Desde 3.000 €", () => {
    renderWithI18n(<SearchPill {...BASE} minPrice={3000} />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Desde 3.000\u00a0€" })).toBeInTheDocument();
  });

  it("MAPUI-1: a minimum of 3.000 and a maximum of 20.000 show the range 3.000 – 20.000 €", () => {
    renderWithI18n(<SearchPill {...BASE} minPrice={3000} maxPrice={20000} />, { locale: "es" });

    expect(screen.getByRole("button", { name: "3.000 – 20.000\u00a0€" })).toBeInTheDocument();
  });

  it('MAPUI-1: "Crear alerta" follows the pill', () => {
    renderWithI18n(<SearchPill {...BASE} />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Crear alerta" })).toBeInTheDocument();
  });
});

describe("MAPUI-2: SearchPill popovers — at most one open", () => {
  it("MAPUI-2: pressing the Dónde segment opens it and reports aria-expanded true", async () => {
    const onOpenSegment = vi.fn();
    renderWithI18n(<SearchPill {...BASE} onOpenSegment={onOpenSegment} />, { locale: "es" });

    await userEvent.click(screen.getByRole("button", { name: "Ciudad o código postal…" }));

    expect(onOpenSegment).toHaveBeenCalledWith("where");
  });

  it("MAPUI-2: with Dónde open, its segment reports aria-expanded true and the others false", () => {
    renderWithI18n(<SearchPill {...BASE} openSegment="where" />, { locale: "es" });

    expect(screen.getByRole("button", { name: "Ciudad o código postal…" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Cualquier marca" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Cualquiera" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  // Where the focus goes back to is covered with the real popovers below
  // («Escape pressed inside the open popover … puts the focus back on its segment»).
  it("MAPUI-2: Escape closes the open popover", async () => {
    const onCloseSegment = vi.fn();
    renderWithI18n(<SearchPill {...BASE} openSegment="car" onCloseSegment={onCloseSegment} />, {
      locale: "es",
    });

    screen.getByRole("button", { name: "Cualquier marca" }).focus();
    await userEvent.keyboard("{Escape}");

    expect(onCloseSegment).toHaveBeenCalled();
  });
});

describe("MAPUI-12: SearchPill Buscar — closes the open popover and re-searches at once", () => {
  it("MAPUI-12: pressing Buscar calls onSearch and closes any open popover", async () => {
    const onSearch = vi.fn();
    const onCloseSegment = vi.fn();
    renderWithI18n(
      <SearchPill
        {...BASE}
        openSegment="price"
        onSearch={onSearch}
        onCloseSegment={onCloseSegment}
      />,
      { locale: "es" },
    );

    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onCloseSegment).toHaveBeenCalledTimes(1);
  });
});

describe("MAPUI-2: SearchPill — a closed popover leaves the tree", () => {
  // The caller's single `openSegment`, held the way HeaderSearch holds it.
  function Harness() {
    const [openSegment, setOpenSegment] = useState<SearchPopover | null>("where");
    return (
      <SearchPill
        {...BASE}
        openSegment={openSegment}
        onOpenSegment={setOpenSegment}
        onCloseSegment={() => setOpenSegment(null)}
        popovers={{
          where: (
            <input role="combobox" aria-label="Ciudad o código postal" aria-expanded={false} />
          ),
          car: <input role="combobox" aria-label="Marca o modelo" aria-expanded={false} />,
        }}
      />
    );
  }

  it("MAPUI-2: after Escape on Dónde its combobox is gone, and opening Coche exposes only Coche's", async () => {
    renderWithI18n(<Harness />, { locale: "es" });
    expect(screen.getByRole("combobox", { name: "Ciudad o código postal" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "Cualquier marca" }));

    await waitFor(() =>
      expect(screen.getAllByRole("combobox").map((box) => box.getAttribute("aria-label"))).toEqual([
        "Marca o modelo",
      ]),
    );
  });
});

describe("MAPUI-2: SearchPill — closing with the real popovers", () => {
  // The pill with the three real popover bodies, the open segment held the
  // way HeaderSearch holds it.
  function Harness({ initial = null }: { initial?: SearchPopover | null }) {
    const [openSegment, setOpenSegment] = useState<SearchPopover | null>(initial);
    const close = () => setOpenSegment(null);
    return (
      <SearchPill
        {...BASE}
        openSegment={openSegment}
        onOpenSegment={setOpenSegment}
        onCloseSegment={close}
        popovers={{
          where: (
            <LocationPopover
              value={null}
              radiusKm={50}
              onSelect={vi.fn()}
              onClear={vi.fn()}
              onRadiusChange={vi.fn()}
            />
          ),
          car: (
            <CarPopover
              brand=""
              model=""
              onSelectBrand={vi.fn()}
              onSelectModel={vi.fn()}
              onClear={vi.fn()}
              onClose={close}
            />
          ),
          price: <PricePopover onApply={vi.fn()} />,
        }}
      />
    );
  }

  it("MAPUI-2: a press outside «Dónde» closes it", async () => {
    renderWithI18n(<Harness initial="where" />, { locale: "es" });
    expect(screen.getByRole("dialog", { name: "Dónde" })).toBeInTheDocument();

    await userEvent.click(document.body);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Ciudad o código postal…" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("MAPUI-2: Escape pressed inside the open popover closes it and puts the focus back on its segment", async () => {
    renderWithI18n(<Harness />, { locale: "es" });
    const segment = screen.getByRole("button", { name: "Cualquier marca" });

    await userEvent.click(segment);
    const field = await screen.findByRole("combobox", { name: "Marca o modelo" });
    field.focus();
    expect(field).toHaveFocus();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(segment).toHaveFocus());
  });

  it("MAPUI-2: Escape with the list open closes only the list; the popover stays with its text, and a second Escape closes it", async () => {
    renderWithI18n(<Harness initial="car" />, { locale: "es" });
    const field = screen.getByRole("combobox", { name: "Marca o modelo" });

    await userEvent.type(field, "Toy");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Coche" })).toBeInTheDocument();
    expect(field).toHaveValue("Toy");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("SearchPill accessibility — the open popovers", () => {
  function OpenPill({ segment }: { segment: SearchPopover }) {
    return (
      <SearchPill
        {...BASE}
        openSegment={segment}
        popovers={{
          where: (
            <LocationPopover
              value={{ placeId: 1, displayName: "Madrid", lat: 40.4168, lng: -3.7038 }}
              radiusKm={50}
              onSelect={vi.fn()}
              onClear={vi.fn()}
              onRadiusChange={vi.fn()}
            />
          ),
          car: (
            <CarPopover
              brand="Toyota"
              model=""
              onSelectBrand={vi.fn()}
              onSelectModel={vi.fn()}
              onClear={vi.fn()}
              onClose={vi.fn()}
            />
          ),
          price: <PricePopover maxPrice={20000} onApply={vi.fn()} />,
        }}
      />
    );
  }

  it.each<[SearchPopover, string]>([
    ["where", "Dónde"],
    ["car", "Coche"],
    ["price", "Precio"],
  ])("MAPUI-2: the open «%s» popover has no accessibility violations", async (segment, name) => {
    renderWithI18n(<OpenPill segment={segment} />, { locale: "es" });
    const popover = screen.getByRole("dialog", { name });
    expect(within(popover).getAllByRole("button").length).toBeGreaterThan(0);

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
