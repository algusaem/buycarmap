import { MapView } from "@/components/map/MapView";

export default async function MapPage({ searchParams }: { searchParams: Promise<unknown> }) {
  // Read only to keep this page rendered per request. `q` stays in the URL
  // alone: a prop would come back stale on Back (DESC-15).
  await searchParams;
  return <MapView />;
}
