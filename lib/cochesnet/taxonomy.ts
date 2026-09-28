// coches.net uses numeric IDs for makes, fuel, and transmission.
// These maps translate the app's shared filter values (which use the
// brand names in components/map/search-filter-options.ts and Wallapop's
// string tokens) into coches.net IDs. Resolved live from the coches.net
// /makes taxonomy and by sampling /search/listing.

// Brand name (as listed in BRANDS) -> coches.net makeId.
export const BRAND_TO_MAKE_ID: Record<string, number> = {
  "Alfa Romeo": 1,
  "Aston Martin": 3,
  Audi: 4,
  BMW: 7,
  Citroën: 11,
  Cupra: 1400,
  Dacia: 1011,
  DS: 1358,
  Fiat: 14,
  Ford: 15,
  Honda: 69,
  Hyundai: 18,
  Jaguar: 20,
  Jeep: 21,
  Kia: 22,
  "Land Rover": 24,
  Lexus: 25,
  Mazda: 27,
  "Mercedes-Benz": 28,
  Mini: 222,
  Mitsubishi: 30,
  Nissan: 31,
  Opel: 32,
  Peugeot: 33,
  Porsche: 34,
  Renault: 35,
  Seat: 39,
  Skoda: 40,
  Smart: 41,
  Subaru: 43,
  Suzuki: 44,
  Tesla: 1354,
  Toyota: 46,
  Volkswagen: 47,
  Volvo: 48,
};

// Wallapop fuel token (FUEL_OPTIONS value) -> coches.net fuelTypeId.
export const FUEL_TOKEN_TO_ID: Record<string, number> = {
  gasoline: 2, // Gasolina
  gasoil: 1, // Diésel
  "electric-hybrid": 3, // Eléctrico
  hybride: 4, // Híbrido
  hybride_plugin: 5, // Híbrido enchufable
  lpg: 6, // Gas licuado (GLP)
  cng: 7, // Gas natural (CNG)
};

// Wallapop transmission token (TRANSMISSION_OPTIONS value) -> coches.net id.
// coches.net only distinguishes automatic (1) and manual (2); it has no
// separate semi-automatic value, so that token maps to automatic.
export const TRANSMISSION_TOKEN_TO_ID: Record<string, number> = {
  automatic: 1,
  semiautomatic: 1,
  manual: 2,
};

export function mapBrandToMakeId(brand: string): number | undefined {
  return BRAND_TO_MAKE_ID[brand];
}

export function mapFuelTokensToIds(tokens: string[]): number[] {
  return tokens.map((t) => FUEL_TOKEN_TO_ID[t]).filter((id): id is number => id !== undefined);
}

export function mapTransmissionTokensToId(tokens: string[]): number | undefined {
  for (const t of tokens) {
    const id = TRANSMISSION_TOKEN_TO_ID[t];
    if (id !== undefined) return id;
  }
  return undefined;
}
