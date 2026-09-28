interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  state?: string;
  province?: string;
  county?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: NominatimAddress;
}

export interface GeocodingResult {
  placeId: number;
  displayName: string;
  lat: number;
  lng: number;
}

function buildDisplayName(address: NominatimAddress): string {
  const place =
    address.city ?? address.town ?? address.village ?? address.hamlet ?? address.municipality;

  const region = address.state ?? address.province ?? address.county;

  if (place && region) return `${place}, ${region}`;
  if (place) return place;
  if (region) return region;
  return "";
}

export async function searchLocations(
  query: string,
  locale: string = "es",
): Promise<GeocodingResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "5",
      countrycodes: "es",
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "BuyCarMap/1.0",
        "Accept-Language": locale,
      },
    });

    if (!response.ok) return [];

    const data: NominatimResult[] = await response.json();

    return data.map((item) => ({
      placeId: item.place_id,
      displayName: buildDisplayName(item.address) || item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch {
    return [];
  }
}
