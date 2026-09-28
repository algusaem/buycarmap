import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { makeFilterProps } from "@/test/fixtures/search-filters";
import { SearchFilters } from "./SearchFilters";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Radix Select drives its trigger from pointer events, which jsdom reports as
// absent. Skipping the check is the documented workaround.
const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

// Range placeholders pair a word with a unit across a non-breaking space, so
// they are matched by pattern rather than by a literal string.
const MIN_PRICE = /^Min\s€$/;
const MAX_KM = /^Max\skm$/;
const MIN_YEAR = /^From$/;
const MAX_HP = /^Max\sHP$/;

const chip = (name: string) => screen.getByRole("button", { name });
const combobox = (name: RegExp) => screen.getByRole("combobox", { name });

describe("SearchFilters fuel and transmission", () => {
  it("adds a fuel value to the existing selection", async () => {
    const props = makeFilterProps({ engine: ["gasoil"] });
    renderWithI18n(<SearchFilters {...props} />);

    await setup().click(chip("Gasoline"));

    expect(props.onEngineChange).toHaveBeenCalledWith(["gasoil", "gasoline"]);
  });

  it("removes a fuel value that is already selected", async () => {
    const props = makeFilterProps({ engine: ["gasoil", "gasoline"] });
    renderWithI18n(<SearchFilters {...props} />);

    expect(chip("Diesel")).toHaveAttribute("aria-pressed", "true");

    await setup().click(chip("Diesel"));

    expect(props.onEngineChange).toHaveBeenCalledWith(["gasoline"]);
  });

  it("toggles transmission independently of fuel", async () => {
    const props = makeFilterProps({ engine: ["gasoil"] });
    renderWithI18n(<SearchFilters {...props} />);

    await setup().click(chip("Automatic"));

    expect(props.onGearboxChange).toHaveBeenCalledWith(["automatic"]);
    expect(props.onEngineChange).not.toHaveBeenCalled();
  });
});

describe("SearchFilters time filter", () => {
  it("selects a period", async () => {
    const props = makeFilterProps();
    renderWithI18n(<SearchFilters {...props} />);

    await setup().click(chip("Last week"));

    expect(props.onTimeFilterChange).toHaveBeenCalledWith("lastWeek");
  });

  it("clears the period when the active one is clicked again", async () => {
    const props = makeFilterProps({ timeFilter: "lastWeek" });
    renderWithI18n(<SearchFilters {...props} />);

    await setup().click(chip("Last week"));

    expect(props.onTimeFilterChange).toHaveBeenCalledWith("");
  });

  it("switches directly between periods", async () => {
    const props = makeFilterProps({ timeFilter: "lastWeek" });
    renderWithI18n(<SearchFilters {...props} />);

    await setup().click(chip("Today"));

    expect(props.onTimeFilterChange).toHaveBeenCalledWith("today");
  });
});

describe("SearchFilters brand and model", () => {
  it("reports a chosen brand", async () => {
    const user = setup();
    const props = makeFilterProps();
    renderWithI18n(<SearchFilters {...props} />);

    await user.click(combobox(/Brand/));
    await user.click(await screen.findByRole("option", { name: "Audi" }));

    expect(props.onBrandChange).toHaveBeenCalledWith("Audi");
  });

  it("translates the 'Any' sentinel back to an empty brand", async () => {
    const user = setup();
    const props = makeFilterProps({ brand: "Audi" });
    renderWithI18n(<SearchFilters {...props} />);

    await user.click(combobox(/Brand/));
    await user.click(await screen.findByRole("option", { name: "Any" }));

    expect(props.onBrandChange).toHaveBeenCalledWith("");
  });

  it("hides the model selector until a brand is chosen", () => {
    renderWithI18n(<SearchFilters {...makeFilterProps()} />);

    expect(screen.queryByRole("combobox", { name: /Model/ })).not.toBeInTheDocument();
  });

  it("offers the models fetched for the selected brand", async () => {
    const user = setup();
    const props = makeFilterProps({ brand: "Audi" });
    renderWithI18n(<SearchFilters {...props} />);

    // Disabled until useCarModels resolves; the handler returns one model, A3.
    const trigger = combobox(/Model/);
    await vi.waitFor(() => expect(trigger).toBeEnabled());

    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "A3" }));

    expect(props.onModelChange).toHaveBeenCalledWith("A3");
  });
});

describe("SearchFilters ranges and reset", () => {
  // RangeInput's own parsing is covered in components/ui/range-input.test.tsx.
  // What matters here is that each range reaches its own handler: four
  // near-identical RangeInputs are easy to cross-wire.
  it("routes each range to its own handler", async () => {
    const user = setup();
    const props = makeFilterProps();
    renderWithI18n(<SearchFilters {...props} />);

    await user.type(screen.getByPlaceholderText(MIN_PRICE), "5");
    await user.type(screen.getByPlaceholderText(MAX_KM), "9");
    await user.type(screen.getByPlaceholderText(MIN_YEAR), "2");
    await user.type(screen.getByPlaceholderText(MAX_HP), "3");

    expect(props.onMinPriceChange).toHaveBeenCalledWith(5);
    expect(props.onMaxKmChange).toHaveBeenCalledWith(9);
    expect(props.onMinYearChange).toHaveBeenCalledWith(2);
    expect(props.onMaxHorsePowerChange).toHaveBeenCalledWith(3);
    expect(props.onMaxPriceChange).not.toHaveBeenCalled();
    expect(props.onMinKmChange).not.toHaveBeenCalled();
  });

  it("reports an emptied range as undefined, not zero", async () => {
    const props = makeFilterProps({ minPrice: 5000 });
    renderWithI18n(<SearchFilters {...props} />);

    await setup().clear(screen.getByPlaceholderText(MIN_PRICE));

    expect(props.onMinPriceChange).toHaveBeenCalledWith(undefined);
  });

  it("hides the reset control when nothing is filtered", () => {
    renderWithI18n(<SearchFilters {...makeFilterProps()} />);

    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("resets everything once a filter is active", async () => {
    const props = makeFilterProps({ minYear: 2015 });
    renderWithI18n(<SearchFilters {...props} />);

    await setup().click(chip("Clear filters"));

    expect(props.onClearAll).toHaveBeenCalledTimes(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderWithI18n(
      <SearchFilters {...makeFilterProps({ brand: "Audi", engine: ["gasoil"] })} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
