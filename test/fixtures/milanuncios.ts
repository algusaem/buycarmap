import { MilanunciosAd, MilanunciosSearchResponse } from "@/interfaces/milanuncios";

// A fully-populated Milanuncios car ad. Like the real API it carries no
// lat/lng (only city/province names + INE ids) and no structured km/year/fuel —
// those live as display strings in tags[], so the normalizer parses them out.
export function makeMilanunciosAd(overrides: Partial<MilanunciosAd> = {}): MilanunciosAd {
  return {
    id: "602662777",
    title: "AUDI Q5 35 TDI 120kW 163CV S tronic",
    url: "/audi-de-segunda-mano/audi-q5-35-tdi-602662777.htm",
    description: "Único propietario, libro de revisiones, garantía 12 meses.",
    category: { id: 802, name: "Audi", slug: "audi-de-segunda-mano" },
    price: { cashPrice: { value: 34900, includeTaxes: true } },
    images: [
      "images.milanuncios.com/api/v1/ma-ad-media-pro/images/dc7697b0",
      "images.milanuncios.com/api/v1/ma-ad-media-pro/images/eb2a3fa5",
    ],
    tags: [
      { type: "kilómetros", text: "76.852 kms" },
      { type: "año", text: "2021" },
      { type: "combustible", text: "híbrido" },
    ],
    location: {
      city: { id: 58447, name: "Oliva", slug: "oliva" },
      province: { id: 46, name: "Valencia", slug: "valencia" },
      region: { id: 46, name: "Comunidad Valenciana", slug: "valencia" },
    },
    province: { id: 46, name: "Valencia", slug: "valencia" },
    isReserved: "RELEASED",
    ...overrides,
  };
}

export function makeMilanunciosResponse(
  ads: MilanunciosAd[],
  totalPages = 1,
  page = 1,
): MilanunciosSearchResponse {
  return {
    ads,
    pagination: {
      page,
      resultsPerPage: 41,
      totalAds: ads.length,
      totalPages,
    },
  };
}

// Wrap a response in the SSR page shell the proxy route extracts from: the
// listings are embedded as window.__INITIAL_PROPS__ = JSON.parse("<escaped>"),
// which the parser double-decodes.
export function makeMilanunciosHtml(response: MilanunciosSearchResponse): string {
  const props = {
    adListPagination: {
      adList: { ads: response.ads },
      pagination: response.pagination,
    },
  };
  // The embedded argument is a JS/JSON string literal whose content is itself
  // the JSON — i.e. JSON.stringify applied twice.
  const literal = JSON.stringify(JSON.stringify(props));
  return `<!doctype html><html><head></head><body><script>window.__INITIAL_PROPS__ = JSON.parse(${literal});</script></body></html>`;
}
