import { useCallback, useEffect, useRef, useState } from "react";
import { type GeocodingResult, searchLocations } from "@/lib/geo/nominatim";

export function useLocationSearch(locale: string = "es") {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // MAPUI-56: true once a search's request fails, so "Dónde" can say the
  // place search is down instead of that no place matches. False again once
  // a search succeeds, or the query shortens below two characters.
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const searchVersionRef = useRef(0);

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
        try {
          const data = await searchLocations(value, locale);
          if (searchVersionRef.current !== version) return;
          setResults(data);
          setFailed(false);
          setIsSearching(false);
        } catch {
          if (searchVersionRef.current !== version) return;
          setResults([]);
          setFailed(true);
          setIsSearching(false);
        }
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
