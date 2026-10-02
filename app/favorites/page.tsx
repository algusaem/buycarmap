import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listFavoritesForPage } from "@/server/favorites/queries";
import { FavoritesList } from "@/components/favorites/FavoritesList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("favorites.title")} · ${t("meta.title")}` };
}

export default async function FavoritesPage() {
  const favorites = await listFavoritesForPage();
  const t = await getTranslations();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/map"
          aria-label={t("map.backToHome")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("favorites.title")}</h1>
          {/* The snapshot is deliberately not refreshed (see the spec), so the
              staleness is stated rather than hidden. */}
          <p className="text-sm text-muted-foreground">{t("favorites.subtitle")}</p>
        </div>
      </div>

      <FavoritesList favorites={favorites} />
    </div>
  );
}
