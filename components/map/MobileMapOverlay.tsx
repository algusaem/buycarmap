"use client";

import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

interface MobileMapOverlayProps {
  onClose: () => void;
  children: ReactNode;
}

export function MobileMapOverlay({ onClose, children }: MobileMapOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        className="absolute left-4 top-4 z-1000 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-lg"
        onClick={onClose}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      {children}
    </div>
  );
}
