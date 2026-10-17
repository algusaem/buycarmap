import { fold } from "@/lib/search/fold";

// docs/specs/redesign-map.md (MAPUI-6). Matches text typed into "Coche"
// against a list of names, locally and with no network call: the fixed
// 35-brand list (components/map/search-filter-options.ts's BRANDS) for the
// "Marcas" group, and a brand's models in its brand step (MAPUI-7).
// A name matches when it, or any one word of it, starts with the query,
// ignoring case and accented letters ("Citroën" matches "citroen").
// It returns every match, in the list's order; the ">3 matches, no models"
// rule is the type-ahead's job.

/** The name and each of its words, split on spaces and hyphens («Mercedes-Benz» → «benz»). */
function startsOfName(name: string): string[] {
  const folded = fold(name);
  return [folded, ...folded.split(/[\s-]+/)];
}

export function matchNames(query: string, names: readonly string[]): string[] {
  const needle = fold(query.trim());
  if (!needle) return [];

  return names.filter((name) => startsOfName(name).some((start) => start.startsWith(needle)));
}
