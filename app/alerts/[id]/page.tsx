import type { Metadata } from "next";
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
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
  );
}
