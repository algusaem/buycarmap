interface CityCoordinates {
  lat: number;
  lng: number;
}

const SPANISH_CITIES: Record<string, CityCoordinates> = {
  madrid: { lat: 40.4168, lng: -3.7038 },
  barcelona: { lat: 41.3874, lng: 2.1686 },
  valencia: { lat: 39.4699, lng: -0.3763 },
  sevilla: { lat: 37.3891, lng: -5.9845 },
  zaragoza: { lat: 41.6488, lng: -0.8891 },
  málaga: { lat: 36.7213, lng: -4.4214 },
  malaga: { lat: 36.7213, lng: -4.4214 },
  murcia: { lat: 37.9922, lng: -1.1307 },
  palma: { lat: 39.5696, lng: 2.6502 },
  "palma de mallorca": { lat: 39.5696, lng: 2.6502 },
  "las palmas": { lat: 28.1235, lng: -15.4363 },
  "las palmas de gran canaria": { lat: 28.1235, lng: -15.4363 },
  bilbao: { lat: 43.263, lng: -2.935 },
  alicante: { lat: 38.3452, lng: -0.481 },
  córdoba: { lat: 37.8882, lng: -4.7794 },
  cordoba: { lat: 37.8882, lng: -4.7794 },
  valladolid: { lat: 41.6523, lng: -4.7245 },
  vigo: { lat: 42.2406, lng: -8.7207 },
  gijón: { lat: 43.5453, lng: -5.6635 },
  gijon: { lat: 43.5453, lng: -5.6635 },
  hospitalet: { lat: 41.3597, lng: 2.1002 },
  "l'hospitalet de llobregat": { lat: 41.3597, lng: 2.1002 },
  vitoria: { lat: 42.8467, lng: -2.6716 },
  "vitoria-gasteiz": { lat: 42.8467, lng: -2.6716 },
  "a coruña": { lat: 43.3623, lng: -8.4115 },
  granada: { lat: 37.1773, lng: -3.5986 },
  elche: { lat: 38.2699, lng: -0.7125 },
  oviedo: { lat: 43.3614, lng: -5.8493 },
  "santa cruz de tenerife": { lat: 28.4636, lng: -16.2518 },
  badalona: { lat: 41.4501, lng: 2.2474 },
  cartagena: { lat: 37.6057, lng: -0.9913 },
  terrassa: { lat: 41.5631, lng: 2.0089 },
  jerez: { lat: 36.6817, lng: -6.1378 },
  "jerez de la frontera": { lat: 36.6817, lng: -6.1378 },
  sabadell: { lat: 41.5486, lng: 2.1075 },
  móstoles: { lat: 40.3224, lng: -3.8653 },
  mostoles: { lat: 40.3224, lng: -3.8653 },
  alcalá: { lat: 40.4818, lng: -3.364 },
  "alcalá de henares": { lat: 40.4818, lng: -3.364 },
  pamplona: { lat: 42.8125, lng: -1.6458 },
  fuenlabrada: { lat: 40.2838, lng: -3.7943 },
  almería: { lat: 36.8381, lng: -2.4597 },
  almeria: { lat: 36.8381, lng: -2.4597 },
  "san sebastián": { lat: 43.3183, lng: -1.9812 },
  "san sebastian": { lat: 43.3183, lng: -1.9812 },
  donostia: { lat: 43.3183, lng: -1.9812 },
  santander: { lat: 43.4623, lng: -3.8099 },
  burgos: { lat: 42.344, lng: -3.6969 },
  albacete: { lat: 38.9942, lng: -1.8585 },
  getafe: { lat: 40.3088, lng: -3.7328 },
  salamanca: { lat: 40.9701, lng: -5.6635 },
  logroño: { lat: 42.4627, lng: -2.4445 },
  "san cristóbal de la laguna": { lat: 28.4853, lng: -16.3152 },
  huelva: { lat: 37.2614, lng: -6.9447 },
  tarragona: { lat: 41.1189, lng: 1.2445 },
  león: { lat: 42.5987, lng: -5.5671 },
  leon: { lat: 42.5987, lng: -5.5671 },
  cádiz: { lat: 36.5271, lng: -6.2886 },
  cadiz: { lat: 36.5271, lng: -6.2886 },
  lleida: { lat: 41.6176, lng: 0.62 },
  girona: { lat: 41.9794, lng: 2.8214 },
  castellón: { lat: 39.9864, lng: -0.0513 },
  castellon: { lat: 39.9864, lng: -0.0513 },
  "castellón de la plana": { lat: 39.9864, lng: -0.0513 },
  badajoz: { lat: 38.8794, lng: -6.9707 },
  jaén: { lat: 37.7796, lng: -3.7849 },
  jaen: { lat: 37.7796, lng: -3.7849 },
  lugo: { lat: 43.0096, lng: -7.5568 },
  ourense: { lat: 42.3358, lng: -7.8639 },
  pontevedra: { lat: 42.4312, lng: -8.6443 },
  toledo: { lat: 39.8628, lng: -4.0273 },
  "ciudad real": { lat: 38.9848, lng: -3.9274 },
  cáceres: { lat: 39.4753, lng: -6.3724 },
  caceres: { lat: 39.4753, lng: -6.3724 },
};

/**
 * Where the per-source geo resolvers pin a listing whose location they could
 * not recognise. It doubles as a sentinel: `lib/geo/radius.ts` compares
 * against it exactly to exclude unknown locations from a radius search
 * (MAP-17), so the resolvers and that filter have to agree on the point — it
 * lives here rather than in each of them for that reason.
 */
export const SPAIN_CENTER: CityCoordinates = { lat: 40.0, lng: -3.5 };

export function getCityCoordinates(
  city: string,
  fallbackLat: number,
  fallbackLng: number,
): CityCoordinates {
  const normalized = city.toLowerCase().trim();
  return SPANISH_CITIES[normalized] ?? { lat: fallbackLat, lng: fallbackLng };
}
