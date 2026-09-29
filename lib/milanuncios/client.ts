import type { MilanunciosSearchResponse } from "@/interfaces/milanuncios";
import type { SearchInput } from "@/server/search/schema";
import { mapBrandToSlug, mapFuelTokens, mapTransmissionToken } from "@/lib/milanuncios/taxonomy";

const BASE_URL = "/api/milanuncios/search";

function addNumericRangeParams(params: SearchInput, query: URLSearchParams): void {
  if (params.minPrice != null) query.set("desde", String(params.minPrice));
  if (params.maxPrice != null) query.set("hasta", String(params.maxPrice));
  if (params.minYear != null) query.set("anod", String(params.minYear));
  if (params.maxYear != null) query.set("anoh", String(params.maxYear));
  if (params.minKm != null) query.set("kilometersFrom", String(params.minKm));
  if (params.maxKm != null) query.set("kilometersTo", String(params.maxKm));
  if (params.minHorsePower != null) query.set("engineHpFrom", String(params.minHorsePower));
  if (params.maxHorsePower != null) query.set("engineHpTo", String(params.maxHorsePower));
}

function addFuelAndTransmissionParams(params: SearchInput, query: URLSearchParams): void {
  if (params.engine?.length) {
    const fuels = mapFuelTokens(params.engine);
    if (fuels.length) query.set("fuels", fuels.join(","));
  }
  if (params.gearbox?.length) {
    const cajacambio = mapTransmissionToken(params.gearbox);
    if (cajacambio) query.set("cajacambio", cajacambio);
  }
}

// Build the query the proxy forwards to the Milanuncios search page. `slug`
// scopes the page to a make (path-based on their side); every other value is a
// native Milanuncios query-string param. Milanuncios has no lat/lng or distance
// filter — the map geocodes results client-side instead.
export function buildMilanunciosQuery(params: SearchInput, page: number): URLSearchParams {
  const query = new URLSearchParams();
  query.set("slug", mapBrandToSlug(params.brand));

  // Milanuncios has no structured model filter; fold the model name into the
  // free-text search so results still skew to it.
  const keywords = [params.keywords, params.model].filter(Boolean).join(" ");
  if (keywords) query.set("palabras", keywords);

  addNumericRangeParams(params, query);
  addFuelAndTransmissionParams(params, query);

  if (page > 1) query.set("pagina", String(page));

  return query;
}

export async function searchMilanuncios(
  params: SearchInput,
  page = 1,
): Promise<MilanunciosSearchResponse> {
  const url = new URL(BASE_URL, window.location.origin);
  url.search = buildMilanunciosQuery(params, page).toString();

  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    throw new Error(`Milanuncios API error: ${response.status}`);
  }

  return response.json() as Promise<MilanunciosSearchResponse>;
}
