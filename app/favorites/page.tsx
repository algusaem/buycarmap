import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listFavoritesForPage } from "@/server/favorites/queries";
import { FavoritesList } from "@/components/favorites/FavoritesList";
import { MAIN_CONTENT } from "@/components/nav/SkipLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("favorites.title")} · ${t("meta.title")}` };
}

// docs/specs/redesign-saved.md (SAVED-1, SAVED-2): the saved cars, read once
// on the server, newest saved first (SAVED-34). No subtitle and no back link:
// the way back is the header's «Mapa» and the tab bar's. The page does not
// scroll; its list column does (SAVED-4). `data-toast-anchor`: every toast here
// is centred over that column (SAVED-24, app/globals.css). The page's `main`,
// as its loading and error states'.
export default async function FavoritesPage() {
  const favorites = await listFavoritesForPage();

  return (
    <main
      {...MAIN_CONTENT}
      data-toast-anchor="saved"
      className="outline-none flex min-h-0 flex-1 flex-col bg-background"
    >
      <FavoritesList favorites={favorites} />
    </main>
  );
}
