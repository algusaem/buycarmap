import { CarListing } from "./listing";
import { SearchInput } from "@/lib/validations/search";

/** One row on the alerts page: the saved search, and how it is doing. */
export interface AlertSummary {
  id: string;
  label: string;
  criteria: SearchInput;
  matchCount: number;
  active: boolean;
}

/**
 * A listing an alert found, as the matches page renders it.
 *
 * `foundAt` is the discovery time rather than the listing's publish date —
 * no source exposes one, which is the reason the seen-list exists at all.
 */
export interface AlertMatch extends CarListing {
  foundAt: Date;
}
