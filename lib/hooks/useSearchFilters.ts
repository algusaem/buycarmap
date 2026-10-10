import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useQueryStates } from "nuqs";
import { DEFAULT_RADIUS_KM, type SearchInput } from "@/lib/search/schema";
import type { SelectedLocation } from "@/interfaces/location";
import { initUserGeolocation, waitForGeolocation } from "@/lib/geo/user-location";
import {
  searchParsers,
  filtersToUrlState,
  urlStateToFilters,
  type UrlFilterValues,
} from "@/lib/search/url-state";

type TimeFilter = "" | "today" | "lastWeek" | "lastMonth";

type FilterValues = UrlFilterValues;

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
  distanceInKm: DEFAULT_RADIUS_KM,
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

export function useSearchFilters(search: (params: SearchInput) => void, getKeywords: () => string) {
  // FRONT-13 (docs/specs/core-frontend.md): the URL is the deep-linkable
  // record of the filters. It is only written at the same points this hook
  // already calls `search()` (the debounce firing, an explicit trigger, or
  // clearing) — not on every keystroke — so typing doesn't spam history and
  // Back/Forward move between meaningful searches, not individual keystrokes.
  const [urlState, setUrlState] = useQueryStates(searchParsers);
  const lastUrlSerializedRef = useRef(JSON.stringify(urlState));

  const [filters, setFilters] = useState<FilterValues>(() =>
    urlStateToFilters(urlState, INITIAL_FILTERS),
  );
  const [isOpen, setIsOpen] = useState(false);
  const filtersRef = useRef<FilterValues>(filters);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activeCount = countActive(filters);

  const commitUrl = useCallback(
    (next: FilterValues) => {
      const nextUrlState = filtersToUrlState(next);
      lastUrlSerializedRef.current = JSON.stringify({ ...urlState, ...nextUrlState });
      void setUrlState(nextUrlState, { history: "push" });
    },
    [setUrlState, urlState],
  );

  const runInitialSearch = useEffectEvent(async (isCancelled: () => boolean) => {
    // Fire an immediate search (uses Spain-center fallback if geolocation
    // hasn't resolved yet, or the deep-linked filters otherwise), then
    // re-search once geolocation finishes so results are centered on the
    // user's actual location.
    search(toParams(getKeywords(), filtersRef.current));
    initUserGeolocation();
    await waitForGeolocation();
    if (isCancelled()) return;
    // Only re-search if the user hasn't already picked an explicit location.
    if (!filtersRef.current.selectedLocation) {
      search(toParams(getKeywords(), filtersRef.current));
    }
  });

  useEffect(() => {
    // Each run owns its flag, so a StrictMode remount cannot revive the first
    // run's geolocation callback.
    let cancelled = false;
    void runInitialSearch(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // Back/Forward (or a hand-edited URL) changes `urlState` out from under us.
  // A change we made ourselves already matches `lastUrlSerializedRef` by the
  // time this effect runs, so only an external change reaches the branch
  // below — guarding against searching twice for the same commit. `search`
  // and `getKeywords` are plain functions redefined every render (like the
  // rest of this hook), so listing them only means this effect's guard also
  // re-checks on an unrelated re-render — it exits immediately when nothing
  // changed, same as today.
  useEffect(() => {
    const serialized = JSON.stringify(urlState);
    if (serialized === lastUrlSerializedRef.current) return;
    lastUrlSerializedRef.current = serialized;

    const next = urlStateToFilters(urlState, INITIAL_FILTERS);
    filtersRef.current = next;
    setFilters(next);
    search(toParams(getKeywords(), next));
  }, [urlState, search, getKeywords]);

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
        commitUrl(filtersRef.current);
      }, DEBOUNCE_MS);
    },
    [search, getKeywords, commitUrl],
  );

  const triggerSearch = useCallback(() => {
    clearTimeout(debounceRef.current);
    // Collapse the panel on an explicit search: the user has finished choosing
    // and wants the results, which the expanded panel is covering. Deliberately
    // not done in `update()` — filters re-search on every change, and closing
    // the panel out from under someone still adjusting them would be hostile.
    setIsOpen(false);
    search(toParams(getKeywords(), filtersRef.current));
    commitUrl(filtersRef.current);
  }, [search, getKeywords, commitUrl]);

  const clearAll = useCallback(() => {
    clearTimeout(debounceRef.current);
    filtersRef.current = INITIAL_FILTERS;
    setFilters(INITIAL_FILTERS);
    search({ keywords: getKeywords() });
    commitUrl(INITIAL_FILTERS);
  }, [search, getKeywords, commitUrl]);

  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const setEngine = useCallback((engine: string[]) => update({ engine }), [update]);
  const setGearbox = useCallback((gearbox: string[]) => update({ gearbox }), [update]);
  const setBrand = useCallback((brand: string) => update({ brand, model: "" }), [update]);
  const setModel = useCallback((model: string) => update({ model }), [update]);
  const setMinPrice = useCallback((minPrice: number | undefined) => update({ minPrice }), [update]);
  const setMaxPrice = useCallback((maxPrice: number | undefined) => update({ maxPrice }), [update]);
  const setMinKm = useCallback((minKm: number | undefined) => update({ minKm }), [update]);
  const setMaxKm = useCallback((maxKm: number | undefined) => update({ maxKm }), [update]);
  const setMinYear = useCallback((minYear: number | undefined) => update({ minYear }), [update]);
  const setMaxYear = useCallback((maxYear: number | undefined) => update({ maxYear }), [update]);
  const setMinHorsePower = useCallback(
    (minHorsePower: number | undefined) => update({ minHorsePower }),
    [update],
  );
  const setMaxHorsePower = useCallback(
    (maxHorsePower: number | undefined) => update({ maxHorsePower }),
    [update],
  );
  const setTimeFilter = useCallback((timeFilter: TimeFilter) => update({ timeFilter }), [update]);
  const setLocation = useCallback(
    (selectedLocation: SelectedLocation | undefined) => update({ selectedLocation }),
    [update],
  );
  const setDistanceInKm = useCallback((distanceInKm: number) => update({ distanceInKm }), [update]);

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
