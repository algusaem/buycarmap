import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { DEFAULT_RADIUS_KM, type SearchInput } from "@/lib/search/schema";
import type { GeoPosition, SelectedLocation } from "@/interfaces/location";
import {
  dismissUserLocation,
  getUserLocation,
  initUserGeolocation,
  waitForGeolocation,
} from "@/lib/geo/user-location";
import { hasPanelCriteria, OFFERED_GEARBOXES, panelCriteria } from "@/lib/search/panel";
import {
  EMPTY_URL_FILTERS,
  KEYWORDS_PARAM,
  searchParsers,
  filtersToUrlState,
  urlRadius,
  urlStateToFilters,
  type UrlFilterValues,
} from "@/lib/search/url-state";

type FilterValues = UrlFilterValues;

const INITIAL_FILTERS: FilterValues = EMPTY_URL_FILTERS;

/** The URL parsers, with an old link's `?q=` text so it is written in the same update (MAPUI-18). */
const urlParsers = { ...searchParsers, [KEYWORDS_PARAM]: parseAsString };

function toParams(keywords: string, f: FilterValues, position?: GeoPosition): SearchInput {
  return { keywords, ...toInput(f, position) };
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

/**
 * The filters as the shared `SearchInput`, without the free text. The centre
 * is the chosen place, else the browser's position standing in for one
 * (MAP-13, MAP-28); the radius goes with either.
 */
function toInput(f: FilterValues, position?: GeoPosition): SearchInput {
  const centre = f.selectedLocation ?? position;
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
    latitude: centre?.lat,
    longitude: centre?.lng,
    distanceInKm: centre ? f.distanceInKm : undefined,
  };
}

/** The browser's position stands in for a place: there is one, and no place is chosen (MAP-28). */
function positionStandsIn(f: FilterValues, position: GeoPosition | undefined): boolean {
  return position !== undefined && !f.selectedLocation;
}

/**
 * The filters at the default radius while the browser's position stands in —
 * not an old link's `?radius=`, which meant nothing without a place (MAP-28);
 * as they are otherwise.
 */
function aroundPosition(f: FilterValues, position: GeoPosition | undefined): FilterValues {
  if (!positionStandsIn(f, position)) return f;
  return { ...f, distanceInKm: DEFAULT_RADIUS_KM };
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
  // (`clearAll`) clear an old link's `?q=` text too. The caller owns the
  // text (`getKeywords`) while this ref is unset — still parsed for a link
  // that carries one, never produced (docs/specs/redesign-entry.md, ENTRY-6).
  // A clear sets it to "", which drops `q` from the URL in the next commit
  // and from every later search; Back/Forward set it to the restored URL's
  // own `q`, so Back after «Quitar filtros» brings the text search back.
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

  // MAP-28 to MAP-33 (docs/specs/map-and-search.md): the browser's position,
  // standing in for a place until the user makes a location choice of their
  // own. Not a filter value, so it never reaches the URL (MAP-33). The ref is
  // what searches read within the same event; the state is what renders.
  const [browserPosition, setBrowserPosition] = useState<GeoPosition | undefined>(undefined);
  const positionRef = useRef<GeoPosition | undefined>(undefined);
  // Set by any explicit location choice — a place or «Toda España» — so a
  // position arriving later never overrides it (MAP-14, MAP-31).
  const locationChosenRef = useRef(false);

  const commitPosition = useCallback((position: GeoPosition | undefined) => {
    positionRef.current = position;
    setBrowserPosition(position);
  }, []);

  // The choice also ends the position for the rest of the visit, so a remount
  // of the map does not bring it back (MAP-37).
  const chooseLocation = useCallback(() => {
    locationChosenRef.current = true;
    dismissUserLocation();
    commitPosition(undefined);
  }, [commitPosition]);

  const commitUrl = useCallback(
    (next: FilterValues) => {
      // The radius reaches the URL only with a chosen place (MAP-33). The
      // text leaves the URL in the same update as the filters, so one history
      // entry records both.
      const nextUrlState = {
        ...filtersToUrlState(next),
        radius: urlRadius(next),
        ...(keywordsRef.current === "" ? { [KEYWORDS_PARAM]: null } : {}),
      };
      // A cleared radius reads back as its parser's default.
      const serialized = JSON.stringify({
        ...urlState,
        ...nextUrlState,
        radius: nextUrlState.radius ?? searchParsers.radius.defaultValue,
      });
      // Nothing in the URL changes («Buscar» pressed twice, a radius chosen
      // with no place): no history entry for it (MAP-38).
      if (serialized === lastUrlSerializedRef.current) return;
      lastUrlSerializedRef.current = serialized;
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
    // Fire an immediate search — national, or the deep-linked filters — without
    // waiting on the browser's prompt (MAP-14). A deep-linked place is a
    // choice already made, so the position is dropped for the visit and the
    // browser is not asked (MAP-30, MAP-37).
    search(toParams(currentKeywords(), filtersRef.current, positionRef.current));
    if (filtersRef.current.selectedLocation) {
      chooseLocation();
      return;
    }
    initUserGeolocation();
    await waitForGeolocation();
    // An explicit location choice made meanwhile wins (MAP-14, MAP-31); with
    // no position, the national search stands alone (MAP-29).
    if (isCancelled() || locationChosenRef.current) return;
    const position = getUserLocation();
    if (!position) return;
    // The filters in force, centred on the position at the default radius (MAP-28).
    commitPosition(position);
    const next = aroundPosition(filtersRef.current, position);
    commitFilters(next);
    search(toParams(currentKeywords(), next, position));
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
  // comes from the caller, and `commitFilters` and `chooseLocation` are
  // stable; when any of them changes identity on a re-render the guard exits
  // at once, since the URL did not change.
  useEffect(() => {
    const serialized = JSON.stringify(urlState);
    if (serialized === lastUrlSerializedRef.current) return;
    lastUrlSerializedRef.current = serialized;

    // A change still waiting out the MAP-11 pause belongs to the page being
    // left: firing it now would search it and push one more history entry.
    clearTimeout(debounceRef.current);
    // The restored URL's own `?q=` text, which also undoes an earlier clear.
    keywordsRef.current = urlState[KEYWORDS_PARAM] ?? "";
    const restored = urlStateToFilters(urlState, INITIAL_FILTERS);
    // A restored place replaces the browser's position; with none, it keeps
    // standing in at the default radius (MAP-28).
    if (restored.selectedLocation) chooseLocation();
    const next = aroundPosition(restored, positionRef.current);
    commitFilters(next);
    search(toParams(keywordsRef.current, next, positionRef.current));
  }, [urlState, search, commitFilters, chooseLocation]);

  const update = useCallback(
    (patch: Partial<FilterValues>) => {
      // From the ref rather than inside a state updater, so a patch applied
      // right after this one (a model chosen together with its brand,
      // MAPUI-8) builds on it within the same event.
      commitFilters({ ...filtersRef.current, ...patch });
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        search(toParams(currentKeywords(), filtersRef.current, positionRef.current));
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
    search(toParams(currentKeywords(), filtersRef.current, positionRef.current));
    commitUrl(filtersRef.current);
  }, [search, currentKeywords, commitUrl]);

  // MAPUI-18: once a control clears the landing's `?q=` text, it stays out of
  // the URL and of every later search.
  const dropKeywords = useCallback(() => {
    keywordsRef.current = "";
  }, []);

  // Applies a patch and searches at once, skipping the MAP-11 pause: the
  // phone's «Ver coches» (MAPUI-21, MAPUI-22), a quick filter (MAPUI-22,
  // MAPUI-63) and «Borrar» / «Quitar filtros» (MAPUI-19, MAPUI-31).
  const apply = useCallback(
    (patch: Partial<FilterValues>) => {
      clearTimeout(debounceRef.current);
      const next = { ...filtersRef.current, ...patch };
      commitFilters(next);
      search(toParams(currentKeywords(), next, positionRef.current));
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
   * The phone sheets' «Ver coches» (MAPUI-21, MAPUI-22) and quick filters
   * (MAPUI-63): the edited criteria and, from «BUSCAR», the place — `null` for
   * «Toda España», left out to keep the current one or the browser's position.
   */
  const applyInput = useCallback(
    (patch: Partial<SearchInput>, location?: SelectedLocation | null) => {
      if ("keywords" in patch && !patch.keywords) dropKeywords();
      const next = fromInputPatch(patch);
      if (location !== undefined) {
        chooseLocation();
        next.selectedLocation = location ?? undefined;
      }
      apply(next);
    },
    [apply, dropKeywords, chooseLocation],
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

  const setBrand = useCallback((brand: string) => update({ brand, model: "" }), [update]);
  const setModel = useCallback((model: string) => update({ model }), [update]);
  // A place, or `undefined` for «Toda España»: either drops the browser's position.
  const setLocation = useCallback(
    (selectedLocation: SelectedLocation | undefined) => {
      chooseLocation();
      update({ selectedLocation });
    },
    [update, chooseLocation],
  );
  const setDistanceInKm = useCallback((distanceInKm: number) => update({ distanceInKm }), [update]);

  const input = toInput(filters, browserPosition);

  return {
    ...filters,
    /** The browser's position while it stands in for a place (MAP-28, MAP-32); never in the URL. */
    browserPosition,
    /** The filters as the shared `SearchInput`, for the pill, the quick filters and the panel. */
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
    setBrand,
    setModel,
    setLocation,
    setDistanceInKm,
  };
}
