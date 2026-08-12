import { getCityCoordinates, SPAIN_CENTER } from "@/lib/geo/cities";
import { MilanunciosLocation, MilanunciosPlace } from "@/interfaces/milanuncios";

interface Coordinates {
  lat: number;
  lng: number;
}

// Milanuncios items carry no latitude/longitude, only city/province names and
// INE province codes (1–52). We approximate each listing to its province
// capital so it still appears on the map (city-level precision, not exact).
// Keyed by province id (same INE codes coches.net uses).
const PROVINCE_ID_TO_COORDS: Record<number, Coordinates> = {
  1: { lat: 42.8467, lng: -2.6716 }, // Álava (Vitoria)
  2: { lat: 38.9942, lng: -1.8585 }, // Albacete
  3: { lat: 38.3452, lng: -0.481 }, // Alicante
  4: { lat: 36.8381, lng: -2.4597 }, // Almería
  5: { lat: 40.6565, lng: -4.6818 }, // Ávila
  6: { lat: 38.8794, lng: -6.9707 }, // Badajoz
  7: { lat: 39.5696, lng: 2.6502 }, // Baleares (Palma)
  8: { lat: 41.3874, lng: 2.1686 }, // Barcelona
  9: { lat: 42.344, lng: -3.6969 }, // Burgos
  10: { lat: 39.4753, lng: -6.3724 }, // Cáceres
  11: { lat: 36.5271, lng: -6.2886 }, // Cádiz
  12: { lat: 39.9864, lng: -0.0513 }, // Castellón
  13: { lat: 38.9848, lng: -3.9274 }, // Ciudad Real
  14: { lat: 37.8882, lng: -4.7794 }, // Córdoba
  15: { lat: 43.3623, lng: -8.4115 }, // A Coruña
  16: { lat: 40.0703, lng: -2.1374 }, // Cuenca
  17: { lat: 41.9794, lng: 2.8214 }, // Girona
  18: { lat: 37.1773, lng: -3.5986 }, // Granada
  19: { lat: 40.6295, lng: -3.167 }, // Guadalajara
  20: { lat: 43.3183, lng: -1.9812 }, // Guipúzcoa (San Sebastián)
  21: { lat: 37.2614, lng: -6.9447 }, // Huelva
  22: { lat: 42.1362, lng: -0.4087 }, // Huesca
  23: { lat: 37.7796, lng: -3.7849 }, // Jaén
  24: { lat: 42.5987, lng: -5.5671 }, // León
  25: { lat: 41.6176, lng: 0.62 }, // Lleida
  26: { lat: 42.4627, lng: -2.4445 }, // La Rioja (Logroño)
  27: { lat: 43.0096, lng: -7.5568 }, // Lugo
  28: { lat: 40.4168, lng: -3.7038 }, // Madrid
  29: { lat: 36.7213, lng: -4.4214 }, // Málaga
  30: { lat: 37.9922, lng: -1.1307 }, // Murcia
  31: { lat: 42.8125, lng: -1.6458 }, // Navarra (Pamplona)
  32: { lat: 42.3358, lng: -7.8639 }, // Ourense
  33: { lat: 43.3614, lng: -5.8493 }, // Asturias (Oviedo)
  34: { lat: 42.0096, lng: -4.5288 }, // Palencia
  35: { lat: 28.1235, lng: -15.4363 }, // Las Palmas
  36: { lat: 42.4312, lng: -8.6443 }, // Pontevedra
  37: { lat: 40.9701, lng: -5.6635 }, // Salamanca
  38: { lat: 28.4636, lng: -16.2518 }, // Santa Cruz de Tenerife
  39: { lat: 43.4623, lng: -3.8099 }, // Cantabria (Santander)
  40: { lat: 40.9429, lng: -4.1088 }, // Segovia
  41: { lat: 37.3891, lng: -5.9845 }, // Sevilla
  42: { lat: 41.7665, lng: -2.479 }, // Soria
  43: { lat: 41.1189, lng: 1.2445 }, // Tarragona
  44: { lat: 40.3456, lng: -1.1065 }, // Teruel
  45: { lat: 39.8628, lng: -4.0273 }, // Toledo
  46: { lat: 39.4699, lng: -0.3763 }, // Valencia
  47: { lat: 41.6523, lng: -4.7245 }, // Valladolid
  48: { lat: 43.263, lng: -2.935 }, // Vizcaya (Bilbao)
  49: { lat: 41.5034, lng: -5.7468 }, // Zamora
  50: { lat: 41.6488, lng: -0.8891 }, // Zaragoza
  51: { lat: 35.8894, lng: -5.3213 }, // Ceuta
  52: { lat: 35.2923, lng: -2.9381 }, // Melilla
};

// Resolve coordinates for a Milanuncios listing: try the exact city name, then
// the province name, then the province-id centroid, then Spain center.
export function resolveMilanunciosCoords(
  location: MilanunciosLocation | undefined,
  province: MilanunciosPlace | undefined,
): Coordinates {
  const city = location?.city;
  const prov = location?.province ?? province;

  if (city?.name) {
    const cityMatch = getCityCoordinates(city.name, NaN, NaN);
    if (!Number.isNaN(cityMatch.lat)) return cityMatch;
  }

  if (prov?.name) {
    const provinceMatch = getCityCoordinates(prov.name, NaN, NaN);
    if (!Number.isNaN(provinceMatch.lat)) return provinceMatch;
  }

  if (prov?.id != null) {
    return PROVINCE_ID_TO_COORDS[prov.id] ?? SPAIN_CENTER;
  }

  return SPAIN_CENTER;
}
