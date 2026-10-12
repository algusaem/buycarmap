import type { Metadata } from "next";
import { BOTTOM_NAV_CLEARANCE } from "@/components/nav/bottom-nav-clearance";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import { AlertMatchesList } from "@/components/alerts/AlertMatchesList";
import { getAlertWithMatches } from "@/server/alerts/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("alerts.title")} · ${t("meta.title")}` };
}

export default async function AlertMatchesPage({ params }: PageProps) {
  const { id } = await params;

  // Authenticates first; another account's alert is a 404. An id that does
  // not even look like a UUID is a 404 too (getAlertWithMatches).
  const alert = await getAlertWithMatches(id);

  return (
    // `overflow-y-auto` is required, not cosmetic: the root layout pins the
    // body to h-screen with overflow-hidden so the map never scrolls the page,
    // which leaves this route unable to scroll at all otherwise (HEAD-19).
    // Same pattern as app/account/page.tsx.
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      <div className={cn("mx-auto w-full max-w-6xl px-4 pt-8 lg:pb-8", BOTTOM_NAV_CLEARANCE)}>
        <AlertMatchesList
          alertLabel={alert.label}
          // Rendered from the stored snapshot, so this page works with every
          // source unreachable.
          matches={alert.matches.map((match) => ({
            id: match.listingId,
            image: match.image,
            title: match.title,
            subtitle: match.subtitle,
            price: match.price,
            mileage: match.mileage,
            year: match.year,
            fuel: match.fuel,
            brand: match.brand,
            model: match.model,
            location: match.location,
            source: match.source,
            lat: match.lat,
            lng: match.lng,
            url: match.url,
            foundAt: match.createdAt,
          }))}
        />
      </div>
    </div>
  );
}
