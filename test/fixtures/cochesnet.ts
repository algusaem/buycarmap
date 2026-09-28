import {
  CochesNetItem,
  CochesNetSearchResponse,
  CochesNetTaxonomyResponse,
} from "@/interfaces/cochesnet";

// A fully-populated coches.net car item. coches.net items never carry
// lat/lng — only city/province names + INE codes — so the geo layer is what
// places them on the map.
export function makeCochesNetItem(overrides: Partial<CochesNetItem> = {}): CochesNetItem {
  return {
    id: "cn-987",
    title: "BMW Serie 3 320d",
    url: "/bmw-serie_3-320d/cn-987",
    price: { amount: 18900, hasTaxes: true },
    km: 120_000,
    year: 2019,
    hp: 190,
    make: "BMW",
    makeId: 7,
    model: "Serie 3",
    modelId: 4321,
    fuelType: "Diésel",
    fuelTypeId: 1,
    transmissionTypeId: 1,
    resources: [
      { type: "IMAGE", url: "https://foto.ccdn.es/cn-987-1.jpg" },
      { type: "IMAGE", url: "https://foto.ccdn.es/cn-987-2.jpg" },
    ],
    location: {
      provinceIds: [8],
      regionId: 9,
      regionLiteral: "Cataluña",
      mainProvince: "Barcelona",
      mainProvinceId: 8,
      cityId: 810,
      cityLiteral: "Barcelona",
    },
    isProfessional: true,
    ...overrides,
  };
}

export function makeCochesNetResponse(
  items: CochesNetItem[],
  totalPages = 1,
): CochesNetSearchResponse {
  return {
    items,
    paidItems: [],
    meta: { totalPages, totalResults: items.length },
  };
}

export function makeCochesNetTaxonomy(
  options: { id: number; label: string }[],
): CochesNetTaxonomyResponse {
  return { items: options };
}
