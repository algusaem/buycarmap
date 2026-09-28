import { useCallback, useEffect, useRef, useState } from "react";
import { type GeocodingResult, searchLocations } from "@/lib/geo/nominatim";

export function useLocationSearch(locale: string = "es") {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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
        return;
      }

      const version = ++searchVersionRef.current;
      setIsSearching(true);

      timerRef.current = setTimeout(async () => {
        const data = await searchLocations(value, locale);
        if (searchVersionRef.current !== version) return;
        setResults(data);
        setIsSearching(false);
      }, 400);
    },
    [locale],
  );

  const clear = useCallback(() => {
    searchVersionRef.current += 1;
    setQuery("");
    setResults([]);
    setIsSearching(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [setQuery]);

  useEffect(() => {
    return () => {
      searchVersionRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { query, setQuery, results, isSearching, clear };
}
