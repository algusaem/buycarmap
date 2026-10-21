"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { SelectedLocation, ShownPlace } from "@/interfaces/location";
import type { GeocodingResult } from "@/lib/geo/nominatim";
import { isSelectedLocation } from "@/lib/search/shown-place";
import { useLocationSearch } from "@/lib/hooks/useLocationSearch";
import { useOptionNavigation } from "@/lib/hooks/useOptionNavigation";
import { ComboOption, Listbox, ListStatus, NoMatch, SearchField } from "./Combobox";

// docs/specs/redesign-map.md (MAPUI-3, MAPUI-56, amends MAP-20): «Dónde»'s
// field, in the desktop popover and the «BUSCAR» sheet. Nominatim is searched
// from the browser through lib/hooks/useLocationSearch.ts (FRONT-7) once two
// or more characters are typed; each place is an option with its region on a
// second line, and the count is announced in a polite status. When Nominatim
// finds nothing, «No existe ningún lugar con ese nombre» takes the list's
// place and the status reads it (MAPUI-56). When the search itself fails
// (`failed`, from useLocationSearch), «El buscador de lugares no responde.
// Prueba otra vez.» takes that place instead — never the no-match line, which
// would claim the place does not exist when the real problem is that
// Nominatim could not be reached. Escape or a press outside closes the list
// without choosing (lib/hooks/useOptionNavigation.ts). The list and the
// no-match lines appear and leave at once (MOTION-13).

/**
 * The place and its region (Contracts › Location): the display name before
 * its first comma, and what follows it without a trailing «España».
 */
function splitPlace(displayName: string): { place: string; region?: string } {
  const comma = displayName.indexOf(",");
  if (comma === -1) return { place: displayName.trim() };
  const region = displayName
    .slice(comma + 1)
    .replace(/,?\s*España\s*$/u, "")
    .trim();
  return { place: displayName.slice(0, comma).trim(), region: region || undefined };
}

interface PlaceListboxProps {
  id: string;
  label: string;
  results: GeocodingResult[];
  selectedPlaceId: number | undefined;
  highlighted: number;
  optionId: (index: number) => string;
  onHighlight: (index: number) => void;
  onChoose: (result: GeocodingResult) => void;
}

function PlaceListbox({
  id,
  label,
  results,
  selectedPlaceId,
  highlighted,
  optionId,
  onHighlight,
  onChoose,
}: PlaceListboxProps) {
  return (
    <Listbox id={id} label={label} className="gap-0.5">
      {results.map((result, index) => {
        const { place, region } = splitPlace(result.displayName);
        return (
          <ComboOption
            key={result.placeId}
            id={optionId(index)}
            label={place}
            secondary={region}
            selected={selectedPlaceId === result.placeId}
            highlighted={highlighted === index}
            onChoose={() => onChoose(result)}
            onHighlight={() => onHighlight(index)}
          />
        );
      })}
    </Listbox>
  );
}

interface PlaceFieldProps {
  value: ShownPlace | null;
  onSelect: (location: SelectedLocation) => void;
  /**
   * The × «Borrar texto» pressed while the field reads «Tu ubicación»: the
   * «BUSCAR» sheet clears the position with it (MAP-32). Left out, the × only
   * clears the text, as in the desktop popover.
   */
  onClearPosition?: () => void;
}

interface PlaceStatusState {
  loading: boolean;
  down: boolean;
  noMatch: boolean;
  searched: boolean;
  resultCount: number;
}

/**
 * Empty, then «Cargando…» while the debounced search runs, then the result
 * count, the no-match line or the search-down line (MAP-20, MAPUI-56).
 */
function placeStatusText(
  { loading, down, noMatch, searched, resultCount }: PlaceStatusState,
  t: ReturnType<typeof useTranslations>,
): string {
  if (loading) return t("map.loading");
  if (down) return t("search.placeSearchDown");
  if (noMatch) return t("search.noPlace");
  if (searched) return t("search.results", { count: resultCount });
  return "";
}

export function PlaceField({ value, onSelect, onClearPosition }: PlaceFieldProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { query, setQuery, results, isSearching, failed, clear } = useLocationSearch(locale);
  // While editing, the field shows what is typed; otherwise the chosen place,
  // or «Tu ubicación» while the browser's position stands in for one (MAP-32).
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const searching = editing && query.length >= 2;
  const loading = searching && isSearching;
  const searched = searching && !isSearching;
  // MAPUI-56: a failed search never reads as "no place by that name" — the
  // place search being down is a different message, never shown alongside it.
  const noMatch = searched && !failed && results.length === 0;
  const down = searched && failed;
  const navigation = useOptionNavigation(searched && !down ? results.length : 0, (index) => {
    const result = results[index];
    if (result) choose(result);
  });
  const { highlighted, setHighlighted, open: listed, listboxId } = navigation;

  const statusText = placeStatusText(
    { loading, down, noMatch, searched, resultCount: results.length },
    t,
  );

  function choose(result: GeocodingResult) {
    onSelect({
      placeId: result.placeId,
      displayName: splitPlace(result.displayName).place,
      lat: result.lat,
      lng: result.lng,
    });
    setEditing(false);
    navigation.reset();
    clear();
  }

  return (
    <div ref={navigation.containerRef} className="flex flex-col gap-2">
      <SearchField
        ref={inputRef}
        name="place"
        aria-label={t("search.whereLabel")}
        placeholder={t("search.wherePlaceholder")}
        expanded={listed}
        aria-controls={listed ? listboxId : undefined}
        aria-activedescendant={navigation.activeDescendant}
        value={editing ? query : (value?.displayName ?? "")}
        onValueChange={(text) => {
          setEditing(true);
          navigation.reset();
          setQuery(text);
        }}
        onClearText={() => {
          if (!editing && value && !isSelectedLocation(value)) onClearPosition?.();
          setEditing(true);
          navigation.reset();
          clear();
          inputRef.current?.focus();
        }}
        onBlur={() => {
          if (query === "") setEditing(false);
        }}
        onKeyDown={navigation.onKeyDown}
      />
      {listed && (
        <PlaceListbox
          id={listboxId}
          label={t("search.places")}
          results={results}
          selectedPlaceId={value?.placeId}
          highlighted={highlighted}
          optionId={navigation.optionId}
          onHighlight={setHighlighted}
          onChoose={choose}
        />
      )}
      {down && <NoMatch>{t("search.placeSearchDown")}</NoMatch>}
      {noMatch && <NoMatch>{t("search.noPlace")}</NoMatch>}
      <ListStatus>{statusText}</ListStatus>
    </div>
  );
}
