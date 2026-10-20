import { SavedPagePlaceholder } from "@/components/favorites/SavedPlaceholders";
import { MAIN_CONTENT } from "@/components/nav/SkipLink";

// docs/specs/redesign-saved.md (SAVED-30, SAVED-13; amends FRONT-14);
// F5-guardados-estados. /favorites' loading state mirrors the populated page
// (components/favorites/SavedPlaceholders.tsx), under the same `main` as the
// page. A Server Component (RULES.md §9): both compositions are drawn and CSS
// breakpoints pick one, so nothing waits on the client's media queries.
export default function FavoritesLoading() {
  return (
    <main {...MAIN_CONTENT} className="outline-none flex min-h-0 flex-1 flex-col bg-background">
      <SavedPagePlaceholder />
    </main>
  );
}
