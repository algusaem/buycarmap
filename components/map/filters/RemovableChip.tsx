"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// docs/design/system/components/Chip/README.md (Filtros activos): a violet
// chip, on-violet text at 14px weight 800, 36px tall with 16px of left
// padding, and its 44 × 44 remove button overlapping the chip's edge by 4px,
// named «Quitar <texto>». The type-ahead's chosen brand (MAPUI-7, MAPUI-9). It
// appears and leaves at once, as the rest of the type-ahead does (MOTION-13,
// MOTION-18); its remove button gains a light wash on hover (`on-violet` at
// 15%) and scales to 0.97 while pressed (MOTION-17).
interface RemovableChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

export function RemovableChip({ label, onRemove, className }: RemovableChipProps) {
  const t = useTranslations();

  return (
    <span
      className={cn(
        "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-pill bg-violet pl-4 font-sans text-sm font-extrabold text-on-violet",
        className,
      )}
    >
      {label}
      <button
        type="button"
        aria-label={t("search.remove", { label })}
        onClick={onRemove}
        className="-my-1 -ml-1 flex size-11 cursor-pointer items-center justify-center rounded-pill text-on-violet transition-[background-color,scale] hover:bg-on-violet/15 active:scale-97 motion-reduce:active:scale-none"
      >
        <X aria-hidden="true" strokeWidth={2.6} className="size-3.5" />
      </button>
    </span>
  );
}
