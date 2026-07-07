import { MapView } from "@/components/map/MapView";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <MapView initialQuery={q ?? ""} />;
}
