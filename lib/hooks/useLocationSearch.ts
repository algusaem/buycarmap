import { useCallback, useEffect, useRef, useState } from "react";
import { type GeocodingResult, searchLocations } from "@/lib/geo/nominatim";

/**
 * MAPUI-81: called once a debounced search settles for the query that is
 * still current — never for one a later query has already superseded, the
 * same out-of-order guard `results`/`failed` already follow. PlaceField
 * reads it to act on a request Enter was pressed on while it was pending. A
 * failed search always settles with an empty array (the catch below), so
 * callers never need a second argument to tell the two apart.
 */
type LocationSearchSettled = (results: GeocodingResult[]) => void;

export function useLocationSearch(locale: string = "es", onSettled?: LocationSearchSettled) {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // MAPUI-56: true once a search's request fails, so "Dónde" can say the
  // place search is down instead of that no place matches. False again once
  // a search succeeds, or the query shortens below two characters.
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const searchVersionRef = useRef(0);
  // A ref, not a dependency of `setQuery` below, so a caller passing a new
  // closure on every render (PlaceField's) never recreates the debounce.
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);

      if (timerRef.current) clearTimeout(timerRef.current);

      if (value.length < 2) {
        searchVersionRef.current += 1;
        setResults([]);
        setIsSearching(false);
        setFailed(false);
        return;
      }

      const version = ++searchVersionRef.current;
      setIsSearching(true);

      timerRef.current = setTimeout(async () => {
        let data: GeocodingResult[] = [];
        let searchFailed = false;
        try {
          data = await searchLocations(value, locale);
        } catch {
          searchFailed = true;
        }
        if (searchVersionRef.current !== version) return;
        setResults(data);
        setFailed(searchFailed);
        setIsSearching(false);
        onSettledRef.current?.(data);
      }, 400);
    },
    [locale],
  );

  const clear = useCallback(() => {
    setQuery("");
  }, [setQuery]);

  useEffect(() => {
    return () => {
      searchVersionRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { query, setQuery, results, isSearching, failed, clear };
}
