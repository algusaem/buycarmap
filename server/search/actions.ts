"use server";

import type { AppError, Result } from "@/lib/result";
import { ok, err } from "@/lib/result";
import { searchSchema, type SearchInput } from "@/lib/search/schema";
import { applyResultFilters } from "@/lib/listings/merge";
import { withRequestContext } from "@/lib/request-context";
import { consumeRateLimit, getClientIp } from "@/server/rate-limit/service";
import { searchCursorsSchema, type SearchCursors } from "./schema";
import { fetchModelsForMake, searchRound, type SearchRound } from "./service";

// FRONT-2/FRONT-4 (docs/specs/core-frontend.md): the public Server Actions
// the client calls instead of the five proxy routes FRONT-5 removes.

// Not exported: a `"use server"` file may only export async functions, and
// nothing outside this file needs the raw codes (SearchErrorCode/SearchError
// below are the exported, type-only surface).
const SEARCH_ERROR = {
  rateLimited: "rateLimited",
  invalidInput: "invalidInput",
} as const;

type SearchErrorCode = (typeof SEARCH_ERROR)[keyof typeof SEARCH_ERROR];
export type SearchError = AppError<SearchErrorCode>;

const SEARCH_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

/** A merged model option, the shape `listCarModels` hands back to the client. */
export interface CarModel {
  id: string;
  label: string;
}

/**
 * Validates `input` with `lib/search/schema.ts` and `cursors` with
 * `server/search/schema.ts`, calls `searchRound` once, and returns the
 * round's listings after the merge post-filters (`lib/listings/merge.ts`),
 * the next cursors and the failed sources. Rate-limited per client IP through
 * `server/rate-limit/service.ts` at 120 rounds per minute.
 */
export async function searchListings(
  input: SearchInput,
  cursors: SearchCursors,
): Promise<Result<SearchRound, SearchError>> {
  return withRequestContext(async () => {
    const parsedInput = searchSchema.safeParse(input);
    const parsedCursors = searchCursorsSchema.safeParse(cursors);
    if (!parsedInput.success || !parsedCursors.success) {
      return err({ code: SEARCH_ERROR.invalidInput, messageKey: "searchErrors.invalidInput" });
    }

    const ip = await getClientIp();
    const limit = await consumeRateLimit(`search:${ip}`, SEARCH_RATE_LIMIT);
    if (!limit.allowed) {
      return err({ code: SEARCH_ERROR.rateLimited, messageKey: "searchErrors.rateLimited" });
    }

    const round = await searchRound(parsedInput.data, parsedCursors.data);
    const listings = applyResultFilters(round.listings, parsedInput.data);

    return ok({ ...round, listings });
  });
}

/**
 * The merged Wallapop and coches.net models for a make.
 */
export async function listCarModels(make: string): Promise<Result<CarModel[], SearchError>> {
  return withRequestContext(async () => {
    const models = await fetchModelsForMake(make);
    return ok(models);
  });
}
