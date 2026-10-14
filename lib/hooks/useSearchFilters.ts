import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { DEFAULT_RADIUS_KM, type SearchInput } from "@/lib/search/schema";
import type { SelectedLocation } from "@/interfaces/location";
import { initUserGeolocation, waitForGeolocation } from "@/lib/geo/user-location";
import type { ChipKey, FuelChipKey } from "@/lib/search/filter-chips";
import { FUEL_GROUPS } from "@/lib/search/fuel-groups";
import {
  hasPanelCriteria,
  isOfferedGearbox,
  OFFERED_GEARBOXES,
  panelCriteria,
} from "@/lib/search/panel";
import {
  KEYWORDS_PARAM,
  searchParsers,
  filtersToUrlState,
  urlStateToFilters,
  type UrlFilterValues,
} from "@/lib/search/url-state";

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

/** The URL parsers, with the landing's `?q=` text so it is written in the same update (MAPUI-18). */
const urlParsers = { ...searchParsers, [KEYWORDS_PARAM]: parseAsString };

function toParams(keywords: string, f: FilterValues): SearchInput {
  return { keywords, ...toInput(f) };
}

/**
 * The gearbox criterion sent to the search (MAPUI-16): both kinds together —
 * an old link's `gearbox=manual,automatic` — mean any gearbox, so none is
 * sent; anything else, including a value the UI no longer offers (MAPUI-18),
 * is sent as it is.
 */
function gearboxCriterion(gearbox: string[]): string[] | undefined {
  const everyKind = OFFERED_GEARBOXES.every((offered) => gearbox.includes(offered));
  if (everyKind || gearbox.length === 0) return undefined;
  return gearbox;
}

/** The filters as the shared `SearchInput`, without the free text. */
function toInput(f: FilterValues): SearchInput {
  return {
    engine: f.engine.length > 0 ? f.engine : undefined,
    gearbox: gearboxCriterion(f.gearbox),
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

/** The numeric filters, the same name in `SearchInput` and in the filter values. */
const AMOUNT_KEYS = [
  "minPrice",
  "maxPrice",
  "minKm",
  "maxKm",
  "minYear",
  "maxYear",
  "minHorsePower",
  "maxHorsePower",
] as const;

/**
 * The filter values a `SearchInput` patch from the redesigned controls sets
 * (docs/specs/redesign-map.md, MAPUI-12 to MAPUI-22). Only the keys present in
 * the patch change; a key present as `undefined` clears that filter. The
 * place is not in `SearchInput` by name, so callers pass it separately.
 */
function fromInputPatch(patch: Partial<SearchInput>): Partial<FilterValues> {
  const next: Partial<FilterValues> = {};
  for (const key of AMOUNT_KEYS) {
    if (key in patch) next[key] = patch[key];
  }
  if ("engine" in patch) next.engine = patch.engine ?? [];
  if ("gearbox" in patch) next.gearbox = patch.gearbox ?? [];
  if ("brand" in patch) next.brand = patch.brand ?? "";
  if ("model" in patch) next.model = patch.model ?? "";
  if ("timeFilter" in patch) next.timeFilter = patch.timeFilter ?? "";
  if (patch.distanceInKm !== undefined) next.distanceInKm = patch.distanceInKm;
  return next;
}

/**
 * What «Borrar» and «Quitar filtros» clear (MAPUI-18, MAPUI-19, MAPUI-31):
 * every panel criterion and every criterion the UI no longer offers
 * (lib/search/panel.ts's PANEL_KEYS), but not the place and its radius,
 * which belong to «Dónde».
 */
const PANEL_CLEARED = fromInputPatch(panelCriteria({}));

function isFuelChip(key: ChipKey): key is FuelChipKey {
  return key.startsWith("engine:");
}

function assertNever(value: never): never {
  throw new Error(`Unhandled chip key: ${String(value)}`);
}

/** What removing a filters-row chip clears (MAPUI-13); the keys are lib/search/filter-chips.ts's. */
function chipRemoval(key: ChipKey, f: FilterValues): Partial<FilterValues> {
  if (isFuelChip(key)) {
    const group = FUEL_GROUPS.find((definition) => `engine:${definition.group}` === key);
    if (!group) return {};
    return { engine: f.engine.filter((value) => !group.values.includes(value)) };
  }
  switch (key) {
    case "price":
      return { minPrice: undefined, maxPrice: undefined };
    case "minPrice":
      return { minPrice: undefined };
    case "maxPrice":
      return { maxPrice: undefined };
    case "gearbox":
      // The chip is «Manual» or «Automático» (MAPUI-16); a value the UI no
      // longer offers stays (MAPUI-18).
      return {
        gearbox: f.gearbox.filter((value) => !isOfferedGearbox(value)),
      };
    case "maxKm":
      return { maxKm: undefined };
    case "minYear":
      return { minYear: undefined };
    case "timeFilter":
      return { timeFilter: "" };
    case "brand":
      return { brand: "", model: "" };
    default:
      return assertNever(key);
  }
}

const DEBOUNCE_MS = 400;

export type SearchPopover = "where" | "car" | "price";

export function useSearchFilters(search: (params: SearchInput) => void, getKeywords: () => string) {
  // FRONT-13 (docs/specs/core-frontend.md): the URL is the deep-linkable
  // record of the filters. It is only written at the same points this hook
  // already calls `search()` (the debounce firing, an explicit trigger, or
  // clearing) — not on every keystroke — so typing doesn't spam history and
  // Back/Forward move between meaningful searches, not individual keystrokes.
  const [urlState, setUrlState] = useQueryStates(urlParsers);
  const lastUrlSerializedRef = useRef(JSON.stringify(urlState));

  // MAPUI-18 (docs/specs/redesign-map.md): «Borrar» and «Quitar filtros»
  // (`clearAll`) clear the landing's `?q=` text too. The caller owns the
  // text until F4 (`getKeywords`) while this ref is unset. A clear sets it to
  // "", which drops `q` from the URL in the next commit and from every later
  // search; Back/Forward set it to the restored URL's own `q`, so Back after
  // «Quitar filtros» brings the text search back.
  const keywordsRef = useRef<string | undefined>(undefined);
  const currentKeywords = useCallback(() => keywordsRef.current ?? getKeywords(), [getKeywords]);

  const [filters, setFilters] = useState<FilterValues>(() =>
    urlStateToFilters(urlState, INITIAL_FILTERS),
  );
  const [isOpen, setIsOpen] = useState(false);
  // docs/specs/redesign-map.md (MAPUI-2, MAPUI-12): which of the desktop
  // search pill's popovers is open — one piece of state, so at most one is.
  // `triggerSearch` («Buscar») closes it, as it closes the filters panel.
  const [activePopover, setActivePopover] = useState<SearchPopover | null>(null);
  const filtersRef = useRef<FilterValues>(filters);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const commitUrl = useCallback(
    (next: FilterValues) => {
      // The text leaves the URL in the same update as the filters, so one
      // history entry records both.
      const nextUrlState = {
        ...filtersToUrlState(next),
        ...(keywordsRef.current === "" ? { [KEYWORDS_PARAM]: null } : {}),
      };
      lastUrlSerializedRef.current = JSON.stringify({ ...urlState, ...nextUrlState });
      void setUrlState(nextUrlState, { history: "push" });
    },
    [setUrlState, urlState],
  );

  // The filters in force, written to the ref (read by the debounce and the
  // next patch within the same event) and to the rendered state together.
  const commitFilters = useCallback((next: FilterValues) => {
    filtersRef.current = next;
    setFilters(next);
  }, []);

  const runInitialSearch = useEffectEvent(async (isCancelled: () => boolean) => {
    // Fire an immediate search (uses Spain-center fallback if geolocation
    // hasn't resolved yet, or the deep-linked filters otherwise), then
    // re-search once geolocation finishes so results are centered on the
    // user's actual location.
    search(toParams(currentKeywords(), filtersRef.current));
    initUserGeolocation();
    await waitForGeolocation();
    if (isCancelled()) return;
    // Only re-search if the user hasn't already picked an explicit location.
    if (!filtersRef.current.selectedLocation) {
      search(toParams(currentKeywords(), filtersRef.current));
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
  // comes from the caller and `commitFilters` is stable; when either changes
  // identity on a re-render the guard exits at once, since the URL did not
  // change.
  useEffect(() => {
    const serialized = JSON.stringify(urlState);
    if (serialized === lastUrlSerializedRef.current) return;
    lastUrlSerializedRef.current = serialized;

    // A change still waiting out the MAP-11 pause belongs to the page being
    // left: firing it now would search it and push one more history entry.
    clearTimeout(debounceRef.current);
    // The restored URL's own `?q=` text, which also undoes an earlier clear.
    keywordsRef.current = urlState[KEYWORDS_PARAM] ?? "";
    const next = urlStateToFilters(urlState, INITIAL_FILTERS);
    commitFilters(next);
    search(toParams(keywordsRef.current, next));
  }, [urlState, search, commitFilters]);

  const update = useCallback(
    (patch: Partial<FilterValues>) => {
      // From the ref rather than inside a state updater, so a patch applied
      // right after this one (a model chosen together with its brand,
      // MAPUI-8) builds on it within the same event.
      commitFilters({ ...filtersRef.current, ...patch });
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        search(toParams(currentKeywords(), filtersRef.current));
        commitUrl(filtersRef.current);
      }, DEBOUNCE_MS);
    },
    [search, currentKeywords, commitUrl, commitFilters],
  );

  const triggerSearch = useCallback(() => {
    clearTimeout(debounceRef.current);
    // Collapse the panel on an explicit search: the user has finished choosing
    // and wants the results, which the expanded panel is covering. Deliberately
    // not done in `update()` — filters re-search on every change, and closing
    // the panel out from under someone still adjusting them would be hostile.
    setIsOpen(false);
    setActivePopover(null);
    search(toParams(currentKeywords(), filtersRef.current));
    commitUrl(filtersRef.current);
  }, [search, currentKeywords, commitUrl]);

  // MAPUI-18: once a control clears the landing's `?q=` text, it stays out of
  // the URL and of every later search.
  const dropKeywords = useCallback(() => {
    keywordsRef.current = "";
  }, []);

  // Applies a patch and searches at once, skipping the MAP-11 pause: the
  // phone's «Ver coches» (MAPUI-21, MAPUI-22), a removed chip (MAPUI-13,
  // MAPUI-22) and «Borrar» / «Quitar filtros» (MAPUI-19, MAPUI-31).
  const apply = useCallback(
    (patch: Partial<FilterValues>) => {
      clearTimeout(debounceRef.current);
      const next = { ...filtersRef.current, ...patch };
      commitFilters(next);
      search(toParams(currentKeywords(), next));
      commitUrl(next);
    },
    [search, currentKeywords, commitUrl, commitFilters],
  );

  /** A desktop control's change, searched after the MAP-11 pause (MAPUI-12). */
  const updateInput = useCallback(
    (patch: Partial<SearchInput>) => {
      if ("keywords" in patch && !patch.keywords) dropKeywords();
      update(fromInputPatch(patch));
    },
    [update, dropKeywords],
  );

  /**
   * The phone sheets' «Ver coches» (MAPUI-21, MAPUI-22): the edited criteria
   * and, from «BUSCAR», the place — `null` for «Toda España», left out to keep
   * the current one.
   */
  const applyInput = useCallback(
    (patch: Partial<SearchInput>, location?: SelectedLocation | null) => {
      if ("keywords" in patch && !patch.keywords) dropKeywords();
      const next = fromInputPatch(patch);
      if (location !== undefined) next.selectedLocation = location ?? undefined;
      apply(next);
    },
    [apply, dropKeywords],
  );

  /**
   * The filters panel's «Borrar» on desktop (MAPUI-19) and the empty state's
   * «Quitar filtros» (MAPUI-31): every filter, the criteria the UI no longer
   * offers and the `?q=` text go, the place and its radius stay.
   */
  const clearAll = useCallback(() => {
    dropKeywords();
    apply(PANEL_CLEARED);
  }, [apply, dropKeywords]);

  /** Removing a filters-row chip (MAPUI-13, MAPUI-22). */
  const removeChip = useCallback(
    (key: ChipKey) => apply(chipRemoval(key, filtersRef.current)),
    [apply],
  );

  const setBrand = useCallback((brand: string) => update({ brand, model: "" }), [update]);
  const setModel = useCallback((model: string) => update({ model }), [update]);
  const setLocation = useCallback(
    (selectedLocation: SelectedLocation | undefined) => update({ selectedLocation }),
    [update],
  );
  const setDistanceInKm = useCallback((distanceInKm: number) => update({ distanceInKm }), [update]);

  const input = toInput(filters);

  return {
    ...filters,
    /** The filters as the shared `SearchInput`, for the pill, the chips and the panel. */
    input,
    /**
     * Whether a filter is active beyond the place and its radius — a panel
     * criterion or the `?q=` text still searched, both of which «Quitar
     * filtros» clears (MAPUI-31). The text is read from the same ref the
     * searches read; every change to it comes with a filters commit, so this
     * render already sees it.
     */
    hasFilters: hasPanelCriteria(input) || currentKeywords() !== "",
    isOpen,
    /** Opens or closes the desktop filters dropdown (MAPUI-19). */
    setFiltersOpen: setIsOpen,
    activePopover,
    setActivePopover,
    triggerSearch,
    updateInput,
    applyInput,
    clearAll,
    removeChip,
    setBrand,
    setModel,
    setLocation,
    setDistanceInKm,
  };
}
