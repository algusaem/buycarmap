import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n/server";
import { prisma } from "@/lib/db/prisma";
import { AlertMatchesList } from "@/components/alerts/AlertMatchesList";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t.alerts.title} · ${t.meta.title}` };
}

export default async function AlertMatchesPage({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=%2Falerts%2F${id}`);

  // Scoped by userId, so another account's alert is a 404 rather than a 403 —
  // confirming it exists would leak that someone else watches this search.
  const alert = await prisma.alert.findFirst({
    where: { id, userId: user.id },
    include: { matches: { orderBy: { createdAt: "desc" } } },
  });
  if (!alert) notFound();

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
