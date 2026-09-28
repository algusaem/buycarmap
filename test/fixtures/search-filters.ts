import { vi } from "vitest";
import type { SearchFiltersProps } from "@/components/map/SearchFilters";

// Every filter cleared, every callback a spy. `SearchFiltersProps` has 15
// values and 16 handlers, so tests override only the two or three that the
// case is actually about.
export function makeFilterProps(overrides: Partial<SearchFiltersProps> = {}): SearchFiltersProps {
  return {
    engine: [],
    gearbox: [],
    brand: "",
    model: "",
    minPrice: undefined,
    maxPrice: undefined,
    minKm: undefined,
    maxKm: undefined,
    minYear: undefined,
    maxYear: undefined,
    minHorsePower: undefined,
    maxHorsePower: undefined,
    timeFilter: "",
    selectedLocation: undefined,
    // Matches INITIAL_FILTERS in useSearchFilters.
    distanceInKm: 50,
    onEngineChange: vi.fn(),
    onGearboxChange: vi.fn(),
    onBrandChange: vi.fn(),
    onModelChange: vi.fn(),
    onMinPriceChange: vi.fn(),
    onMaxPriceChange: vi.fn(),
    onMinKmChange: vi.fn(),
    onMaxKmChange: vi.fn(),
    onMinYearChange: vi.fn(),
    onMaxYearChange: vi.fn(),
    onMinHorsePowerChange: vi.fn(),
    onMaxHorsePowerChange: vi.fn(),
    onTimeFilterChange: vi.fn(),
    onLocationChange: vi.fn(),
    onDistanceChange: vi.fn(),
    onClearAll: vi.fn(),
    ...overrides,
  };
}
