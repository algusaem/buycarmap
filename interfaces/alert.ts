import type { CarListing } from "./listing";
import type { AlertId } from "@/lib/ids";
import type { SearchInput } from "@/lib/search/schema";

/** One row on the alerts page: the saved search, and how it is doing. */
export interface AlertSummary {
  id: AlertId;
  label: string;
  /** The place chosen in «Dónde» when the alert was created (ALERTUI-46); null before F6 or with none. */
  placeName: string | null;
  criteria: SearchInput;
  matchCount: number;
  active: boolean;
  createdAt: Date;
}

/**
 * What the /alerts page reads (docs/specs/redesign-alerts.md, ALERTUI-44): the
 * caller's alerts, newest first, the open alert resolved on the server
 * (ALERTUI-12), and that one alert's matches, newest first.
 */
export interface AlertsPageData {
  alerts: AlertSummary[];
  openAlertId: AlertId | null;
  matches: CarListing[];
}

/** One alert and every match it found, as /alerts/[id] renders it (ALERTUI-20, ALERTUI-22, ALERTUI-45). */
export interface AlertWithMatches extends Omit<AlertSummary, "matchCount"> {
  matches: CarListing[];
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
  /**
   * The "nothing due" gate stopped the run before the database
   * (docs/specs/alerts.md, ALERT-51): every count is zero because nothing was
   * read.
   */
  nothingDue: boolean;
}
