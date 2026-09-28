import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n/server";
import { listFavorites } from "@/app/actions/favorites";
import { FavoritesList } from "@/components/favorites/FavoritesList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t.favorites.title} · ${t.meta.title}` };
}

export default async function FavoritesPage() {
  // `proxy.ts` already redirects anonymous visitors, but this is the check that
  // matters: the proxy only decodes the JWT, while `getCurrentUser` runs the
  // session callback and honours revocation.
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Ffavorites");

  const t = await getTranslations();
  const result = await listFavorites();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/map"
          aria-label={t.map.backToHome}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.favorites.title}</h1>
          {/* The snapshot is deliberately not refreshed (see the spec), so the
              staleness is stated rather than hidden. */}
          <p className="text-sm text-muted-foreground">{t.favorites.subtitle}</p>
        </div>
      </div>

      <FavoritesList favorites={result.data ?? []} />
    </div>
  );
}
