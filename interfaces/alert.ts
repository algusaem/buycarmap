import type { CarListing } from "./listing";
import type { SearchInput } from "@/server/search/schema";

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

/** What one invocation of the alert cron (`app/api/alerts/run/route.ts`) did. */
export interface RunSummary {
  claimed: number;
  polled: number;
  matched: number;
  emailed: number;
  skippedNoEmail: number;
  criteriaCount: number;
  intervalMs: number;
  oldestPendingAgeMs: number;
  /**
   * Sources that have returned nothing for several consecutive runs.
   *
   * Surfaced in the response rather than left in the table, because the failure
   * this guards against is silent by construction: nobody goes looking for a
   * source that has quietly stopped parsing.
   */
  unhealthySources: string[];
  failures: string[];
}
