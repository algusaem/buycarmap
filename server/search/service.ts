import type { CarListing } from "@/interfaces/listing";
import type { WallapopSearchResponse, WallapopFilterResponse } from "@/interfaces/wallapop";
import type { CochesNetSearchResponse, CochesNetTaxonomyResponse } from "@/interfaces/cochesnet";
import type { MilanunciosSearchResponse } from "@/interfaces/milanuncios";
import type { SearchInput } from "@/lib/search/schema";
import { env } from "@/lib/env";
import { buildWallapopQuery } from "@/lib/wallapop/client";
import { normalizeWallapopItems } from "@/lib/wallapop/normalize";
import { buildCochesNetFilters } from "@/lib/cochesnet/client";
import { normalizeCochesNetItems } from "@/lib/cochesnet/normalize";
import { mapBrandToMakeId } from "@/lib/cochesnet/taxonomy";
import { buildMilanunciosQuery } from "@/lib/milanuncios/client";
import { normalizeMilanunciosItems } from "@/lib/milanuncios/normalize";
import { extractInitialProps } from "@/lib/milanuncios/parse";
import { ALL_CARS_SLUG } from "@/lib/milanuncios/taxonomy";
import { interleave } from "@/lib/listings/merge";
import { EMPTY_SEARCH_CURSORS, type SearchCursors } from "./schema";

// FRONT-1 (docs/specs/core-frontend.md): the only server-side search fan-out.
// One call runs Wallapop, coches.net and Milanuncios in parallel, reusing the
// upstream query builders in lib/*/client.ts, and reports each source's next
// cursor, has-more flag and whether it failed — so a failing source does not
// fail the round. Shared by the interactive search (server/search/actions.ts)
// and the alert runner (server/alerts/search.ts), which is the one fan-out
// FRONT-6 asks for.

export type SearchSourceName = "Wallapop" | "Coches.net" | "Milanuncios";

// SearchCursors and EMPTY_SEARCH_CURSORS live in ./schema (not here) so
// lib/hooks/useListingsSearch.ts can import them without crossing
// dependency-cruiser's `hooks-only-actions-or-schema` boundary (LAYOUT-6);
// re-exported so every other caller can keep importing them from this module.
export { EMPTY_SEARCH_CURSORS, type SearchCursors };

export interface SearchRound {
  listings: CarListing[];
  cursors: SearchCursors;
  hasMore: Record<SearchSourceName, boolean>;
  failedSources: SearchSourceName[];
}

export interface SearchRoundOptions {
  /**
   * Overrides Wallapop's `order_by`. The alert runner forces `"newest"` even
   * with a location set — relevance is the right ranking for a human reading
   * a list, but a poller that only ever reads page one needs the newest
   * listings at the top or it never sees them (docs/specs/alerts.md).
   */
  wallapopOrderBy?: string;
  /**
   * Overrides coches.net's sort term (default `"relevance"`, matching the
   * interactive search). The alert runner asks for `"publishedDate"` for the
   * same reason as `wallapopOrderBy`.
   */
  cochesNetSortTerm?: string;
}

// Center of Spain. Coordinates are always sent, even with no location chosen,
// because otherwise Wallapop geo-filters by the caller's IP — and on Vercel
// that is a US datacenter, which returns US listings (CLAUDE.md › Upstream
// sources).
const SPAIN_CENTER = { lat: 40.0, lng: -3.5 };

// Base URLs come from lib/env.ts (FRONT-22): default to the real hosts, and
// only ever overridden in e2e, which points them at the local mock upstream
// server (e2e/fixtures/upstream-server.ts). lib/env.ts's zod `.default()`
// only applies when t3-env actually validates — `SKIP_ENV_VALIDATION` (set by
// `pnpm lint`'s cross-env calls, and liable to leak into a later command in
// the same shell on Windows) makes it return the raw environment values
// unvalidated instead, so `env.*` can be `undefined` here even though its
// declared type says `string`. These real-host constants are the same
// fallback, applied again at the point of use so a skipped validation never
// turns into `new URL(undefined)`.
const DEFAULT_WALLAPOP_API_BASE_URL = "https://api.wallapop.com";
const DEFAULT_COCHESNET_API_BASE_URL = "https://web.gw.coches.net";
const DEFAULT_MILANUNCIOS_BASE_URL = "https://www.milanuncios.com";

const WALLAPOP_API_BASE_URL = env.WALLAPOP_API_BASE_URL ?? DEFAULT_WALLAPOP_API_BASE_URL;
const COCHESNET_API_BASE_URL = env.COCHESNET_API_BASE_URL ?? DEFAULT_COCHESNET_API_BASE_URL;
const MILANUNCIOS_BASE_URL = env.MILANUNCIOS_BASE_URL ?? DEFAULT_MILANUNCIOS_BASE_URL;

const WALLAPOP_URL = `${WALLAPOP_API_BASE_URL}/api/v3/search/section`;
const WALLAPOP_MODELS_URL = `${WALLAPOP_API_BASE_URL}/api/v3/search/filters/model`;
const COCHESNET_SEARCH_URL = `${COCHESNET_API_BASE_URL}/search/listing`;
const COCHESNET_MODELS_URL = `${COCHESNET_API_BASE_URL}/models`;
const MILANUNCIOS_BASE = MILANUNCIOS_BASE_URL;

const COCHESNET_PAGE_SIZE = 40;
const REQUEST_TIMEOUT_MS = 15_000;

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

function hasExplicitLocation(input: SearchInput): boolean {
  return input.latitude != null && input.longitude != null;
}

async function fetchWallapopPage(
  input: SearchInput,
  nextPage: string | undefined,
  orderBy: string | undefined,
): Promise<WallapopSearchResponse> {
  const located = hasExplicitLocation(input);
  const query = buildWallapopQuery(input, {
    lat: input.latitude ?? SPAIN_CENTER.lat,
    lng: input.longitude ?? SPAIN_CENTER.lng,
    distance: located ? input.distanceInKm : 1000,
    orderBy,
    nextPage,
  });

  return fetchJson<WallapopSearchResponse>(`${WALLAPOP_URL}?${query.toString()}`, {
    headers: {
      Accept: "application/json",
      "x-deviceos": "0",
      "x-appversion": "85000",
    },
  });
}

/**
 * Server-side model-name resolution for coches.net: the shared filter stores
 * the model as a name, coches.net needs its numeric modelId. Falls back to
 * make-only filtering when the name has no exact match, or when the taxonomy
 * call itself fails — losing the model filter degrades the round rather than
 * failing the whole source.
 */
async function resolveCochesNetModelId(
  makeId: number,
  modelName: string,
): Promise<number | undefined> {
  try {
    const data = await fetchJson<CochesNetTaxonomyResponse>(
      `${COCHESNET_MODELS_URL}?makeId=${makeId}`,
      { headers: { Accept: "application/json", "X-Schibsted-Tenant": "coches" } },
    );
    const target = modelName.toLowerCase().trim();
    return (data.items ?? []).find((option) => option.label.toLowerCase().trim() === target)?.id;
  } catch {
    return undefined;
  }
}

async function fetchCochesNetPage(
  input: SearchInput,
  page: number,
  sortTerm: string,
): Promise<CochesNetSearchResponse> {
  const filters = buildCochesNetFilters(input);

  if (input.brand && input.model) {
    const makeId = mapBrandToMakeId(input.brand);
    if (makeId !== undefined) {
      const modelId = await resolveCochesNetModelId(makeId, input.model);
      filters.vehicles = [{ makeId, ...(modelId ? { modelId } : {}) }];
    }
  }

  return fetchJson<CochesNetSearchResponse>(COCHESNET_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Schibsted-Tenant": "coches",
    },
    body: JSON.stringify({
      pagination: { page, size: COCHESNET_PAGE_SIZE },
      sort: { order: "desc", term: sortTerm },
      filters,
    }),
  });
}

async function fetchMilanunciosPage(
  input: SearchInput,
  page: number,
): Promise<MilanunciosSearchResponse> {
  const query = buildMilanunciosQuery(input, page);
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

  return extractInitialProps(await response.text()) as MilanunciosSearchResponse;
}

/** True only for the very first round: nothing consumed yet from any source. */
function isInitialRound(cursors: SearchCursors): boolean {
  return cursors.wallapop === null && cursors.cochesNet === 0 && cursors.milanuncios === 0;
}

interface SourceOutcome<T> {
  requested: boolean;
  data: T | null;
  failed: boolean;
}

async function runWallapop(
  input: SearchInput,
  cursors: SearchCursors,
  initial: boolean,
  orderBy: string | undefined,
): Promise<SourceOutcome<WallapopSearchResponse>> {
  const requested = initial || cursors.wallapop !== null;
  if (!requested) return { requested, data: null, failed: false };

  try {
    const data = await fetchWallapopPage(input, cursors.wallapop ?? undefined, orderBy);
    return { requested, data, failed: false };
  } catch {
    return { requested, data: null, failed: true };
  }
}

async function runCochesNet(
  input: SearchInput,
  cursors: SearchCursors,
  sortTerm: string,
): Promise<SourceOutcome<CochesNetSearchResponse>> {
  try {
    const data = await fetchCochesNetPage(input, cursors.cochesNet + 1, sortTerm);
    return { requested: true, data, failed: false };
  } catch {
    return { requested: true, data: null, failed: true };
  }
}

async function runMilanuncios(
  input: SearchInput,
  cursors: SearchCursors,
): Promise<SourceOutcome<MilanunciosSearchResponse>> {
  try {
    const data = await fetchMilanunciosPage(input, cursors.milanuncios + 1);
    return { requested: true, data, failed: false };
  } catch {
    return { requested: true, data: null, failed: true };
  }
}

function collectFailedSources(
  wallapop: SourceOutcome<WallapopSearchResponse>,
  cochesNet: SourceOutcome<CochesNetSearchResponse>,
  milanuncios: SourceOutcome<MilanunciosSearchResponse>,
): SearchSourceName[] {
  const failedSources: SearchSourceName[] = [];
  if (wallapop.requested && wallapop.failed) failedSources.push("Wallapop");
  if (cochesNet.failed) failedSources.push("Coches.net");
  if (milanuncios.failed) failedSources.push("Milanuncios");
  return failedSources;
}

// MAP-24 (docs/specs/map-and-search.md › A repeated Wallapop cursor ends
// Wallapop): coches.net and Milanuncios page by number, incremented here, so
// they advance by construction. Wallapop pages by an opaque next_page cursor
// stored as given, so nothing guarantees it advances — a cursor already
// requested, directly or after a cycle, means Wallapop has nothing further
// for this search.
function nextWallapopCursor(
  cursors: SearchCursors,
  wallapop: SourceOutcome<WallapopSearchResponse>,
): { wallapop: string | null; wallapopRequested: string[] } {
  // Not requested, or the request failed: cursor and history both untouched,
  // so a retry asks for the same page with the same history (FRONT-1).
  if (!wallapop.requested || wallapop.failed) {
    return { wallapop: cursors.wallapop, wallapopRequested: cursors.wallapopRequested };
  }

  // The first round requests no specific cursor, so it has nothing to add to
  // the history and cannot repeat.
  const requestedCursor = cursors.wallapop;
  const wallapopRequested =
    requestedCursor === null
      ? cursors.wallapopRequested
      : [...cursors.wallapopRequested, requestedCursor];

  const returned = wallapop.data?.meta?.next_page ?? null;
  const repeated = returned !== null && wallapopRequested.includes(returned);

  return { wallapop: repeated ? null : returned, wallapopRequested };
}

function nextCursors(
  cursors: SearchCursors,
  wallapop: SourceOutcome<WallapopSearchResponse>,
  cochesNet: SourceOutcome<CochesNetSearchResponse>,
  milanuncios: SourceOutcome<MilanunciosSearchResponse>,
): SearchCursors {
  // A failed request leaves its cursor untouched, so a retry asks for the
  // same page again rather than skipping ahead (FRONT-1).
  const { wallapop: wallapopNext, wallapopRequested } = nextWallapopCursor(cursors, wallapop);

  return {
    wallapop: wallapopNext,
    wallapopRequested,
    cochesNet: cochesNet.failed ? cursors.cochesNet : cursors.cochesNet + 1,
    milanuncios: milanuncios.failed ? cursors.milanuncios : cursors.milanuncios + 1,
  };
}

// A failed source reports no further pages this round, so the caller's
// automatic pagination loop (MAP-19) stops rather than retrying a broken
// source forever; its unchanged cursor still lets an explicit retry (the
// next manual search, or FRONT-14's Retry button) ask again.
function roundHasMore(
  next: SearchCursors,
  wallapop: SourceOutcome<WallapopSearchResponse>,
  cochesNet: SourceOutcome<CochesNetSearchResponse>,
  milanuncios: SourceOutcome<MilanunciosSearchResponse>,
): Record<SearchSourceName, boolean> {
  return {
    Wallapop: wallapop.failed ? false : next.wallapop !== null,
    "Coches.net":
      !cochesNet.failed &&
      (cochesNet.data?.items.length ?? 0) > 0 &&
      next.cochesNet < (cochesNet.data?.meta?.totalPages ?? 1),
    Milanuncios:
      !milanuncios.failed &&
      (milanuncios.data?.ads.length ?? 0) > 0 &&
      next.milanuncios < (milanuncios.data?.pagination?.totalPages ?? 1),
  };
}

/**
 * Runs one search round: Wallapop, coches.net and Milanuncios in parallel,
 * from the server. Wallapop coordinates are always sent (CLAUDE.md › Upstream
 * sources), and a failing source is reported in `failedSources` with its
 * cursor left unchanged, rather than failing the whole round.
 */
export async function searchRound(
  input: SearchInput,
  cursors: SearchCursors,
  options: SearchRoundOptions = {},
): Promise<SearchRound> {
  const initial = isInitialRound(cursors);
  const cochesNetSortTerm = options.cochesNetSortTerm ?? "relevance";

  const [wallapop, cochesNet, milanuncios] = await Promise.all([
    runWallapop(input, cursors, initial, options.wallapopOrderBy),
    runCochesNet(input, cursors, cochesNetSortTerm),
    runMilanuncios(input, cursors),
  ]);

  const wallapopItems = wallapop.data
    ? normalizeWallapopItems(wallapop.data.data?.section?.items ?? [])
    : [];
  const cochesNetItems = cochesNet.data ? normalizeCochesNetItems(cochesNet.data.items ?? []) : [];
  const milanunciosItems = milanuncios.data
    ? normalizeMilanunciosItems(milanuncios.data.ads ?? [])
    : [];

  const listings = interleave([wallapopItems, cochesNetItems, milanunciosItems]);
  const next = nextCursors(cursors, wallapop, cochesNet, milanuncios);

  return {
    listings,
    cursors: next,
    hasMore: roundHasMore(next, wallapop, cochesNet, milanuncios),
    failedSources: collectFailedSources(wallapop, cochesNet, milanuncios),
  };
}

/** A merged model option: the shape `listCarModels` hands back to the client. */
export interface SearchModel {
  id: string;
  label: string;
}

/**
 * The merged Wallapop and coches.net models for a make, resolved directly
 * against both upstreams (there is no proxy to call any more, FRONT-5).
 *
 * SRC-10: the old proxy answered 400 rather than contacting the upstream
 * when its required parameter was missing; an empty make is the equivalent
 * case here, and gets the equivalent treatment — no upstream request.
 */
export async function fetchModelsForMake(make: string): Promise<SearchModel[]> {
  if (!make) return [];

  const wallapopUrl = new URL(WALLAPOP_MODELS_URL);
  wallapopUrl.searchParams.set("category_id", "100");
  wallapopUrl.searchParams.set("brand", make);

  const wallapopPromise = fetchJson<WallapopFilterResponse>(wallapopUrl.toString(), {
    headers: {
      Accept: "application/json",
      "x-deviceos": "0",
      "x-appversion": "85000",
    },
  }).catch(() => null);

  const makeId = mapBrandToMakeId(make);
  const cochesNetPromise = makeId
    ? fetchJson<CochesNetTaxonomyResponse>(`${COCHESNET_MODELS_URL}?makeId=${makeId}`, {
        headers: { Accept: "application/json", "X-Schibsted-Tenant": "coches" },
      }).catch(() => null)
    : Promise.resolve(null);

  const [wallapopData, cochesNetData] = await Promise.all([wallapopPromise, cochesNetPromise]);

  const wallapopModels: SearchModel[] = (wallapopData?.options ?? []).map((option) => ({
    id: option.id,
    label: option.title,
  }));
  const cochesNetModels: SearchModel[] = (cochesNetData?.items ?? []).map((item) => ({
    id: String(item.id),
    label: item.label,
  }));

  return [...wallapopModels, ...cochesNetModels];
}
