import { CardGridSkeleton } from "@/components/ui/CardGridSkeleton";
import { useTranslations } from "next-intl";

const PLACEHOLDER_COUNT = 4;

/**
 * FRONT-14 (docs/specs/core-frontend.md): mirrors the populated card grid
 * while a search round is in flight, instead of a bare spinner — the loading
 * state of the map's results list.
 */
export function ListingsSkeleton() {
  const t = useTranslations();
  return <CardGridSkeleton count={PLACEHOLDER_COUNT} label={t("map.searching")} />;
}
