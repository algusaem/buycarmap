"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface MobileMapOverlayProps {
  onClose: () => void;
  children: ReactNode;
}

export function MobileMapOverlay({ onClose, children }: MobileMapOverlayProps) {
  const t = useTranslations();

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-4 z-1000 rounded-full bg-card shadow-lg hover:bg-card/80"
        onClick={onClose}
        aria-label={t("map.closeMap")}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      {children}
    </div>
  );
}
