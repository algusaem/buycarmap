import type { CochesNetSearchResponse } from "@/interfaces/cochesnet";
import type { SearchInput } from "@/lib/validations/search";
import {
  mapBrandToMakeId,
  mapFuelTokensToIds,
  mapTransmissionTokensToId,
} from "@/lib/cochesnet/taxonomy";
import { resolveCochesNetModelId } from "@/lib/cochesnet/models";

const BASE_URL = "/api/cochesnet/search";

const COCHESNET_PAGE_SIZE = 40;

interface Range {
  from: number | null;
  to: number | null;
}

export interface CochesNetFilters {
  searchText?: string;
  price?: Range;
  year?: Range;
  km?: Range;
  hp?: Range;
  fuelTypeIds?: number[];
  transmissionTypeId?: number;
  vehicles?: { makeId: number; modelId?: number }[];
}

function addPriceAndYearFilters(params: SearchInput, filters: CochesNetFilters): void {
  if (params.minPrice != null || params.maxPrice != null) {
    filters.price = { from: params.minPrice ?? null, to: params.maxPrice ?? null };
  }
  if (params.minYear != null || params.maxYear != null) {
    filters.year = { from: params.minYear ?? null, to: params.maxYear ?? null };
  }
}

function addKmAndHorsePowerFilters(params: SearchInput, filters: CochesNetFilters): void {
  if (params.minKm != null || params.maxKm != null) {
    filters.km = { from: params.minKm ?? null, to: params.maxKm ?? null };
  }
  if (params.minHorsePower != null || params.maxHorsePower != null) {
    filters.hp = {
      from: params.minHorsePower ?? null,
      to: params.maxHorsePower ?? null,
    };
  }
}

function addFuelAndTransmissionFilters(params: SearchInput, filters: CochesNetFilters): void {
  if (params.engine?.length) {
    const ids = mapFuelTokensToIds(params.engine);
    if (ids.length) filters.fuelTypeIds = ids;
  }
  if (params.gearbox?.length) {
    const id = mapTransmissionTokensToId(params.gearbox);
    if (id !== undefined) filters.transmissionTypeId = id;
  }
}

function addVehicleFilter(params: SearchInput, filters: CochesNetFilters): void {
  if (params.brand) {
    const makeId = mapBrandToMakeId(params.brand);
    if (makeId !== undefined) filters.vehicles = [{ makeId }];
  }
}

// coches.net's `time_filter` equivalent isn't wired; recency is left to the
// site default ordering. Location is province/name based on their side, so we
// don't send lat/lng — the map geocodes results client-side instead.
export function buildCochesNetFilters(params: SearchInput): CochesNetFilters {
  const filters: CochesNetFilters = {};

  if (params.keywords) filters.searchText = params.keywords;

  addPriceAndYearFilters(params, filters);
  addKmAndHorsePowerFilters(params, filters);
  addFuelAndTransmissionFilters(params, filters);
  addVehicleFilter(params, filters);

  return filters;
}

export async function searchCochesNet(
  params: SearchInput,
  page = 1,
): Promise<CochesNetSearchResponse> {
  const filters = buildCochesNetFilters(params);

  // The shared model filter holds a model name; coches.net needs its numeric
  // modelId, so resolve it against the make's model list. Falls back to
  // make-only filtering when the name has no exact match on coches.net.
  if (filters.vehicles && params.brand && params.model) {
    const { makeId } = filters.vehicles[0];
    const modelId = await resolveCochesNetModelId(makeId, params.model);
    if (modelId !== undefined) filters.vehicles[0].modelId = modelId;
  }

  const payload = {
    pagination: { page, size: COCHESNET_PAGE_SIZE },
    sort: { order: "desc", term: "relevance" },
    filters,
  };

  const response = await fetch(new URL(BASE_URL, window.location.origin), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Coches.net API error: ${response.status}`);
  }

  return response.json() as Promise<CochesNetSearchResponse>;
}
