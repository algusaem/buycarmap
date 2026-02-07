import { useCallback, useRef, useState } from "react";
import { SearchInput } from "@/lib/validations/search";

function toParams(
  keywords: string,
  engine: string[],
  gearbox: string[],
  brand: string,
): SearchInput {
  return {
    keywords,
    engine: engine.length > 0 ? engine : undefined,
    gearbox: gearbox.length > 0 ? gearbox : undefined,
    brand: brand || undefined,
  };
}

export function useSearchFilters(
  search: (params: SearchInput) => void,
  getKeywords: () => string,
) {
  const [engine, setEngine] = useState<string[]>([]);
  const [gearbox, setGearbox] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const hasSearchedRef = useRef(false);

  const activeCount = engine.length + gearbox.length + (brand ? 1 : 0);

  const triggerSearch = useCallback(() => {
    hasSearchedRef.current = true;
    search(toParams(getKeywords(), engine, gearbox, brand));
  }, [search, engine, gearbox, brand, getKeywords]);

  const setEngineAndSearch = useCallback(
    (next: string[]) => {
      setEngine(next);
      if (hasSearchedRef.current) {
        search(toParams(getKeywords(), next, gearbox, brand));
      }
    },
    [search, gearbox, brand, getKeywords],
  );

  const setGearboxAndSearch = useCallback(
    (next: string[]) => {
      setGearbox(next);
      if (hasSearchedRef.current) {
        search(toParams(getKeywords(), engine, next, brand));
      }
    },
    [search, engine, brand, getKeywords],
  );

  const setBrandAndSearch = useCallback(
    (next: string) => {
      setBrand(next);
      if (hasSearchedRef.current) {
        search(toParams(getKeywords(), engine, gearbox, next));
      }
    },
    [search, engine, gearbox, getKeywords],
  );

  const clearAll = useCallback(() => {
    setEngine([]);
    setGearbox([]);
    setBrand("");
    if (hasSearchedRef.current) {
      search({ keywords: getKeywords() });
    }
  }, [search, getKeywords]);

  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  return {
    engine,
    gearbox,
    brand,
    isOpen,
    activeCount,
    toggle,
    triggerSearch,
    setEngine: setEngineAndSearch,
    setGearbox: setGearboxAndSearch,
    setBrand: setBrandAndSearch,
    clearAll,
  };
}
