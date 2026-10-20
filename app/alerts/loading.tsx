import { AlertsPagePlaceholder } from "@/components/alerts/AlertPlaceholders";
import { MAIN_CONTENT } from "@/components/nav/SkipLink";

// docs/specs/redesign-alerts.md (ALERTUI-38; amends FRONT-14);
// F6-alertas-escritorio › Cargando. /alerts' loading state mirrors the
// populated page (components/alerts/AlertPlaceholders.tsx), under the same
// `main` as the page. Both compositions are drawn and CSS breakpoints pick
// one, so nothing waits on the client's media queries.
export default function AlertsLoading() {
  return (
    <main {...MAIN_CONTENT} className="outline-none flex min-h-0 flex-1 flex-col bg-background">
      <AlertsPagePlaceholder />
    </main>
  );
}
