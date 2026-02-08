import { useCallback, useRef, useState } from "react";
import { GeocodingResult, searchLocations } from "@/lib/geo/nominatim";

export function useLocationSearch(locale: string = "es") {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);

      if (timerRef.current) clearTimeout(timerRef.current);

      if (value.length < 2) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      timerRef.current = setTimeout(async () => {
        const data = await searchLocations(value, locale);
        setResults(data);
        setIsSearching(false);
      }, 400);
    },
    [locale],
  );

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsSearching(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [setQuery]);

  return { query, setQuery, results, isSearching, clear };
}
