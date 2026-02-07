import { useCallback, useRef, useState } from "react";
import { SearchInput } from "@/lib/validations/search";

type TimeFilter = "" | "today" | "lastWeek" | "lastMonth";

interface FilterValues {
  engine: string[];
  gearbox: string[];
  brand: string;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  minKm: number | undefined;
  maxKm: number | undefined;
  minYear: number | undefined;
  maxYear: number | undefined;
  minHorsePower: number | undefined;
  maxHorsePower: number | undefined;
  timeFilter: TimeFilter;
}

const INITIAL_FILTERS: FilterValues = {
  engine: [],
  gearbox: [],
  brand: "",
  minPrice: undefined,
  maxPrice: undefined,
  minKm: undefined,
  maxKm: undefined,
  minYear: undefined,
  maxYear: undefined,
  minHorsePower: undefined,
  maxHorsePower: undefined,
  timeFilter: "",
};

function toParams(keywords: string, f: FilterValues): SearchInput {
  return {
    keywords,
    engine: f.engine.length > 0 ? f.engine : undefined,
    gearbox: f.gearbox.length > 0 ? f.gearbox : undefined,
    brand: f.brand || undefined,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    minKm: f.minKm,
    maxKm: f.maxKm,
    minYear: f.minYear,
    maxYear: f.maxYear,
    minHorsePower: f.minHorsePower,
    maxHorsePower: f.maxHorsePower,
    timeFilter: f.timeFilter || undefined,
  };
}

function countActive(f: FilterValues): number {
  return (
    f.engine.length +
    f.gearbox.length +
    (f.brand ? 1 : 0) +
    (f.minPrice !== undefined ? 1 : 0) +
    (f.maxPrice !== undefined ? 1 : 0) +
    (f.minKm !== undefined ? 1 : 0) +
    (f.maxKm !== undefined ? 1 : 0) +
    (f.minYear !== undefined ? 1 : 0) +
    (f.maxYear !== undefined ? 1 : 0) +
    (f.minHorsePower !== undefined ? 1 : 0) +
    (f.maxHorsePower !== undefined ? 1 : 0) +
    (f.timeFilter ? 1 : 0)
  );
}

export function useSearchFilters(
  search: (params: SearchInput) => void,
  getKeywords: () => string,
) {
  const [filters, setFilters] = useState<FilterValues>(INITIAL_FILTERS);
  const [isOpen, setIsOpen] = useState(false);
  const hasSearchedRef = useRef(false);

  const activeCount = countActive(filters);

  const update = useCallback(
    (patch: Partial<FilterValues>) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch };
        if (hasSearchedRef.current) {
          search(toParams(getKeywords(), next));
        }
        return next;
      });
    },
    [search, getKeywords],
  );

  const triggerSearch = useCallback(() => {
    hasSearchedRef.current = true;
    setFilters((prev) => {
      search(toParams(getKeywords(), prev));
      return prev;
    });
  }, [search, getKeywords]);

  const clearAll = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    if (hasSearchedRef.current) {
      search({ keywords: getKeywords() });
    }
  }, [search, getKeywords]);

  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const setEngine = useCallback(
    (engine: string[]) => update({ engine }),
    [update],
  );
  const setGearbox = useCallback(
    (gearbox: string[]) => update({ gearbox }),
    [update],
  );
  const setBrand = useCallback(
    (brand: string) => update({ brand }),
    [update],
  );
  const setMinPrice = useCallback(
    (minPrice: number | undefined) => update({ minPrice }),
    [update],
  );
  const setMaxPrice = useCallback(
    (maxPrice: number | undefined) => update({ maxPrice }),
    [update],
  );
  const setMinKm = useCallback(
    (minKm: number | undefined) => update({ minKm }),
    [update],
  );
  const setMaxKm = useCallback(
    (maxKm: number | undefined) => update({ maxKm }),
    [update],
  );
  const setMinYear = useCallback(
    (minYear: number | undefined) => update({ minYear }),
    [update],
  );
  const setMaxYear = useCallback(
    (maxYear: number | undefined) => update({ maxYear }),
    [update],
  );
  const setMinHorsePower = useCallback(
    (minHorsePower: number | undefined) => update({ minHorsePower }),
    [update],
  );
  const setMaxHorsePower = useCallback(
    (maxHorsePower: number | undefined) => update({ maxHorsePower }),
    [update],
  );
  const setTimeFilter = useCallback(
    (timeFilter: TimeFilter) => update({ timeFilter }),
    [update],
  );

  return {
    ...filters,
    isOpen,
    activeCount,
    toggle,
    triggerSearch,
    setEngine,
    setGearbox,
    setBrand,
    setMinPrice,
    setMaxPrice,
    setMinKm,
    setMaxKm,
    setMinYear,
    setMaxYear,
    setMinHorsePower,
    setMaxHorsePower,
    setTimeFilter,
    clearAll,
  };
}
