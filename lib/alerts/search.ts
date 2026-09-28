import type { CarListing } from "@/interfaces/listing";
import type { WallapopSearchResponse } from "@/interfaces/wallapop";
import type { CochesNetSearchResponse, CochesNetTaxonomyResponse } from "@/interfaces/cochesnet";
import type { MilanunciosSearchResponse } from "@/interfaces/milanuncios";
import type { SearchInput } from "@/lib/validations/search";
import { buildWallapopQuery } from "@/lib/wallapop/client";
import { normalizeWallapopItems } from "@/lib/wallapop/normalize";
import { buildCochesNetFilters } from "@/lib/cochesnet/client";
import { normalizeCochesNetItems } from "@/lib/cochesnet/normalize";
import { mapBrandToMakeId } from "@/lib/cochesnet/taxonomy";
import { buildMilanunciosQuery } from "@/lib/milanuncios/client";
import { normalizeMilanunciosItems } from "@/lib/milanuncios/normalize";
import { extractInitialProps } from "@/lib/milanuncios/parse";
import { ALL_CARS_SLUG } from "@/lib/milanuncios/taxonomy";

// The alert runner's own path to the three upstreams.
//
// It cannot use lib/*/client.ts: those resolve their URL against
// `window.location.origin` and call the proxy routes, which is exactly what
// those routes exist for. A cron has no window and no origin, so this module
// calls the upstreams directly with the same headers app/api/*/route.ts sends —
// reusing each client's exported query builder so the filter translation stays
// in one place.
//
// See docs/specs/alerts.md §5.

const WALLAPOP_URL = "https://api.wallapop.com/api/v3/search/section";
const COCHESNET_SEARCH_URL = "https://web.gw.coches.net/search/listing";
const COCHESNET_MODELS_URL = "https://web.gw.coches.net/models";
const MILANUNCIOS_BASE = "https://www.milanuncios.com";

const COCHESNET_PAGE_SIZE = 40;
const REQUEST_TIMEOUT_MS = 15_000;

// Center of Spain. Coordinates are always sent, even with no location chosen,
// because otherwise Wallapop geo-filters by the caller's IP — and on Vercel
// that is a US datacenter, which returns US listings.
const SPAIN_CENTER = { lat: 40.0, lng: -3.5 };

export interface AlertSearchResult {
  listings: CarListing[];
  /**
   * Sources whose request failed. Nothing from these is recorded as seen — if
   * a failed source were treated as polled, listings that appeared during the
   * outage would never be new again (ALERT-17).
   */
  failedSources: string[];
  /**
   * Per-source counts, before merging. After merging, "Milanuncios returned
   * nothing" and "Milanuncios is quietly broken" are indistinguishable, and a
   * Milanuncios parse failure returns zero ads rather than an error (ALERT-20).
   */
  perSourceCounts: Record<string, number>;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function searchWallapopUpstream(criteria: SearchInput): Promise<CarListing[]> {
  const query = buildWallapopQuery(criteria, {
    lat: criteria.latitude ?? SPAIN_CENTER.lat,
    lng: criteria.longitude ?? SPAIN_CENTER.lng,
    distance:
      criteria.latitude != null && criteria.longitude != null ? criteria.distanceInKm : 1000,
    // Forced, unlike the interactive path. Relevance ranks better for a human
    // reading a list; an alert polling page one needs the newest at the top or
    // it never sees them.
    orderBy: "newest",
  });
  // Narrows the page to today's listings, which is as close to "recent" as any
  // of the three gets. Wallapop is the only source that honours it.
  if (!criteria.timeFilter) query.set("time_filter", "today");

  const data = await fetchJson<WallapopSearchResponse>(`${WALLAPOP_URL}?${query.toString()}`, {
    headers: {
      Accept: "application/json",
      "x-deviceos": "0",
      "x-appversion": "85000",
    },
  });
  return normalizeWallapopItems(data.data?.section?.items ?? []);
}

/**
 * Server-side model resolution.
 *
 * `lib/cochesnet/models.ts` does this in the browser against the proxy route
 * and caches per session; here there is no session and no origin, so it goes
 * straight to the taxonomy API. Falls back to make-only filtering, exactly as
 * the browser path does when a name has no exact match.
 */
async function resolveModelId(makeId: number, modelName: string): Promise<number | undefined> {
  try {
    const data = await fetchJson<CochesNetTaxonomyResponse>(
      `${COCHESNET_MODELS_URL}?makeId=${makeId}`,
      { headers: { Accept: "application/json", "X-Schibsted-Tenant": "coches" } },
    );
    const target = modelName.toLowerCase().trim();
    return (data.items ?? []).find((option) => option.label.toLowerCase().trim() === target)?.id;
  } catch {
    // Model filtering is a refinement; losing it degrades the poll to
    // make-only rather than failing the source outright.
    return undefined;
  }
}

async function searchCochesNetUpstream(criteria: SearchInput): Promise<CarListing[]> {
  const filters = buildCochesNetFilters(criteria);

  if (criteria.brand && criteria.model) {
    const makeId = mapBrandToMakeId(criteria.brand);
    if (makeId !== undefined) {
      const modelId = await resolveModelId(makeId, criteria.model);
      filters.vehicles = [{ makeId, ...(modelId ? { modelId } : {}) }];
    }
  }

  const data = await fetchJson<CochesNetSearchResponse>(COCHESNET_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Schibsted-Tenant": "coches",
    },
    body: JSON.stringify({
      pagination: { page: 1, size: COCHESNET_PAGE_SIZE },
      // Publication date rather than the site's relevance default: an alert
      // needs the newest first, and this is the coches.net equivalent of the
      // ordering forced on Wallapop above.
      sort: { order: "desc", term: "publishedDate" },
      filters,
    }),
  });
  return normalizeCochesNetItems(data.items ?? []);
}

async function searchMilanunciosUpstream(criteria: SearchInput): Promise<CarListing[]> {
  const query = buildMilanunciosQuery(criteria, 1);
  const slug = query.get("slug") || ALL_CARS_SLUG;
  query.delete("slug");

  const url = new URL(`${MILANUNCIOS_BASE}/${slug}/`);
  url.search = query.toString();

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Milanuncios responded ${response.status}`);
  }

  const parsed = extractInitialProps(await response.text()) as MilanunciosSearchResponse;
  return normalizeMilanunciosItems(parsed.ads ?? []);
}

/**
 * Polls all three sources for one criteria set.
 *
 * Partial failure is the normal case, not an outage — three reverse-engineered
 * upstreams means one being unavailable is a Tuesday. Unlike the interactive
 * search, which merely renders fewer results, the alert path has to know
 * *which* source failed so the seen-list is only advanced for the ones that
 * answered.
 */
export async function searchAllSources(criteria: SearchInput): Promise<AlertSearchResult> {
  const searches = [
    { source: "Wallapop", run: () => searchWallapopUpstream(criteria) },
    { source: "Coches.net", run: () => searchCochesNetUpstream(criteria) },
    { source: "Milanuncios", run: () => searchMilanunciosUpstream(criteria) },
  ];

  const settled = await Promise.allSettled(searches.map(({ run }) => run()));

  const listings: CarListing[] = [];
  const failedSources: string[] = [];
  const perSourceCounts: Record<string, number> = {};

  settled.forEach((outcome, index) => {
    const { source } = searches[index];
    if (outcome.status === "rejected") {
      failedSources.push(source);
      return;
    }
    perSourceCounts[source] = outcome.value.length;
    listings.push(...outcome.value);
  });

  // Every source failing is the one case the caller must treat as "no
  // information", not "nothing new" — otherwise a total outage silently
  // advances nothing while looking like a successful empty poll.
  if (failedSources.length === searches.length) {
    throw new Error(`every source failed: ${failedSources.join(", ")}`);
  }

  return { listings, failedSources, perSourceCounts };
}
