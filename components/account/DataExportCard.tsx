"use client";

import { toast } from "sonner";
import { useMessages, useTranslations } from "next-intl";
import { BusyButton } from "@/components/ui/BusyButton";
import { translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { useDataExport } from "@/lib/hooks/useDataExport";
import { AccountCard } from "./AccountCard";

// EXPORT-14..17 (docs/specs/account-data-export.md): "Download my data" on
// /account, in the «Tus datos» card since docs/specs/redesign-pages.md
// (PAGES-36). The browser's own download UI confirms success, so there is no
// success toast; a failure is an error toast. While running, the button is
// busy: disabled, the spinner left of its unchanged label (RULES.md §19).
export function DataExportCard() {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const { isExporting, startExport } = useDataExport();

  const onExport = async () => {
    const result = await startExport();

    if (result && !result.success) {
      toast.error(translateRefusal(messages, result.error));
    }
  };

  return (
    <AccountCard title={t("account.export.title")} line={t("account.export.description")}>
      <BusyButton type="button" variant="secondary" size="44" busy={isExporting} onClick={onExport}>
        {t("account.export.submit")}
      </BusyButton>
    </AccountCard>
  );
}
