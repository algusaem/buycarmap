import { MapView } from "@/components/map/MapView";
import { MOCK_LISTINGS } from "@/lib/mock/listings";

// TODO: Replace with real data fetching
// export default async function MapPage() {
//   const listings = await getListings();
//   return <MapView listings={listings} />;
// }

export default function MapPage() {
  return <MapView listings={MOCK_LISTINGS} />;
}
