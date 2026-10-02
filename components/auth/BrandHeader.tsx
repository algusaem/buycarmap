"use client";

import * as motion from "motion/react-client";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { fadeInDown } from "@/lib/animations";

export function BrandHeader() {
  const t = useTranslations();
  return (
    <motion.div className="space-y-2 text-center" {...fadeInDown}>
      <div className="mb-6 flex items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <MapPin className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">BuyCarMap</h1>
      </div>
      <p className="text-sm text-muted-foreground">{t("auth.brandTagline")}</p>
    </motion.div>
  );
}
