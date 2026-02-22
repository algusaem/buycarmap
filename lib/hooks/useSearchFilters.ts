import { useCallback, useEffect, useRef, useState } from "react";
import { SearchInput } from "@/lib/validations/search";
import { SelectedLocation } from "@/interfaces/location";
import {
  initUserGeolocation,
  waitForGeolocation,
} from "@/lib/geo/user-location";

type TimeFilter = "" | "today" | "lastWeek" | "lastMonth";

interface FilterValues {
  engine: string[];
  gearbox: string[];
  brand: string;
  model: string;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  minKm: number | undefined;
  maxKm: number | undefined;
  minYear: number | undefined;
  maxYear: number | undefined;
  minHorsePower: number | undefined;
  maxHorsePower: number | undefined;
  timeFilter: TimeFilter;
  selectedLocation: SelectedLocation | undefined;
  distanceInKm: number;
}

const INITIAL_FILTERS: FilterValues = {
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
  distanceInKm: 50,
};

function toParams(keywords: string, f: FilterValues): SearchInput {
  return {
    keywords,
    engine: f.engine.length > 0 ? f.engine : undefined,
    gearbox: f.gearbox.length > 0 ? f.gearbox : undefined,
    brand: f.brand || undefined,
    model: f.model || undefined,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    minKm: f.minKm,
    maxKm: f.maxKm,
    minYear: f.minYear,
    maxYear: f.maxYear,
    minHorsePower: f.minHorsePower,
    maxHorsePower: f.maxHorsePower,
    timeFilter: f.timeFilter || undefined,
    latitude: f.selectedLocation?.lat,
    longitude: f.selectedLocation?.lng,
    distanceInKm: f.selectedLocation ? f.distanceInKm : undefined,
  };
}

function countActive(f: FilterValues): number {
  return (
    f.engine.length +
    f.gearbox.length +
    (f.brand ? 1 : 0) +
    (f.model ? 1 : 0) +
    (f.minPrice !== undefined ? 1 : 0) +
    (f.maxPrice !== undefined ? 1 : 0) +
    (f.minKm !== undefined ? 1 : 0) +
    (f.maxKm !== undefined ? 1 : 0) +
    (f.minYear !== undefined ? 1 : 0) +
    (f.maxYear !== undefined ? 1 : 0) +
    (f.minHorsePower !== undefined ? 1 : 0) +
    (f.maxHorsePower !== undefined ? 1 : 0) +
    (f.timeFilter ? 1 : 0) +
    (f.selectedLocation !== undefined ? 1 : 0)
  );
}

const DEBOUNCE_MS = 400;

export function useSearchFilters(
  search: (params: SearchInput) => void,
  getKeywords: () => string,
) {
  const [filters, setFilters] = useState<FilterValues>(INITIAL_FILTERS);
  const [isOpen, setIsOpen] = useState(false);
  const filtersRef = useRef<FilterValues>(INITIAL_FILTERS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activeCount = countActive(filters);

  useEffect(() => {
    let cancelled = false;
    // Fire an immediate search (uses Spain-center fallback if geolocation
    // hasn't resolved yet), then re-search once geolocation finishes so
    // results are centered on the user's actual location.
    search(toParams("", INITIAL_FILTERS));
    initUserGeolocation();
    waitForGeolocation().then(() => {
      if (cancelled) return;
      // Only re-search if the user hasn't already picked an explicit location.
      if (!filtersRef.current.selectedLocation) {
        search(toParams("", filtersRef.current));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const update = useCallback(
    (patch: Partial<FilterValues>) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch };
        filtersRef.current = next;
        return next;
      });
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        search(toParams(getKeywords(), filtersRef.current));
      }, DEBOUNCE_MS);
    },
    [search, getKeywords],
  );

  const triggerSearch = useCallback(() => {
    clearTimeout(debounceRef.current);
    search(toParams(getKeywords(), filtersRef.current));
  }, [search, getKeywords]);

  const clearAll = useCallback(() => {
    clearTimeout(debounceRef.current);
    filtersRef.current = INITIAL_FILTERS;
    setFilters(INITIAL_FILTERS);
    search({ keywords: getKeywords() });
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
    (brand: string) => update({ brand, model: "" }),
    [update],
  );
  const setModel = useCallback(
    (model: string) => update({ model }),
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
  const setLocation = useCallback(
    (selectedLocation: SelectedLocation | undefined) =>
      update({ selectedLocation }),
    [update],
  );
  const setDistanceInKm = useCallback(
    (distanceInKm: number) => update({ distanceInKm }),
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
    setModel,
    setMinPrice,
    setMaxPrice,
    setMinKm,
    setMaxKm,
    setMinYear,
    setMaxYear,
    setMinHorsePower,
    setMaxHorsePower,
    setTimeFilter,
    setLocation,
    setDistanceInKm,
    clearAll,
  };
}
