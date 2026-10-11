"use client";

import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { toast } from "sonner";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { useMessages, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { crossFade } from "@/lib/animations";
import { translateAuthError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { useDataExport } from "@/lib/hooks/useDataExport";

// EXPORT-14..17 (docs/specs/account-data-export.md): "Download my data" on
// /account. The browser's own download UI confirms success, so there is no
// success toast; a failure is an error toast. While running, the button keeps
// its label and adds a spinner (RULES.md §19).
export function DataExportCard() {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const { isExporting, startExport } = useDataExport();

  const onExport = async () => {
    const result = await startExport();

    if (result && !result.success) {
      toast.error(translateAuthError(messages, result.error));
    }
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-bold">{t("account.export.title")}</CardTitle>
        <CardDescription>{t("account.export.description")}</CardDescription>
      </CardHeader>

      <CardContent>
        <Button
          type="button"
          variant="outline"
          disabled={isExporting}
          aria-busy={isExporting}
          onClick={onExport}
        >
          <AnimatePresence initial={false}>
            {isExporting && (
              <motion.span key="spinner" className="flex" aria-hidden="true" {...crossFade}>
                <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
              </motion.span>
            )}
          </AnimatePresence>
          {t("account.export.submit")}
        </Button>
      </CardContent>
    </Card>
  );
}
