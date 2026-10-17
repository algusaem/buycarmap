import type { Ref } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// docs/specs/redesign-alerts.md (ALERTUI-1, ALERTUI-2, ALERTUI-38,
// ALERTUI-40); R3-alertas. /alerts' heading, the same while it loads, with
// alerts and with none: «Alertas», the page's `h1` drawn in capitals, and from
// `lg`, on its row, «Nueva alerta», a link to the map where an alert is made
// (MAPUI-39), over the page's line. The phone shows the heading alone.

interface AlertsHeadingProps {
  /** The heading, which takes the focus after a delete (ALERTUI-35): focusable from script only then. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** At phone width the heading goes alone; left out (the loading state), CSS picks by breakpoint. */
  phone?: boolean;
}

export function AlertsHeading({ headingRef, phone = false }: AlertsHeadingProps) {
  const t = useTranslations();

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <h1
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="m-0 font-display text-page-title-mobile font-black uppercase lg:text-page-title"
        >
          {t("alerts.title")}
        </h1>
        {!phone && (
          <Button asChild variant="primary" size="pad-14" className="max-lg:hidden">
            <Link href="/map">{t("alerts.newAlert")}</Link>
          </Button>
        )}
      </div>
      {!phone && (
        <p className="m-0 text-body-15 text-text-muted max-lg:hidden">{t("alerts.subtitle")}</p>
      )}
    </>
  );
}
