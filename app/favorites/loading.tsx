import { CardGridSkeleton } from "@/components/ui/CardGridSkeleton";

// FRONT-14 (docs/specs/core-frontend.md): /favorites' loading state — a
// skeleton mirroring FavoritesList's populated card grid (RULES.md §19),
// alongside the error state app/favorites/error.tsx already has and the
// empty/populated states FavoritesList itself renders. Synchronous, not an
// async Server Component reading the locale: `app/favorites/loading.test.tsx`
// renders it directly with `render()`, which (unlike Next's own RSC
// streaming) cannot resolve an async component.
export default function FavoritesLoading() {
  return <CardGridSkeleton />;
}
