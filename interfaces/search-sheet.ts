import type { SearchInput } from "@/lib/search/schema";
import type { SelectedLocation } from "@/interfaces/location";

/** What «Ver coches» hands over: the edited criteria and the place, `null` for «Toda España». */
export interface SheetSearch extends SearchInput {
  place: SelectedLocation | null;
}
