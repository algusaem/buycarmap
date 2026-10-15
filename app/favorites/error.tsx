"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { SavedColumn, SavedMapFrame } from "@/components/favorites/SavedLayout";
import { Button } from "@/components/ui/button";
import { PageError } from "@/components/ui/PageError";

// PLAT-14 (docs/specs/core-platform.md): server/favorites/queries.ts no
// longer swallows a failed read into an empty list (issue #48); this catches
// it and offers a retry instead. Since docs/specs/redesign-saved.md (SAVED-32)
// it is the page-error state (components/ui/PageError.tsx) with the shared
// line and «Volver al mapa», in the page's list column. At desktop width the
// empty map sits beside it, with no pill; below `lg` CSS hides it.
interface FavoritesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FavoritesError({ error, reset }: FavoritesErrorProps) {
  const t = useTranslations();

  return (
    <main className="flex min-h-0 flex-1 bg-background">
      <SavedColumn>
        <div className="mt-4.5 lg:mt-14">
          <PageError error={error} reset={reset} line={t("errors.pageLine")}>
            <Button asChild variant="secondary" size="48">
              <Link href="/map">{t("nav.backToMap")}</Link>
            </Button>
          </PageError>
        </div>
      </SavedColumn>
      <SavedMapFrame />
    </main>
  );
}
