"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as motion from "motion/react-client";
import { AnimatePresence } from "motion/react";
import { MapPin, X, Loader2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n/client";
import { useLocationSearch } from "@/lib/hooks/useLocationSearch";
import { fadeInDown } from "@/lib/animations";
import type { SelectedLocation } from "@/interfaces/location";

const DISTANCE_OPTIONS = [
  { value: "10", labelKey: "km10" },
  { value: "25", labelKey: "km25" },
  { value: "50", labelKey: "km50" },
  { value: "100", labelKey: "km100" },
  { value: "200", labelKey: "km200" },
] as const;

interface LocationSearchProps {
  selectedLocation: SelectedLocation | undefined;
  distanceInKm: number;
  onLocationChange: (location: SelectedLocation | undefined) => void;
  onDistanceChange: (distance: number) => void;
}

export function LocationSearch({
  selectedLocation,
  distanceInKm,
  onLocationChange,
  onDistanceChange,
}: LocationSearchProps) {
  const { t, locale } = useTranslation();
  const { query, setQuery, results, isSearching, clear } = useLocationSearch(locale);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showDropdown = isOpen && query.length >= 2;
  const listboxOpen = showDropdown && !isSearching && results.length > 0;

  let statusText = "";
  if (showDropdown && !listboxOpen) {
    statusText = isSearching ? t.map.loading : t.filters.noResults;
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (result: { placeId: number; displayName: string; lat: number; lng: number }) => {
      onLocationChange({
        placeId: result.placeId,
        displayName: result.displayName,
        lat: result.lat,
        lng: result.lng,
      });
      setIsOpen(false);
      clear();
    },
    [onLocationChange, clear],
  );

  const handleClear = useCallback(() => {
    onLocationChange(undefined);
    clear();
    inputRef.current?.focus();
  }, [onLocationChange, clear]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // The listbox's own options are the only thing ArrowDown/ArrowUp/Enter can
    // act on, so they are no-ops while it is hidden (loading, no results, or a
    // still-loading refinement showing the previous options' stale indices).
    const navigatesListbox = e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter";
    if (navigatesListbox && !listboxOpen) return;
    if (e.key === "Escape" && !showDropdown) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t.filters.location}
      </span>

      <div className="flex flex-wrap items-start gap-3">
        {/* Location input */}
        <div ref={containerRef} className="relative w-full sm:w-64">
          {selectedLocation ? (
            <div className="flex h-10 items-center gap-2 rounded-md border border-border/50 bg-card/50 px-3 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{selectedLocation.displayName}</span>
              <button
                type="button"
                onClick={handleClear}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                aria-label={t.filters.clearFilters}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                {isSearching ? (
                  <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : (
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                    setHighlightedIndex(-1);
                  }}
                  onFocus={() => setIsOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.filters.locationPlaceholder}
                  className="flex h-10 w-full rounded-md border border-border/50 bg-card/50 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  role="combobox"
                  aria-expanded={listboxOpen}
                  aria-autocomplete="list"
                  aria-controls={listboxOpen ? "location-listbox" : undefined}
                  autoComplete="off"
                />
              </div>

              <p role="status" aria-live="polite" className="sr-only">
                {statusText}
              </p>

              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border border-border/50 bg-popover shadow-lg"
                    {...fadeInDown}
                  >
                    {!listboxOpen && (
                      <p aria-hidden="true" className="px-3 py-2 text-sm text-muted-foreground">
                        {statusText}
                      </p>
                    )}
                    {listboxOpen && (
                      <div id="location-listbox" role="listbox">
                        {results.map((result, index) => (
                          <div
                            key={result.placeId}
                            role="option"
                            tabIndex={-1}
                            aria-selected={highlightedIndex === index}
                            className={`cursor-pointer px-3 py-2 text-sm ${
                              highlightedIndex === index
                                ? "bg-card text-foreground"
                                : "text-foreground hover:bg-card/50"
                            }`}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelect(result);
                            }}
                          >
                            <span className="line-clamp-1">{result.displayName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Distance select */}
        <div className="w-full sm:w-36">
          <Select
            value={String(distanceInKm)}
            onValueChange={(val) => onDistanceChange(Number(val))}
          >
            {/* No visible label sits above this one — the trigger shows the
                distance itself — so it needs an explicit name. */}
            <SelectTrigger aria-label={t.filters.distance}>
              <SelectValue placeholder={t.filters.distance} />
            </SelectTrigger>
            <SelectContent>
              {DISTANCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t.filters.distanceOptions[opt.labelKey]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
