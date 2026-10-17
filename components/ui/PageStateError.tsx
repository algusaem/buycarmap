"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PageError } from "@/components/ui/PageError";
import { PageStateLayout } from "@/components/ui/PageStateLayout";

// docs/specs/redesign-pages.md (PAGES-57, PAGES-68; amends FRONT-14,
// PLAT-14); F0-estado-error-pagina, F7-no-existe. A route's error boundary:
// the page-error state (components/ui/PageError.tsx), «¿Se ha roto algo? /
// No es culpa tuya» as the page's `h1` over the shared line, «Reintentar» and
// «Volver al mapa», in the frame of the not-found page
// (components/ui/PageStateLayout.tsx) under the header of the route that
// failed. At desktop width the empty map sits beside it, drawn for the eye
// only. Its sides follow that header: `session` for the root error (48px
// under the access and landing headers, the pages header's 32px once the
// signed-in tab bar is on the page), `pages` for /account's (the pages
// header's 32px). PageError reports the thrown error to Sentry and never
// shows it.

interface PageStateErrorProps {
  /** The frame's sides, as PageStateLayout's. */
  sides: ComponentProps<typeof PageStateLayout>["sides"];
  error: Error & { digest?: string };
  reset: () => void;
}

export function PageStateError({ sides, error, reset }: PageStateErrorProps) {
  const t = useTranslations();

  return (
    <PageStateLayout sides={sides}>
      <PageError error={error} reset={reset} line={t("errors.pageLine")}>
        <Button asChild variant="secondary" size="48">
          <Link href="/map">{t("nav.backToMap")}</Link>
        </Button>
      </PageError>
    </PageStateLayout>
  );
}
