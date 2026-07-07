import { CarListing } from "@/interfaces/listing";
import { CochesNetItem } from "@/interfaces/cochesnet";
import { resolveCochesNetCoords } from "@/lib/cochesnet/geo";

const COCHESNET_BASE_URL = "https://www.coches.net";

export function normalizeCochesNetItems(items: CochesNetItem[]): CarListing[] {
  return items.map((item): CarListing => {
    const { lat, lng } = resolveCochesNetCoords(item.location);
    const image =
      item.resources?.find((r) => r.type === "IMAGE")?.url ??
      item.resources?.[0]?.url ??
      "";
    const city = item.location?.cityLiteral ?? item.location?.mainProvince ?? "";

    return {
      id: `cochesnet-${item.id}`,
      image,
      title: item.title ?? "Unknown",
      subtitle: [item.make, item.model].filter(Boolean).join(" "),
      price: item.price?.amount ?? 0,
      mileage: item.km ?? 0,
      year: item.year ?? 0,
      fuel: item.fuelType ?? "",
      brand: item.make ?? "",
      model: item.model ?? "",
      location: city,
      source: "Coches.net",
      lat,
      lng,
      url: `${COCHESNET_BASE_URL}${item.url}`,
    };
  });
}
