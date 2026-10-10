import { z } from "zod";

// MAP-27 (docs/specs/map-and-search.md): the radius lib/hooks/useSearchFilters.ts's
// filter panel defaults to, and the one `searchSchema` falls back to below
// when coordinates are given but no radius is.
export const DEFAULT_RADIUS_KM = 50;

const baseSearchSchema = z.object({
  keywords: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  distanceInKm: z.number().positive().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().positive().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  minYear: z.number().int().min(1900).optional(),
  maxYear: z.number().int().optional(),
  minKm: z.number().nonnegative().optional(),
  maxKm: z.number().positive().optional(),
  minHorsePower: z.number().nonnegative().optional(),
  maxHorsePower: z.number().positive().optional(),
  engine: z.array(z.string()).optional(),
  gearbox: z.array(z.string()).optional(),
  timeFilter: z.enum(["today", "lastWeek", "lastMonth"]).optional(),
});

export type SearchInput = z.infer<typeof baseSearchSchema>;

// MAP-27: a search that carries coordinates but no `distanceInKm` is searched
// within DEFAULT_RADIUS_KM of them instead of unbounded, so the radius
// post-filter (lib/geo/radius.ts) and every source's query (e.g. Wallapop's
// `distance_in_km`, server/search/service.ts) respect it as if the caller had
// sent it. A search with no coordinates still gets no radius (MAP-13
// unchanged). `searchSchema` is where the interactive search
// (server/search/actions.ts) and the stored alert criteria
// (server/alerts/schema.ts's `parseStoredCriteria`,
// server/alerts/actions.ts's `createAlert`) alike parse their input, so both
// get the default from this one change.
export const searchSchema = baseSearchSchema.transform((data): SearchInput => {
  if (data.latitude != null && data.longitude != null && data.distanceInKm === undefined) {
    return { ...data, distanceInKm: DEFAULT_RADIUS_KM };
  }
  return data;
});
