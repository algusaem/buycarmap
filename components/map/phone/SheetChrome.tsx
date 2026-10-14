"use client";

import type { ReactNode, Ref, RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { crossFade, sheetSlideUp } from "@/lib/animations";
import { cn } from "@/lib/utils";

// docs/design/system/components/SearchPopover/README.md (la hoja «BUSCAR») and
// FilterSheet/README.md: the frame the «BUSCAR» sheet and the filters panel
// share. A 70px header with the 40px close button, the Unbounded title (the
// dialog's `h2`, over the sections' `h3`s) and the underlined «Borrar», and a
// footer with the 56px «Ver coches». Also the bottom-sheet frame the «BUSCAR»
// sheet and Crear alerta's phone sheet share (PhoneBottomSheet).

/**
 * A phone dialog's `onCloseAutoFocus`: the focus goes back to the control
 * that opened it. The dialogs are opened from controls outside any
 * `Dialog.Trigger`, so Radix alone has nowhere to return it.
 */
function returnFocusTo(opener: RefObject<HTMLElement | null> | undefined) {
  return (event: Event) => {
    if (!opener?.current) return;
    event.preventDefault();
    opener.current.focus();
  };
}

const SHEET_MOTION = { fade: crossFade, slide: sheetSlideUp };

const BOTTOM_SHEET_CLASS =
  "fixed inset-x-0 bottom-0 z-50 flex flex-col overscroll-contain rounded-t-sheet border-t border-line bg-surface pt-2.5 font-sans text-text";
// The filters panel's phone dialog (FilterPanel.tsx's PhoneFilterPanel): a
// full-screen dialog over the whole viewport instead of a bottom sheet, so it
// needs no dimmed overlay underneath it and no handle on top.
const FULL_SCREEN_CLASS =
  "fixed inset-0 z-50 flex flex-col overscroll-contain bg-bg pt-safe-top font-sans text-text lg:hidden";

interface PhoneBottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** The control that opened the sheet, focused again when it closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** The dimmed screen behind the sheet: its fill, and when it shows. Unused by a `fullScreen` sheet. */
  overlayClassName?: string;
  /** The sheet's own padding, gaps, height and breakpoint, over the shared frame. */
  className?: string;
  /** How the sheet comes in and goes: fading, or sliding up from the bottom. */
  entrance: keyof typeof SHEET_MOTION;
  contentRef?: Ref<HTMLDivElement>;
  onOpenAutoFocus?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** A full-screen dialog instead of a bottom sheet: no dimmed overlay, no handle. */
  fullScreen?: boolean;
  children: ReactNode;
}

/**
 * A modal bottom sheet on a phone (BottomSheet/README.md › Hojas modales): a
 * Radix dialog over the dimmed screen, `surface`, the top `line` border and
 * `radius-sheet` corners, with the 40 × 5 `handle` centred on top. It
 * animates in and out with Motion, closes with Escape or a press outside, and
 * gives the focus back to its opener (returnFocusTo). The caller draws the
 * title (a `Dialog.Title`) and everything under the handle. `fullScreen`
 * covers the whole viewport instead (the filters panel's phone dialog):
 * neither the dimmed overlay nor the handle apply then.
 */
export function PhoneBottomSheet({
  open,
  onClose,
  returnFocusRef,
  overlayClassName,
  className,
  entrance,
  contentRef,
  onOpenAutoFocus,
  onEscapeKeyDown,
  fullScreen = false,
  children,
}: PhoneBottomSheetProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {!fullScreen && (
              <DialogPrimitive.Overlay forceMount asChild>
                <motion.div {...crossFade} className={cn("fixed inset-0 z-50", overlayClassName)} />
              </DialogPrimitive.Overlay>
            )}
            <DialogPrimitive.Content
              forceMount
              asChild
              aria-describedby={undefined}
              onOpenAutoFocus={onOpenAutoFocus}
              onEscapeKeyDown={onEscapeKeyDown}
              onCloseAutoFocus={returnFocusTo(returnFocusRef)}
              className={cn(fullScreen ? FULL_SCREEN_CLASS : BOTTOM_SHEET_CLASS, className)}
            >
              <motion.div ref={contentRef} {...SHEET_MOTION[entrance]}>
                {!fullScreen && (
                  <span
                    aria-hidden="true"
                    className="h-1.25 w-10 shrink-0 self-center rounded-pill bg-handle"
                  />
                )}
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

interface ClearButtonProps {
  onClick: () => void;
}

export function ClearButton({ onClick }: ClearButtonProps) {
  const t = useTranslations();
  return (
    <Button
      type="button"
      variant="ghost"
      size="pad-14"
      className="px-0 underline underline-offset-2"
      onClick={onClick}
    >
      {t("search.clear")}
    </Button>
  );
}

interface SheetHeaderProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  onClear: () => void;
}

/** The phone header: close, the dialog's title, «Borrar». Inside a Radix Dialog only. */
export function SheetHeader({ title, closeLabel, onClose, onClear }: SheetHeaderProps) {
  return (
    <div className="grid h-17.5 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line-soft px-5">
      <Button
        type="button"
        variant="icon"
        size="icon-40"
        aria-label={closeLabel}
        onClick={onClose}
        className="justify-self-start"
      >
        <X aria-hidden="true" className="size-3.5" />
      </Button>
      <DialogPrimitive.Title className="m-0 font-display text-base font-extrabold uppercase">
        {title}
      </DialogPrimitive.Title>
      <span className="justify-self-end">
        <ClearButton onClick={onClear} />
      </span>
    </div>
  );
}

interface ShowCarsFooterProps {
  onShowCars: () => void;
}

export function ShowCarsFooter({ onShowCars }: ShowCarsFooterProps) {
  const t = useTranslations();
  return (
    <div className="shrink-0 border-t border-line-soft px-5 pt-3.5 pb-sheet-footer">
      <Button type="button" variant="primary" size="display" onClick={onShowCars}>
        {t("search.showCars")}
      </Button>
    </div>
  );
}
