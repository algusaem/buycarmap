import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/test/utils/render";
import { makeFilterProps } from "@/test/fixtures/search-filters";
import { ListingsHeader } from "./ListingsHeader";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

type HeaderProps = React.ComponentProps<typeof ListingsHeader>;

function renderHeader(overrides: Partial<HeaderProps> = {}) {
  const props: HeaderProps = {
    searchQuery: "",
    onSearchChange: vi.fn(),
    onSearch: vi.fn(),
    onShowMap: vi.fn(),
    isLoading: false,
    filtersOpen: false,
    onToggleFilters: vi.fn(),
    activeFilterCount: 0,
    filterProps: makeFilterProps(),
    ...overrides,
  };
  return { props, ...renderWithI18n(<ListingsHeader {...props} />) };
}

const queryInput = () => screen.getByRole("textbox");
const searchButton = () => screen.getByRole("button", { name: "Search" });
const filtersButton = () => screen.getByRole("button", { name: "Filters" });

describe("ListingsHeader", () => {
  it("displays the current query and reports edits upward", async () => {
    const { props } = renderHeader({ searchQuery: "golf" });

    expect(queryInput()).toHaveValue("golf");

    await userEvent.type(queryInput(), "!");

    expect(props.onSearchChange).toHaveBeenCalledWith("golf!");
  });

  it("searches on Enter", async () => {
    const { props } = renderHeader({ searchQuery: "golf" });

    await userEvent.type(queryInput(), "{Enter}");

    expect(props.onSearch).toHaveBeenCalledTimes(1);
  });

  it("leaves other keys alone", async () => {
    const { props } = renderHeader({ searchQuery: "golf" });

    await userEvent.type(queryInput(), "{Escape}a");

    expect(props.onSearch).not.toHaveBeenCalled();
  });

  it("searches on button click", async () => {
    const { props } = renderHeader();

    await userEvent.click(searchButton());

    expect(props.onSearch).toHaveBeenCalledTimes(1);
  });

  it("blocks a second search while one is in flight", async () => {
    const { props } = renderHeader({ isLoading: true });

    expect(searchButton()).toBeDisabled();

    await userEvent.click(searchButton());

    expect(props.onSearch).not.toHaveBeenCalled();
  });

  it("toggles the filter panel and mirrors its state in aria-expanded", async () => {
    const { props, rerender } = renderHeader();

    expect(filtersButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Fuel type")).not.toBeInTheDocument();

    await userEvent.click(filtersButton());
    expect(props.onToggleFilters).toHaveBeenCalledTimes(1);

    // The parent owns the open state, so re-render with it flipped.
    rerender(<ListingsHeader {...props} filtersOpen />);

    expect(filtersButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Fuel type")).toBeInTheDocument();
  });

  it("badges the number of active filters, and shows nothing at zero", () => {
    const { unmount } = renderHeader({ activeFilterCount: 0 });
    expect(within(filtersButton()).queryByText("0")).not.toBeInTheDocument();
    unmount();

    renderHeader({ activeFilterCount: 3 });
    expect(within(filtersButton()).getByText("3")).toBeInTheDocument();
  });

  it("opens the mobile map", async () => {
    const { props } = renderHeader();

    await userEvent.click(screen.getByRole("button", { name: "Explore the map" }));

    expect(props.onShowMap).toHaveBeenCalledTimes(1);
  });

  it("links back to the home page", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });

  it("has no accessibility violations with the filter panel open", async () => {
    const { container } = renderHeader({ filtersOpen: true });

    expect(await axe(container)).toHaveNoViolations();
  });
});
