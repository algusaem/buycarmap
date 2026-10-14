"use client";

import type { Ref } from "react";
import * as motion from "motion/react-client";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { crossFade } from "@/lib/animations";
import { cn } from "@/lib/utils";

// docs/design/system/components/Chip/README.md (Filtros activos): a violet
// chip, on-violet text at 14px weight 800, 36px tall with 16px of left
// padding, and its 44 × 44 remove button overlapping the chip's edge by 4px,
// named «Quitar <texto>». The filters row's active criteria (MAPUI-13) and the
// type-ahead's chosen brand (MAPUI-7, MAPUI-9). It fades in and out inside the
// caller's AnimatePresence.
interface RemovableChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
  /** The remove button, so a caller can give it the focus back after removal (FilterRow). */
  buttonRef?: Ref<HTMLButtonElement>;
}

export function RemovableChip({ label, onRemove, className, buttonRef }: RemovableChipProps) {
  const t = useTranslations();

  return (
    <motion.span
      {...crossFade}
      className={cn(
        "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-pill bg-violet pl-4 font-sans text-sm font-extrabold text-on-violet",
        className,
      )}
    >
      {label}
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("search.remove", { label })}
        onClick={onRemove}
        className="-my-1 -ml-1 flex size-11 cursor-pointer items-center justify-center rounded-pill text-on-violet"
      >
        <X aria-hidden="true" strokeWidth={2.6} className="size-3.5" />
      </button>
    </motion.span>
  );
}
