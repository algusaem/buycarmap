// Milanuncios filters by make through the URL *path slug* (e.g.
// `/audi-de-segunda-mano/`), and by fuel/gearbox through query-string tokens
// (`fuels`, `cajacambio`). These maps translate the app's shared filter values
// (brand names from components/map/search-filter-options.ts and Wallapop's
// fuel/transmission string tokens) into Milanuncios' own values.

// The make slug is `<name>-de-segunda-mano` with the name lowercased, accents
// stripped and non-alphanumerics collapsed to hyphens. Every brand in the app's
// list matches this mechanical rule on Milanuncios (verified against live data),
// so no per-brand overrides are needed.
function slugify(brand: string): string {
  return brand
    .toLowerCase()
    .trim()
    .replace(/[à-æ]/g, "a")
    .replace(/[è-ë]/g, "e")
    .replace(/[ì-ï]/g, "i")
    .replace(/[ò-ö]/g, "o")
    .replace(/[ù-ü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The category slug that scopes the search page to one make. Returns the
// all-cars slug when no brand is selected.
export const ALL_CARS_SLUG = "coches-de-segunda-mano";

export function mapBrandToSlug(brand?: string): string {
  if (!brand) return ALL_CARS_SLUG;
  return `${slugify(brand)}-de-segunda-mano`;
}

// Wallapop fuel token (FUEL_OPTIONS value) -> Milanuncios `fuels` token.
// Milanuncios has no plug-in-hybrid token, so it collapses into `hibrido`.
export const FUEL_TOKEN_TO_MILANUNCIOS: Record<string, string> = {
  gasoline: "gasolina",
  gasoil: "diesel",
  "electric-hybrid": "electrico",
  hybride: "hibrido",
  hybride_plugin: "hibrido",
};

// Wallapop transmission token (TRANSMISSION_OPTIONS value) -> Milanuncios
// `cajacambio` token. Milanuncios only distinguishes manual/automatic, so
// semi-automatic maps to automatic.
export const TRANSMISSION_TOKEN_TO_MILANUNCIOS: Record<string, string> = {
  manual: "manual",
  automatic: "automatico",
  semiautomatic: "automatico",
};

export function mapFuelTokens(tokens: string[]): string[] {
  const mapped = tokens
    .map((t) => FUEL_TOKEN_TO_MILANUNCIOS[t])
    .filter((v): v is string => v !== undefined);
  return [...new Set(mapped)];
}

export function mapTransmissionToken(tokens: string[]): string | undefined {
  for (const t of tokens) {
    const v = TRANSMISSION_TOKEN_TO_MILANUNCIOS[t];
    if (v !== undefined) return v;
  }
  return undefined;
}
