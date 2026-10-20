import { AccountPlaceholder } from "@/components/account/AccountPlaceholder";
import { MAIN_CONTENT } from "@/components/nav/SkipLink";

// docs/specs/redesign-pages.md (PAGES-56; amends FRONT-14);
// F7-cuenta-eliminar-y-mas › Cargando. /account's loading state mirrors the
// page (components/account/AccountPlaceholder.tsx), under the same `main` and
// /account's own header.
export default function AccountLoading() {
  return (
    <main
      {...MAIN_CONTENT}
      className="outline-none flex min-h-0 flex-1 flex-col overflow-y-auto bg-background"
    >
      <AccountPlaceholder />
    </main>
  );
}
