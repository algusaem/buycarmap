import type { CarListing } from "@/interfaces/listing";
import type { MilanunciosAd, MilanunciosTag } from "@/interfaces/milanuncios";
import { resolveMilanunciosCoords } from "@/lib/milanuncios/geo";

const MILANUNCIOS_BASE_URL = "https://www.milanuncios.com";

// Milanuncios' image API (ma-ad-media-pro) requires a size `rule`; without it
// the URL 404s. hw396_70 is the rule the site's own result cards use.
const IMAGE_RULE = "hw396_70";

// Milanuncios photo URLs come without a scheme, e.g.
// "images.milanuncios.com/api/v1/ma-ad-media-pro/images/<id>". Prepend https://
// when absent and append the size rule the image API demands.
function resolveImage(raw: string): string {
  if (!raw) return "";
  const url = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  if (url.includes("ma-ad-media-pro") && !url.includes("?")) {
    return `${url}?rule=${IMAGE_RULE}`;
  }
  return url;
}

// km, year and fuel are display strings inside tags[], keyed by a Spanish
// label. Pull the raw text for a given tag type.
function tagText(tags: MilanunciosTag[] | undefined, type: string): string {
  return tags?.find((t) => t.type === type)?.text ?? "";
}

// "76.852 kms" / "2021" -> 76852 / 2021. Returns 0 when there is no number.
function parseNumber(text: string): number {
  const digits = text.replace(/\D/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}

export function normalizeMilanunciosItems(ads: MilanunciosAd[]): CarListing[] {
  return ads
    .filter((ad) => ad.isReserved == null || ad.isReserved === "RELEASED")
    .map((ad): CarListing => {
      const brand = ad.category?.name ?? "";
      const city = ad.location?.city?.name ?? ad.location?.province?.name ?? "";
      const { lat, lng } = resolveMilanunciosCoords(ad.location, ad.province);

      return {
        id: `milanuncios-${ad.id}`,
        image: resolveImage(ad.images?.[0] ?? ""),
        title: ad.title ?? "Unknown",
        subtitle: ad.description?.slice(0, 80) ?? brand,
        price: ad.price?.cashPrice?.value ?? 0,
        mileage: parseNumber(tagText(ad.tags, "kilómetros")),
        year: parseNumber(tagText(ad.tags, "año")),
        fuel: tagText(ad.tags, "combustible"),
        brand,
        // Milanuncios results carry no structured model — it only exists inside
        // the title text — so the model field is left empty.
        model: "",
        location: city,
        source: "Milanuncios",
        lat,
        lng,
        url: `${MILANUNCIOS_BASE_URL}${ad.url ?? ""}`,
      };
    });
}
