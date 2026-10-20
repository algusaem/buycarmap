import { AlertPagePlaceholder } from "@/components/alerts/AlertPlaceholders";
import { MAIN_CONTENT } from "@/components/nav/SkipLink";

// docs/specs/redesign-alerts.md (ALERTUI-39; amends FRONT-14);
// F6-alerta-mas-estados. /alerts/[id]'s loading state mirrors the alert page
// (components/alerts/AlertPlaceholders.tsx), under the same `main` as the
// page; the phone header's «Volver» is the header's own. Both compositions
// are drawn and CSS breakpoints pick one.
export default function AlertMatchesLoading() {
  return (
    <main {...MAIN_CONTENT} className="outline-none flex min-h-0 flex-1 flex-col bg-background">
      <AlertPagePlaceholder />
    </main>
  );
}
