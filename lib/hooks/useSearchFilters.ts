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

/** The URL parsers, with the field's own `q` so it is written in the same update as the rest of the filters (MAPUI-18, DESC-6). */
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

  // MAPUI-18 (docs/specs/redesign-map.md), amended by
  // docs/specs/map-description-search.md (DESC-6 to DESC-19): the
  // Descripción field's applied text, trimmed. The caller's `getKeywords` is
  // MapView's own `initialQuery` prop — the page passes none, so it only
  // seeds a render with no URL text — only the pristine fallback before this
  // ref is ever set; once any control touches the text (typing Enter,
  // «Borrar texto», a sheet's «Ver coches», «Buscar» applying an unconfirmed
  // draft, «Borrar» or «Quitar filtros»), the ref is what every later search
  // and URL commit reads, including the URL's own restore (Back/Forward,
  // DESC-15).
  const keywordsRef = useRef<string | undefined>(undefined);
  // docs/specs/map-description-search.md (DESC-8, DESC-15, DESC-19): the
  // field's own typed, unconfirmed draft — noted on every keystroke by
  // `noteKeywordsDraft` (DescriptionField's `onDraftChange`), read only by
  // `triggerSearch`, which applies it the way «Buscar» applies any other
  // filter. `keywordsResetKey` changes whenever the draft is discarded out
  // from under the field instead — Back/Forward, «Borrar», «Quitar filtros»
  // — so the field (which otherwise only resets when `applied` itself
  // changes) knows to drop what was typed even when the applied text does
  // not change.
  const keywordsDraftRef = useRef<string | undefined>(undefined);
  const [keywordsResetKey, setKeywordsResetKey] = useState(0);
  // A no-op, including the state update, when there is no draft to discard —
  // every clear path below calls this unconditionally, and must not force an
  // extra render (which would race nuqs's own, still-settling `urlState`)
  // when nothing was actually typed to discard.
  const discardKeywordsDraft = useCallback(() => {
    if (keywordsDraftRef.current === undefined) return;
    keywordsDraftRef.current = undefined;
    setKeywordsResetKey((key) => key + 1);
  }, []);
  const noteKeywordsDraft = useCallback((value: string) => {
    keywordsDraftRef.current = value;
  }, []);
  // Sets the applied text to `text`, trimmed, and discards any unconfirmed
  // draft underneath it — the restored URL (Back/Forward, DESC-15), «Buscar»
  // applying the draft (DESC-8) and «Borrar» / «Quitar filtros» (DESC-19).
  // `applyKeywords` (Enter and «Borrar texto») writes the ref itself: when the
  // text changes, `applied` changing resets the field, so no reset is needed.
  const setKeywords = useCallback(
    (text: string) => {
      keywordsRef.current = text.trim();
      discardKeywordsDraft();
    },
    [discardKeywordsDraft],
  );
  const currentKeywords = useCallback(() => {
    if (keywordsRef.current !== undefined) return keywordsRef.current;
    const urlValue = urlState[KEYWORDS_PARAM];
    return (urlValue ?? getKeywords()).trim();
  }, [getKeywords, urlState]);

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
      // text leaves or joins the URL in the same update as the filters, so
      // one history entry records both — only once a control has actually
      // touched it (DESC-6, DESC-9, DESC-10); before that, an old link's own
      // `q` is left exactly as it was by a commit that never named it.
      const nextUrlState = {
        ...filtersToUrlState(next),
        radius: urlRadius(next),
        ...(keywordsRef.current !== undefined
          ? { [KEYWORDS_PARAM]: keywordsRef.current || null }
          : {}),
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
    // The restored URL's own `q` text — trimmed, so Back/Forward to a `q`
    // holding only spaces reads as no text (DESC-16) — which also undoes an
    // earlier clear or apply. DESC-15: the field's own unconfirmed draft, if
    // any, is discarded the same way — the restored URL is what decides the
    // text now.
    setKeywords(urlState[KEYWORDS_PARAM] ?? "");
    const restored = urlStateToFilters(urlState, INITIAL_FILTERS);
    // A restored place replaces the browser's position; with none, it keeps
    // standing in at the default radius (MAP-28).
    if (restored.selectedLocation) chooseLocation();
    const next = aroundPosition(restored, positionRef.current);
    commitFilters(next);
    // `setKeywords` just set the ref, synchronously, to a trimmed string —
    // never undefined — but a ref mutated inside a function call is nothing
    // the compiler can narrow across, unlike the inline assignment this
    // replaced.
    search(toParams(keywordsRef.current ?? "", next, positionRef.current));
  }, [urlState, search, commitFilters, chooseLocation, setKeywords]);

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
    // DESC-8: «Buscar» applies whatever the Descripción field currently
    // holds, confirmed or not — an unconfirmed draft is read here, before
    // `currentKeywords()`, and applied through `setKeywords` the same way
    // any other apply applies it.
    if (keywordsDraftRef.current !== undefined) setKeywords(keywordsDraftRef.current);
    // Collapse the panel on an explicit search: the user has finished choosing
    // and wants the results, which the expanded panel is covering. Deliberately
    // not done in `update()` — filters re-search on every change, and closing
    // the panel out from under someone still adjusting them would be hostile.
    setIsOpen(false);
    setActivePopover(null);
    search(toParams(currentKeywords(), filtersRef.current, positionRef.current));
    commitUrl(filtersRef.current);
  }, [search, currentKeywords, commitUrl, setKeywords]);

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
      if ("keywords" in patch && !patch.keywords) setKeywords("");
      update(fromInputPatch(patch));
    },
    [update, setKeywords],
  );

  /**
   * The phone sheets' «Ver coches» (MAPUI-21, MAPUI-22) and quick filters
   * (MAPUI-63): the edited criteria and, from «BUSCAR», the place — `null` for
   * «Toda España», left out to keep the current one or the browser's
   * position. docs/specs/map-description-search.md (DESC-12, DESC-13): the
   * «BUSCAR» sheet's own Descripción field applies through here too — any
   * `keywords` the patch names, trimmed, replaces the applied text at once.
   */
  const applyInput = useCallback(
    (patch: Partial<SearchInput>, location?: SelectedLocation | null) => {
      if ("keywords" in patch) setKeywords(patch.keywords ?? "");
      const next = fromInputPatch(patch);
      if (location !== undefined) {
        chooseLocation();
        next.selectedLocation = location ?? undefined;
      }
      apply(next);
    },
    [apply, chooseLocation, setKeywords],
  );

  /**
   * The filters panel's «Borrar» on desktop (MAPUI-19) and the empty state's
   * «Quitar filtros» (MAPUI-31): every filter, the criteria the UI no longer
   * offers and the `?q=` text go, the place and its radius stay.
   */
  const clearAll = useCallback(() => {
    setKeywords("");
    apply(PANEL_CLEARED);
  }, [apply, setKeywords]);

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

  /**
   * The Descripción field's own Enter and «Borrar texto»
   * (docs/specs/map-description-search.md, DESC-6, DESC-9, DESC-10): trims
   * the text and, only when it differs from what is already applied
   * (DESC-7), searches with it at once — cancelling any pending MAP-11
   * debounce — and writes `q` (DESC-6, DESC-11), or clears it (DESC-10).
   * Every other criterion is read from `filtersRef`, untouched.
   */
  const applyKeywords = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed === currentKeywords()) {
        // Nothing to search or write, but the field may still be showing an
        // unconfirmed draft (typed over the applied text, then emptied back
        // to it without Enter) — `applied` is not about to change, so only
        // an explicit discard makes the field show it again (DESC-7).
        discardKeywordsDraft();
        return;
      }
      clearTimeout(debounceRef.current);
      keywordsRef.current = trimmed;
      // `applied` itself is about to change, which already makes the field
      // show the trimmed text on its own (DescriptionField's render-time
      // reset) — no resetKey bump needed, just drop the stale draft under it.
      keywordsDraftRef.current = undefined;
      search(toParams(trimmed, filtersRef.current, positionRef.current));
      commitUrl(filtersRef.current);
    },
    [search, currentKeywords, commitUrl, discardKeywordsDraft],
  );

  const keywords = currentKeywords();
  // The applied text is part of what a surface reads from `input`: the phone
  // summary (DESC-18), the «BUSCAR» sheet (DESC-12) and an alert's criteria
  // (DESC-21).
  const input: SearchInput = {
    ...toInput(filters, browserPosition),
    keywords: keywords || undefined,
  };

  return {
    /** The applied, trimmed description text (DESC-6 to DESC-19). */
    keywords,
    applyKeywords,
    /** docs/specs/map-description-search.md (DESC-8): notes the field's own
     * unconfirmed draft, so «Buscar» can apply it. */
    noteKeywordsDraft,
    /** Changes whenever the field's draft is discarded from outside — Back/
     * Forward, «Borrar» or «Quitar filtros» (DESC-15, DESC-19). */
    keywordsResetKey,
    ...filters,
    /** The browser's position while it stands in for a place (MAP-28, MAP-32); never in the URL. */
    browserPosition,
    /** The filters as the shared `SearchInput`, for the pill, the quick filters and the panel. */
    input,
    /**
     * Whether a filter is active beyond the place and its radius — a panel
     * criterion or the field's `q` text still searched, both of which
     * «Quitar filtros» clears (MAPUI-31). `keywords` is computed once above
     * and reused here; every change to it is followed by a re-render, through
     * `setFilters` (`apply`, `commitFilters`) or nuqs's URL update
     * (`applyKeywords`, `triggerSearch`), which is what makes this render see
     * the new value — not the ref by itself.
     */
    hasFilters: hasPanelCriteria(input) || keywords !== "",
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
