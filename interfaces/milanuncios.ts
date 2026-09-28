// Milanuncios exposes no public JSON search API. Its cars search page is
// server-rendered HTML that embeds `window.__INITIAL_PROPS__ = JSON.parse("…")`;
// the proxy route extracts the `adListPagination` node and hands the client the
// shape below. Items carry no coordinates and no structured model/km/year — km,
// year and fuel live as display strings inside `tags[]`, so the normalizer
// parses them out and the geo layer places listings by city/province name.

export interface MilanunciosPlace {
  id: number;
  name: string;
  slug: string;
}

export interface MilanunciosLocation {
  city?: MilanunciosPlace;
  province?: MilanunciosPlace;
  region?: MilanunciosPlace;
}

interface MilanunciosPrice {
  cashPrice?: { value: number; includeTaxes?: boolean };
  financedPrice?: { value: number };
}

// A key/value display chip, e.g. { type: "kilómetros", text: "198.000 kms" },
// { type: "año", text: "2005" }, { type: "combustible", text: "gasolina" }.
export interface MilanunciosTag {
  type: string;
  text: string;
}

export interface MilanunciosAd {
  id: string;
  title: string;
  url: string;
  description?: string;
  // For cars the leaf category is the make (e.g. { name: "Audi" }).
  category?: MilanunciosPlace;
  price?: MilanunciosPrice;
  // Photo URLs without a scheme, e.g. "images.milanuncios.com/api/v1/…".
  images?: string[];
  tags?: MilanunciosTag[];
  location?: MilanunciosLocation;
  province?: MilanunciosPlace;
  city?: MilanunciosPlace;
  // "RELEASED" (or absent) means available; anything else is reserved/sold.
  isReserved?: string;
}

export interface MilanunciosPagination {
  page: number;
  resultsPerPage: number;
  totalAds: number;
  totalPages: number;
  nextToken?: string;
}

export interface MilanunciosSearchResponse {
  ads: MilanunciosAd[];
  pagination: MilanunciosPagination;
}
